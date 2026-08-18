/* POST /api/reservar
   { fecha, hora, servicios[], profesional, cliente:{nombre,telefono,email} }
   { buscar: { telefono } }              → busca la cita próxima de ese celular
   { …reserva, reemplaza: { telefono } } → crea la nueva y cancela la vieja

   Crea la cita. El precio NO se acepta del cliente: se lee de la base, porque
   lo que llega del navegador lo puede editar cualquiera desde la consola. */
import { sql, aUTC, json, codigoCita, normalizaTelefono } from './_db.mjs';

/* La llave para tocar una cita es el CELULAR con el que se reservó.

   Antes hacían falta el código y el celular. Sobre el papel era más seguro;
   en la práctica el cliente perdía el código —lo ve una vez en pantalla y
   cierra la página— y entonces reservaba otra vez, que es el problema que todo
   esto viene a resolver. Una llave que se pierde no protege: empuja a la gente
   al camino malo.

   El precio es real y conviene tenerlo escrito: quien conozca el número de
   alguien puede ver y mover su cita. Para una barbería el peor caso es que
   alguien mueva un corte ajeno; frente a eso, el duplicado que se evita es
   diario y cuesta horas de agenda. Si algún día molesta, el remedio es mandar
   un código por WhatsApp al pedir el cambio, no volver al que se olvida.

   Se devuelve solo la cita futura más próxima que siga en pie. Las pasadas no
   se pueden cambiar, y las canceladas tampoco. */
async function buscarCita(telefonoCrudo) {
  const tel = normalizaTelefono(telefonoCrudo);
  if (!tel) return null;

  const r = await sql`
    SELECT c.id, c.codigo, c.inicio, c.estado, c.profesional_id, c.total,
           cl.nombre AS cliente, cl.telefono, cl.email,
           COALESCE(array_agg(cs.servicio_id) FILTER (WHERE cs.servicio_id IS NOT NULL), '{}') AS servicios
      FROM cita c
      JOIN cliente cl ON cl.id = c.cliente_id
      LEFT JOIN cita_servicio cs ON cs.cita_id = c.id
     WHERE cl.telefono = ${tel}
       AND c.estado = 'confirmada'
       AND c.inicio > now()
     GROUP BY c.id, cl.nombre, cl.telefono, cl.email
     ORDER BY c.inicio
     LIMIT 1`;
  return r[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Solo POST' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  /* ---------- buscar la cita que se quiere cambiar ---------- */
  if (b.buscar) {
    try {
      const c = await buscarCita(b.buscar.telefono);
      if (!c) {
        return json(res, 404, {
          error: 'No encontramos ninguna cita próxima con ese celular. Revisa el número.'
        });
      }
      return json(res, 200, {
        cita: {
          codigo: c.codigo,
          inicio: c.inicio,
          profesional: c.profesional_id,
          servicios: (c.servicios || []).filter(Boolean),
          cliente: { nombre: c.cliente, telefono: c.telefono, email: c.email }
        }
      });
    } catch (e) {
      console.error('buscar cita', e);
      return json(res, 500, { error: 'No se pudo buscar la cita' });
    }
  }

  const { fecha, hora, servicios, profesional, cliente } = b;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return json(res, 400, { error: 'Fecha inválida' });
  if (!/^\d{2}:\d{2}$/.test(hora || ''))        return json(res, 400, { error: 'Hora inválida' });
  if (!Array.isArray(servicios) || !servicios.length) return json(res, 400, { error: 'Falta el servicio' });
  if (!cliente || !String(cliente.nombre || '').trim()) return json(res, 400, { error: 'Falta el nombre' });

  const telefono = normalizaTelefono(cliente.telefono);
  if (!telefono) return json(res, 400, { error: 'El celular debe ser un número colombiano de 10 dígitos' });

  try {
    /* Si viene a reemplazar una cita, se comprueba ANTES de crear nada: si el
       código o el celular no cuadran, se para aquí y la cita vieja ni se toca. */
    let anterior = null;
    if (b.reemplaza) {
      anterior = await buscarCita(b.reemplaza.telefono);
      if (!anterior) {
        return json(res, 404, { error: 'No encontramos la cita que quieres cambiar.' });
      }
      if (anterior.estado !== 'confirmada') {
        return json(res, 409, { error: 'Esa cita ya no se puede cambiar.' });
      }
    }

    const servs = await sql`
      SELECT id, minutos, precio FROM servicio WHERE id = ANY(${servicios}) AND activo`;
    if (servs.length !== servicios.length) return json(res, 400, { error: 'Servicio no disponible' });

    /* Que el profesional preste TODOS los servicios de la cita. Sin esta
       comprobación, una petición armada a mano puede citar a alguien para algo
       que no hace. */
    const ok = await sql`
      SELECT COUNT(DISTINCT servicio_id)::int AS n
        FROM servicio_profesional
       WHERE profesional_id = ${profesional} AND servicio_id = ANY(${servicios})`;
    if (!ok[0] || ok[0].n !== servicios.length) {
      return json(res, 400, { error: 'Ese profesional no presta todos los servicios elegidos' });
    }

    const duracion = servs.reduce((t, s) => t + s.minutos, 0);
    const inicio = aUTC(fecha, hora);
    const fin    = new Date(inicio.getTime() + duracion * 60000);

    if (inicio.getTime() < Date.now() + 60 * 60000) {
      return json(res, 409, { error: 'Ese horario ya pasó o está muy cerca. Elige otro.' });
    }

    const total = servs.reduce((t, s) => t + (s.precio || 0), 0);

    const cl = await sql`
      INSERT INTO cliente (nombre, telefono, email)
      VALUES (${String(cliente.nombre).trim()}, ${telefono}, ${cliente.email || null})
      ON CONFLICT (telefono) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id`;

    /* ---------- cambiar una cita: se ACTUALIZA la que hay ----------

       No se crea una nueva y se cancela la vieja. Ese fue el diseño anterior y
       tenía un fallo grave: la restricción de solape mira profesional y rango
       de horas mientras la cita esté confirmada, así que la cita vieja bloqueaba
       a la nueva. Cambiar cualquier cosa SIN mover la hora —el barbero, un
       servicio— chocaba consigo misma y el sistema decía «ese horario ya está
       tomado». Lo estaba: por la propia cita que se quería cambiar.

       Actualizando la misma fila el problema desaparece solo: una fila no
       colisiona consigo misma. Y si el hueco nuevo lo tiene OTRO, el UPDATE
       falla y la cita se queda exactamente como estaba. */
    if (anterior) {
      try {
        const r = await sql`
          UPDATE cita
             SET profesional_id = ${profesional},
                 inicio = ${inicio.toISOString()},
                 fin = ${fin.toISOString()},
                 total = ${total},
                 nota = COALESCE(nota || ' · ', '') || 'Cambiada por el cliente'
           WHERE id = ${anterior.id} AND estado = 'confirmada'
           RETURNING id, codigo`;
        if (!r.length) return json(res, 409, { error: 'Esa cita ya no se puede cambiar.' });

        /* Los servicios se rehacen: pueden haber cambiado, y si no, quedan
           igual. Borrar y volver a poner es más simple que averiguar cuáles
           entraron y cuáles salieron, y son tres filas. */
        await sql`DELETE FROM cita_servicio WHERE cita_id = ${r[0].id}`;
        for (const s of servs) {
          await sql`INSERT INTO cita_servicio (cita_id, servicio_id, precio)
                    VALUES (${r[0].id}, ${s.id}, ${s.precio})`;
        }
        return json(res, 200, {
          codigo: r[0].codigo, inicio: inicio.toISOString(), total, cambiada: true
        });
      } catch (e) {
        if (e.code === '23P01') {
          /* El choque tiene dos causas y el cliente hace cosas distintas con
             cada una. Si NO movió la hora, no se la ha quitado nadie: es que el
             servicio nuevo dura más y ahora se mete en la cita de al lado. Decir
             «lo acaban de tomar» ahí manda a buscar un culpable que no existe y
             esconde la salida, que es mover la cita. */
          const mismaHora = Math.abs(new Date(anterior.inicio) - inicio) < 60000;
          return json(res, 409, {
            error: mismaHora
              ? 'Ese servicio no cabe en tu hora de siempre: hay otra cita justo después. Marca también «el día o la hora» y elige otro momento — la tuya sigue como estaba.'
              : 'Ese horario lo acaban de tomar. Elige otro — tu cita sigue como estaba.'
          });
        }
        throw e;
      }
    }

    const codigo = codigoCita();
    let cita;
    try {
      const r = await sql`
        INSERT INTO cita (codigo, cliente_id, profesional_id, inicio, fin, total)
        VALUES (${codigo}, ${cl[0].id}, ${profesional},
                ${inicio.toISOString()}, ${fin.toISOString()}, ${total})
        RETURNING id, codigo`;
      cita = r[0];
    } catch (e) {
      /* 23P01 = lo rechazó la restricción de solape: alguien tomó ese cupo
         entre que se pintó la pantalla y se pulsó el botón. Es un caso normal,
         no un fallo: se le pide al cliente que elija otra hora. */
      if (e.code === '23P01') {
        return json(res, 409, { error: 'Justo acaban de tomar ese horario. Elige otro, por favor.' });
      }
      throw e;
    }

    for (const s of servs) {
      await sql`INSERT INTO cita_servicio (cita_id, servicio_id, precio)
                VALUES (${cita.id}, ${s.id}, ${s.precio})`;
    }

    return json(res, 201, { codigo: cita.codigo, inicio: inicio.toISOString(), total });
  } catch (e) {
    console.error('reservar', e);
    return json(res, 500, { error: 'No se pudo crear la cita' });
  }
}

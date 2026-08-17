/* POST /api/reservar
   { fecha, hora, servicios[], profesional, cliente:{nombre,telefono,email} }
   { buscar: { codigo, telefono } }              → busca una cita para cambiarla
   { …reserva, reemplaza: { codigo, telefono } } → crea la nueva y cancela la vieja

   Crea la cita. El precio NO se acepta del cliente: se lee de la base, porque
   lo que llega del navegador lo puede editar cualquiera desde la consola. */
import { sql, aUTC, json, codigoCita, normalizaTelefono } from './_db.mjs';

/* Para tocar una cita hacen falta LAS DOS cosas: su código y el celular con el
   que se reservó. Solo con el código, seis caracteres bastarían para que
   alguien probara combinaciones hasta dar con una cita ajena y moverla. El
   celular no se puede adivinar junto con el código, y el cliente tiene los dos
   sin esfuerzo: el código se lo mandamos y el número es el suyo. */
async function buscarCita(codigo, telefonoCrudo) {
  const cod = String(codigo || '').trim().toUpperCase();
  const tel = normalizaTelefono(telefonoCrudo);
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(cod) || !tel) return null;

  const r = await sql`
    SELECT c.id, c.codigo, c.inicio, c.estado, c.profesional_id, c.total,
           cl.nombre AS cliente, cl.telefono, cl.email,
           COALESCE(array_agg(cs.servicio_id) FILTER (WHERE cs.servicio_id IS NOT NULL), '{}') AS servicios
      FROM cita c
      JOIN cliente cl ON cl.id = c.cliente_id
      LEFT JOIN cita_servicio cs ON cs.cita_id = c.id
     WHERE c.codigo = ${cod} AND cl.telefono = ${tel}
     GROUP BY c.id, cl.nombre, cl.telefono, cl.email`;
  return r[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Solo POST' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  /* ---------- buscar la cita que se quiere cambiar ---------- */
  if (b.buscar) {
    try {
      const c = await buscarCita(b.buscar.codigo, b.buscar.telefono);
      /* El mismo mensaje para «no existe» y para «el celular no corresponde».
         Distinguirlos le diría a quien prueba códigos cuáles existen. */
      if (!c) return json(res, 404, { error: 'No encontramos esa cita. Revisa el código y el celular.' });
      if (c.estado === 'cancelada') return json(res, 409, { error: 'Esa cita ya está cancelada.' });
      if (c.estado === 'cumplida')  return json(res, 409, { error: 'Esa cita ya se atendió.' });
      if (new Date(c.inicio).getTime() < Date.now()) {
        return json(res, 409, { error: 'Esa cita ya pasó. Reserva una nueva.' });
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
      anterior = await buscarCita(b.reemplaza.codigo, b.reemplaza.telefono);
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

    /* La anterior se cancela AQUÍ, y no antes.

       El orden es la garantía de todo esto. Creando primero, si el cupo nuevo
       se lo llevó otro entre medias, la petición falla arriba y el cliente se
       queda con su cita de siempre. Cancelando primero, ese mismo tropiezo lo
       dejaría sin ninguna de las dos —y sin forma de recuperar la que tenía—.

       Si la cancelación fallara, quedarían dos citas: es lo que pasa hoy cuando
       alguien reserva de nuevo para cambiar, así que el peor caso de esto es el
       estado normal de antes. */
    if (anterior) {
      await sql`
        UPDATE cita
           SET estado = 'cancelada',
               nota = COALESCE(nota || ' · ', '') || 'Cambiada por el cliente a la cita ' || ${cita.codigo}
         WHERE id = ${anterior.id} AND estado = 'confirmada'`;
    }

    return json(res, 201, {
      codigo: cita.codigo, inicio: inicio.toISOString(), total,
      reemplazo: anterior ? anterior.codigo : null
    });
  } catch (e) {
    console.error('reservar', e);
    return json(res, 500, { error: 'No se pudo crear la cita' });
  }
}

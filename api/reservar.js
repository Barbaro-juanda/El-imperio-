/* POST /api/reservar
   { fecha, hora, servicios[], profesional, cliente:{nombre,telefono,email} }

   Crea la cita. El precio NO se acepta del cliente: se lee de la base, porque
   lo que llega del navegador lo puede editar cualquiera desde la consola. */
import { sql, aUTC, json, codigoCita, normalizaTelefono } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Solo POST' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { fecha, hora, servicios, profesional, cliente } = b;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return json(res, 400, { error: 'Fecha inválida' });
  if (!/^\d{2}:\d{2}$/.test(hora || ''))        return json(res, 400, { error: 'Hora inválida' });
  if (!Array.isArray(servicios) || !servicios.length) return json(res, 400, { error: 'Falta el servicio' });
  if (!cliente || !String(cliente.nombre || '').trim()) return json(res, 400, { error: 'Falta el nombre' });

  const telefono = normalizaTelefono(cliente.telefono);
  if (!telefono) return json(res, 400, { error: 'El celular debe ser un número colombiano de 10 dígitos' });

  try {
    const { rows: servs } = await sql`
      SELECT id, minutos, precio FROM servicio WHERE id = ANY(${servicios}) AND activo`;
    if (servs.length !== servicios.length) return json(res, 400, { error: 'Servicio no disponible' });

    /* Que el profesional preste TODOS los servicios de la cita. Sin esta
       comprobación, una petición armada a mano puede citar a alguien para algo
       que no hace. */
    const { rows: ok } = await sql`
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

    const { rows: cl } = await sql`
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
      cita = r.rows[0];
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

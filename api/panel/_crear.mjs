/* POST /api/panel/crear
   { fecha, hora, minutos?, servicios[], profesional, cliente_id? , nombre?, telefono? }

   Crear cita desde el mostrador. Se separa de /api/reservar a propósito: son
   dos operaciones con reglas distintas y mezclarlas obligaría a llenar la
   pública de excepciones.

     · Sin antelación mínima. La web exige una hora porque nadie reserva por
       internet para «ahora»; el local sí agenda al que acaba de entrar.
     · Cliente opcional. En el mostrador muchas veces solo hay un nombre.
     · Duración editable. «Dura 2 horas, pero puedo cambiarla»: quien atiende
       sabe si ese cliente se demora más.

   Lo que NO se relaja es el solape: la restricción de la base sigue mandando,
   así que ni el mostrador puede pisar una cita existente. */
import { sql, json, aUTC, codigoCita, normalizaTelefono } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

export default protegido(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Solo POST' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { fecha, hora, servicios, profesional } = b;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return json(res, 400, { error: 'Fecha inválida' });
  if (!/^\d{2}:\d{2}$/.test(hora || ''))        return json(res, 400, { error: 'Hora inválida' });
  if (!Array.isArray(servicios) || !servicios.length) return json(res, 400, { error: 'Elige al menos un servicio' });
  if (!profesional) return json(res, 400, { error: 'Elige el profesional' });

  try {
    const servs = await sql`
      SELECT id, minutos, precio FROM servicio WHERE id = ANY(${servicios}) AND activo`;
    if (servs.length !== servicios.length) return json(res, 400, { error: 'Servicio no disponible' });

    const ok = await sql`
      SELECT COUNT(DISTINCT servicio_id)::int AS n
        FROM servicio_profesional
       WHERE profesional_id = ${profesional} AND servicio_id = ANY(${servicios})`;
    if (!ok[0] || ok[0].n !== servicios.length) {
      return json(res, 400, { error: 'Ese profesional no presta todos los servicios elegidos' });
    }

    /* La duración del catálogo es la propuesta; si quien agenda la cambia,
       manda la suya. Se acota para que un dedazo no bloquee la agenda entera. */
    const propuesta = servs.reduce((t, s) => t + s.minutos, 0);
    let minutos = Number(b.minutos) || propuesta;
    if (minutos < 5 || minutos > 600) return json(res, 400, { error: 'La duración debe estar entre 5 y 600 minutos' });

    const inicio = aUTC(fecha, hora);
    const fin    = new Date(inicio.getTime() + minutos * 60000);

    /* Cliente: existente, nuevo con teléfono, o solo un nombre. */
    let clienteId = b.cliente_id || null;
    if (!clienteId) {
      const nombre = String(b.nombre || '').trim();
      if (!nombre) return json(res, 400, { error: 'Falta el nombre del cliente' });
      const tel = b.telefono ? normalizaTelefono(b.telefono) : null;
      if (b.telefono && !tel) return json(res, 400, { error: 'El celular debe ser un número colombiano de 10 dígitos' });

      if (tel) {
        const r = await sql`
          INSERT INTO cliente (nombre, telefono) VALUES (${nombre}, ${tel})
          ON CONFLICT (telefono) DO UPDATE SET nombre = EXCLUDED.nombre
          RETURNING id`;
        clienteId = r[0].id;
      } else {
        /* Sin teléfono no hay con qué fusionar, así que cada uno entra aparte.
           Es el precio de poder agendar con un nombre y nada más. */
        const r = await sql`INSERT INTO cliente (nombre) VALUES (${nombre}) RETURNING id`;
        clienteId = r[0].id;
      }
    }

    const total = servs.reduce((t, s) => t + (s.precio || 0), 0);
    const codigo = codigoCita();

    let cita;
    try {
      const r = await sql`
        INSERT INTO cita (codigo, cliente_id, profesional_id, inicio, fin, total, origen)
        VALUES (${codigo}, ${clienteId}, ${profesional},
                ${inicio.toISOString()}, ${fin.toISOString()}, ${total}, 'local')
        RETURNING id, codigo`;
      cita = r[0];
    } catch (e) {
      if (e.code === '23P01') {
        return json(res, 409, { error: 'Ese profesional ya tiene una cita a esa hora' });
      }
      throw e;
    }

    for (const s of servs) {
      await sql`INSERT INTO cita_servicio (cita_id, servicio_id, precio)
                VALUES (${cita.id}, ${s.id}, ${s.precio})`;
    }

    return json(res, 201, { id: cita.id, codigo: cita.codigo, minutos, total });
  } catch (e) {
    console.error('crear', e);
    return json(res, 500, { error: 'No se pudo crear la cita' });
  }
});

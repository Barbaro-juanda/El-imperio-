/* PATCH /api/panel/cita { id, estado }
   Marcar cumplida, no asistió o cancelada.

   Cancelar libera el cupo: la restricción de solape solo mira las confirmadas,
   así que al cambiar de estado la hora vuelve a ofrecerse sola. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

const VALIDOS = ['confirmada', 'cancelada', 'cumplida', 'no_asistio'];

export default protegido(async (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'POST') return json(res, 405, { error: 'Solo PATCH' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!b.id) return json(res, 400, { error: 'Falta el id' });
  if (VALIDOS.indexOf(b.estado) === -1) return json(res, 400, { error: 'Estado no válido' });

  try {
    /* Reabrir es el único cambio de estado que puede fallar, y falla por una
       razón muy concreta: mientras la cita estuvo cancelada o marcada como que
       no vino, su hora quedó libre —la restricción de solape solo mira las
       confirmadas— y alguien pudo tomarla. Volver a confirmarla sería sentar a
       dos personas en la misma silla.

       Se mira ANTES de intentarlo, y no solo se atrapa el error de la base,
       porque la restricción sabe decir «no» pero no sabe decir de quién es la
       otra cita. Y sin ese dato el aviso no sirve: el dueño ve «ese horario
       está ocupado» delante de una agenda donde, para él, ese hueco está
       vacío —la cita que lo llena es la que está mirando—. */
    if (b.estado === 'confirmada') {
      const choque = await sql`
        SELECT to_char(otra.inicio AT TIME ZONE 'America/Bogota', 'HH24:MI') AS desde,
               to_char(otra.fin    AT TIME ZONE 'America/Bogota', 'HH24:MI') AS hasta,
               cl.nombre AS cliente
          FROM cita esta
          JOIN cita otra
            ON otra.profesional_id = esta.profesional_id
           AND otra.id <> esta.id
           AND otra.estado = 'confirmada'
           AND otra.inicio < esta.fin
           AND otra.fin    > esta.inicio
          JOIN cliente cl ON cl.id = otra.cliente_id
         WHERE esta.id = ${b.id}
         LIMIT 1`;
      if (choque.length) {
        const c = choque[0];
        return json(res, 409, {
          error: 'No se puede reabrir: a esa hora ya está ' + c.cliente + ' (' +
                 c.desde + '–' + c.hasta + '). Mueve una de las dos primero.'
        });
      }
    }

    const r = await sql`UPDATE cita SET estado = ${b.estado} WHERE id = ${b.id} RETURNING id, estado`;
    if (!r.length) return json(res, 404, { error: 'Esa cita no existe' });
    return json(res, 200, r[0]);
  } catch (e) {
    /* Red de seguridad: entre la comprobación de arriba y el UPDATE cabe que
       otro entre por medio. Es raro, pero el aviso genérico es mejor que un 500. */
    if (e.code === '23P01') {
      return json(res, 409, { error: 'Ese horario acaba de ocuparlo otra cita. Recarga la agenda.' });
    }
    console.error('cita', e);
    return json(res, 500, { error: 'No se pudo actualizar' });
  }
});

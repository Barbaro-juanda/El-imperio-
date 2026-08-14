/* PATCH /api/panel/mover { id, fecha, hora, profesional? }
   Reprogramar arrastrando. Conserva la duración: mover no es reeditar.

   La restricción de solape protege el destino, así que si el hueco está
   tomado la base lo rechaza y la cita se queda donde estaba. */
import { sql, json, aUTC } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

export default protegido(async (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'POST') return json(res, 405, { error: 'Solo PATCH' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!b.id) return json(res, 400, { error: 'Falta la cita' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha || '')) return json(res, 400, { error: 'Fecha inválida' });
  if (!/^\d{2}:\d{2}$/.test(b.hora || ''))        return json(res, 400, { error: 'Hora inválida' });

  try {
    const actual = await sql`SELECT inicio, fin, profesional_id FROM cita WHERE id = ${b.id}`;
    if (!actual.length) return json(res, 404, { error: 'Esa cita no existe' });

    const dur = new Date(actual[0].fin) - new Date(actual[0].inicio);
    const inicio = aUTC(b.fecha, b.hora);
    const fin = new Date(inicio.getTime() + dur);
    const prof = b.profesional || actual[0].profesional_id;

    /* Cambiar de profesional exige que el nuevo preste todos los servicios de
       la cita; si no, se estaría citando a alguien para algo que no hace. */
    if (Number(prof) !== Number(actual[0].profesional_id)) {
      const ok = await sql`
        SELECT COUNT(*)::int AS faltan
          FROM cita_servicio cs
         WHERE cs.cita_id = ${b.id}
           AND NOT EXISTS (SELECT 1 FROM servicio_profesional sp
                            WHERE sp.servicio_id = cs.servicio_id AND sp.profesional_id = ${prof})`;
      if (ok[0] && ok[0].faltan > 0) {
        return json(res, 400, { error: 'Ese profesional no presta todos los servicios de la cita' });
      }
    }

    try {
      const r = await sql`
        UPDATE cita SET inicio = ${inicio.toISOString()}, fin = ${fin.toISOString()},
                        profesional_id = ${prof}
         WHERE id = ${b.id} RETURNING id`;
      return json(res, 200, r[0]);
    } catch (e) {
      if (e.code === '23P01') return json(res, 409, { error: 'Ahí ya hay otra cita' });
      throw e;
    }
  } catch (e) {
    console.error('mover', e);
    return json(res, 500, { error: 'No se pudo mover la cita' });
  }
});

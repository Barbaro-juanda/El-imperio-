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
    const r = await sql`UPDATE cita SET estado = ${b.estado} WHERE id = ${b.id} RETURNING id, estado`;
    if (!r.length) return json(res, 404, { error: 'Esa cita no existe' });
    return json(res, 200, r[0]);
  } catch (e) {
    /* Volver a «confirmada» puede chocar con otra cita que ya ocupó el hueco. */
    if (e.code === '23P01') return json(res, 409, { error: 'Ese horario ya lo ocupa otra cita' });
    console.error('cita', e);
    return json(res, 500, { error: 'No se pudo actualizar' });
  }
});

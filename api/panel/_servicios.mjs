/* GET /api/panel/servicios
   Catálogo para el formulario de crear cita. Se pide una vez y se queda en
   memoria del navegador: no cambia entre un día y otro. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

export default protegido(async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });
  try {
    const servicios = await sql`
      SELECT s.id, s.nombre, s.segmento, s.minutos, s.precio,
             COALESCE(array_agg(sp.profesional_id ORDER BY sp.profesional_id)
                      FILTER (WHERE sp.profesional_id IS NOT NULL), '{}') AS profesionales
        FROM servicio s
        LEFT JOIN servicio_profesional sp ON sp.servicio_id = s.id
       WHERE s.activo
       GROUP BY s.id
       ORDER BY s.segmento, s.nombre`;
    return json(res, 200, { servicios });
  } catch (e) {
    console.error('servicios', e);
    return json(res, 500, { error: 'No se pudo cargar el catálogo' });
  }
});

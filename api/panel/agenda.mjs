/* GET /api/panel/agenda?fecha=YYYY-MM-DD
   Las citas de ese día, por profesional, con lo que el local necesita ver:
   quién viene, a qué, cuánto paga y su teléfono para poder llamarlo. */
import { sql, json, aUTC } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

export default protegido(async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });
  const { fecha } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return json(res, 400, { error: 'fecha inválida' });

  try {
    const desde = aUTC(fecha, '00:00');
    const hasta = new Date(desde.getTime() + 36 * 3600 * 1000); // cubre cierres pasada medianoche

    const citas = await sql`
      SELECT c.id, c.codigo, c.inicio, c.fin, c.estado, c.total,
             cl.nombre AS cliente, cl.telefono,
             p.id AS profesional_id, p.nombre AS profesional,
             COALESCE(string_agg(s.nombre, ', ' ORDER BY s.nombre), '') AS servicios
        FROM cita c
        JOIN cliente cl ON cl.id = c.cliente_id
        JOIN profesional p ON p.id = c.profesional_id
        LEFT JOIN cita_servicio cs ON cs.cita_id = c.id
        LEFT JOIN servicio s ON s.id = cs.servicio_id
       WHERE c.inicio >= ${desde.toISOString()} AND c.inicio < ${hasta.toISOString()}
       GROUP BY c.id, cl.nombre, cl.telefono, p.id, p.nombre
       ORDER BY c.inicio`;

    const bloqueos = await sql`
      SELECT id, profesional_id, inicio, fin, motivo FROM bloqueo
       WHERE inicio < ${hasta.toISOString()} AND fin > ${desde.toISOString()}
       ORDER BY inicio`;

    const confirmadas = citas.filter(c => c.estado === 'confirmada' || c.estado === 'cumplida');
    return json(res, 200, {
      citas, bloqueos,
      resumen: {
        total: confirmadas.reduce((t, c) => t + (c.total || 0), 0),
        cuantas: confirmadas.length
      }
    });
  } catch (e) {
    console.error('agenda', e);
    return json(res, 500, { error: 'No se pudo cargar la agenda' });
  }
});

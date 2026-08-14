/* GET /api/panel/caja?fecha=YYYY-MM-DD
   El cuadre del día: qué entró, por qué medio y cuánto le toca a cada quien.

   Se calcula sobre `cobrado_en` y no sobre la hora de la cita: lo que cuadra
   una caja es cuándo entró el dinero, no cuándo estaba agendado el corte. */
import { sql, json, aUTC } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

export default protegido(async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });
  const { fecha } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return json(res, 400, { error: 'fecha inválida' });

  try {
    const desde = aUTC(fecha, '00:00');
    const hasta = new Date(desde.getTime() + 24 * 3600 * 1000);

    const cobros = await sql`
      SELECT c.id, c.codigo, c.cobrado, c.metodo_pago, c.cobrado_en, c.total,
             cl.nombre AS cliente, p.id AS profesional_id, p.nombre AS profesional,
             p.comision,
             COALESCE(string_agg(s.nombre, ', ' ORDER BY s.nombre), '') AS servicios
        FROM cita c
        JOIN cliente cl ON cl.id = c.cliente_id
        JOIN profesional p ON p.id = c.profesional_id
        LEFT JOIN cita_servicio cs ON cs.cita_id = c.id
        LEFT JOIN servicio s ON s.id = cs.servicio_id
       WHERE c.cobrado_en >= ${desde.toISOString()} AND c.cobrado_en < ${hasta.toISOString()}
       GROUP BY c.id, cl.nombre, p.id, p.nombre, p.comision
       ORDER BY c.cobrado_en`;

    const total = cobros.reduce((t, c) => t + (c.cobrado || 0), 0);

    const porMetodo = {};
    const porProf = {};
    cobros.forEach(c => {
      porMetodo[c.metodo_pago] = (porMetodo[c.metodo_pago] || 0) + (c.cobrado || 0);
      const k = c.profesional_id;
      if (!porProf[k]) porProf[k] = { nombre: c.profesional, bruto: 0, comision: Number(c.comision), pagar: 0, cuantas: 0 };
      porProf[k].bruto += c.cobrado || 0;
      porProf[k].cuantas += 1;
      porProf[k].pagar = Math.round(porProf[k].bruto * porProf[k].comision);
    });

    return json(res, 200, { cobros, total, porMetodo, porProfesional: Object.values(porProf) });
  } catch (e) {
    console.error('caja', e);
    return json(res, 500, { error: 'No se pudo cargar la caja' });
  }
});

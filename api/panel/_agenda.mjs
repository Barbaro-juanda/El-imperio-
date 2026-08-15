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
    /* El profesional solo ve su propia columna y sus propias citas. El filtro
       va aquí y no en el navegador: ocultar filas en pantalla deja los datos
       viajando igual, y bastaría abrir la consola para leer los teléfonos de
       los clientes de los compañeros.

       Va ANTES de la consulta que lo usa. Estaba declarado después, y como
       `const` no se iza, cada petición moría con un ReferenceError y la agenda
       devolvía 500 sin enseñar una sola cita. */
    const soyProf = req.sesion.rol === 'profesional' ? req.sesion.profId : null;

    const desde = aUTC(fecha, '00:00');
    const hasta = new Date(desde.getTime() + 36 * 3600 * 1000); // cubre cierres pasada medianoche

    const citas = await sql`
      SELECT c.id, c.codigo, c.inicio, c.fin, c.estado, c.total, c.cobrado,
             c.metodo_pago, c.comprobante,
             cl.nombre AS cliente, cl.telefono,
             p.id AS profesional_id, p.nombre AS profesional,
             COALESCE(string_agg(s.nombre, ', ' ORDER BY s.nombre), '') AS servicios
        FROM cita c
        JOIN cliente cl ON cl.id = c.cliente_id
        JOIN profesional p ON p.id = c.profesional_id
        LEFT JOIN cita_servicio cs ON cs.cita_id = c.id
        LEFT JOIN servicio s ON s.id = cs.servicio_id
       WHERE c.inicio >= ${desde.toISOString()} AND c.inicio < ${hasta.toISOString()}
         AND (${soyProf}::int IS NULL OR c.profesional_id = ${soyProf})
       GROUP BY c.id, cl.nombre, cl.telefono, p.id, p.nombre
       ORDER BY c.inicio`;

    const bloqueos = await sql`
      SELECT id, profesional_id, inicio, fin, motivo FROM bloqueo
       WHERE inicio < ${hasta.toISOString()} AND fin > ${desde.toISOString()}
       ORDER BY inicio`;

    const profesionales = soyProf
      ? await sql`SELECT id, nombre FROM profesional WHERE activo AND id = ${soyProf}`
      : await sql`SELECT id, nombre FROM profesional WHERE activo ORDER BY nombre`;

    const dow = new Date(fecha + 'T12:00:00Z').getUTCDay();
    const hor = await sql`SELECT abre, cierra, abierto FROM horario WHERE dow = ${dow}`;

    const confirmadas = citas.filter(c => c.estado === 'confirmada' || c.estado === 'cumplida');

    /* Al profesional no se le enseña la caja del local sino lo que le queda a
       él: es lo suyo y es lo único que le sirve. */
    let comision = null;
    if (soyProf) {
      const r = await sql`SELECT comision FROM profesional WHERE id = ${soyProf}`;
      const pct = r[0] ? Number(r[0].comision) : 0;
      const cobrado = citas.reduce((t, c) => t + (c.cobrado || 0), 0);
      comision = { pct, cobrado, gana: Math.round(cobrado * pct) };
    }

    return json(res, 200, {
      rol: req.sesion.rol, comision,
      citas, bloqueos, profesionales,
      horario: hor[0] ? { abre: String(hor[0].abre).slice(0, 5),
                          cierra: String(hor[0].cierra).slice(0, 5),
                          abierto: hor[0].abierto }
                      : { abre: '09:00', cierra: '20:00', abierto: false },
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

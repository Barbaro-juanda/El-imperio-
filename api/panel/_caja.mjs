/* GET /api/panel/caja?fecha=YYYY-MM-DD
   El cuadre del día: qué entró, por qué medio y cuánto le toca a cada quien.

   Se calcula sobre `cobrado_en` y no sobre la hora de la cita: lo que cuadra
   una caja es cuándo entró el dinero, no cuándo estaba agendado el corte. */
import { sql, json, aUTC } from '../_db.mjs';
import { protegido } from '../_auth.mjs';
import { ventasDelRango } from './_inventario.mjs';

export default protegido(async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });
  /* Acepta un día suelto o un rango. El selector de periodo manda `desde` y
     `hasta`; la agenda sigue pidiendo un solo `fecha`. */
  const { fecha } = req.query;
  const d1 = req.query.desde || fecha;
  const d2 = req.query.hasta || fecha;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d1 || '') || !/^\d{4}-\d{2}-\d{2}$/.test(d2 || '')) {
    return json(res, 400, { error: 'fecha inválida' });
  }

  try {
    const desde = aUTC(d1, '00:00');
    const hasta = new Date(aUTC(d2, '00:00').getTime() + 24 * 3600 * 1000);

    const cobros = await sql`
      SELECT c.id, c.codigo, c.cobrado, c.metodo_pago, c.cobrado_en, c.total, c.comprobante,
             cl.nombre AS cliente, cl.telefono, p.id AS profesional_id, p.nombre AS profesional,
             p.comision,
             COALESCE(string_agg(s.nombre, ', ' ORDER BY s.nombre), '') AS servicios
        FROM cita c
        JOIN cliente cl ON cl.id = c.cliente_id
        JOIN profesional p ON p.id = c.profesional_id
        LEFT JOIN cita_servicio cs ON cs.cita_id = c.id
        LEFT JOIN servicio s ON s.id = cs.servicio_id
       WHERE c.cobrado_en >= ${desde.toISOString()} AND c.cobrado_en < ${hasta.toISOString()}
       GROUP BY c.id, cl.nombre, cl.telefono, p.id, p.nombre, p.comision
       ORDER BY c.cobrado_en`;

    /* La venta de productos entra a la misma caja: para el local es el mismo
       dinero del mismo día, y separarla en otra pantalla obligaría a sumar dos
       cifras a mano cada noche. Se marca de dónde viene para poder distinguir
       servicio de mostrador cuando interese. */
    /* Si el inventario todavía no existe —la migración que lo crea puede no
       haberse corrido— la consulta lanza. Va en su propio try para que eso no
       se lleve por delante el cuadre entero: el dinero de los servicios es lo
       que el local necesita ver todas las noches, y no puede depender de una
       tabla de productos que quizá no usa. Sin ventas de producto, cero. */
    let ventas = [];
    try {
      ventas = await ventasDelRango(d1, d2);
    } catch (e) {
      console.error('caja: sin inventario', e.message);
    }
    const totalProductos = ventas.reduce((t, v) => t + (v.total || 0), 0);
    const total = cobros.reduce((t, c) => t + (c.cobrado || 0), 0) + totalProductos;

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

    /* Las ventas suman al medio de pago igual que un cobro. En cambio NO
       suman a la comisión del profesional: la comisión es sobre el trabajo que
       hizo, y vender un frasco de la vitrina no es lo mismo que atender. Si el
       local decide comisionar la venta, se cambia aquí. */
    ventas.forEach(v => {
      porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] || 0) + (v.total || 0);
    });

    return json(res, 200, { cobros, total, porMetodo, porProfesional: Object.values(porProf),
                            ventas, totalProductos, totalServicios: total - totalProductos,
                            desde: d1, hasta: d2 });
  } catch (e) {
    console.error('caja', e);
    return json(res, 500, { error: 'No se pudo cargar la caja' });
  }
}, { soloDueno: true });

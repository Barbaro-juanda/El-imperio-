/* GET    /api/panel/finanzas?desde=…&hasta=…  → el cuadre del periodo
   POST   /api/panel/finanzas { movimiento }    → anota un ingreso o un egreso
   DELETE /api/panel/finanzas?id=3              → lo borra

   Solo el dueño: aquí está lo que gana y lo que gasta el negocio.

   Junta las tres fuentes de dinero que ya existían por separado —los cobros de
   las citas, las ventas del inventario y lo que se anota a mano— y las resta.
   Hasta ahora el panel sabía lo que entra pero no lo que sale, y con media
   ecuación la caja del día dice cuánto se facturó, no cuánto se ganó. */
import { sql, json, aUTC } from '../_db.mjs';
import { protegido } from '../_auth.mjs';
import { ventasDelRango } from './_inventario.mjs';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default protegido(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const d1 = FECHA.test(req.query.desde || '') ? req.query.desde : null;
      const d2 = FECHA.test(req.query.hasta || '') ? req.query.hasta : d1;
      if (!d1) return json(res, 400, { error: 'Falta el rango de fechas' });

      const desde = aUTC(d1, '00:00');
      const hasta = new Date(aUTC(d2, '00:00').getTime() + 24 * 3600 * 1000);

      /* --- lo que entra por servicios --- */
      const servicios = await sql`
        SELECT COALESCE(sum(cobrado), 0)::int AS total, count(*)::int AS cuantas
          FROM cita
         WHERE cobrado IS NOT NULL
           AND cobrado_en >= ${desde.toISOString()} AND cobrado_en < ${hasta.toISOString()}`;

      /* --- lo que entra por productos --- */
      let productos = { total: 0, cuantas: 0 };
      try {
        const v = await ventasDelRango(d1, d2);
        productos = {
          total: v.reduce((t, x) => t + (x.total || 0), 0),
          cuantas: v.length
        };
      } catch (e) { /* sin inventario todavía */ }

      /* --- lo anotado a mano --- */
      let manuales = [];
      try {
        manuales = await sql`
          SELECT f.id, f.tipo, f.concepto, f.monto, f.fecha, f.categoria, f.nota,
                 p.nombre AS profesional
            FROM finanza f
            LEFT JOIN profesional p ON p.id = f.profesional_id
           WHERE f.fecha >= ${d1} AND f.fecha <= ${d2}
           ORDER BY f.fecha DESC, f.id DESC`;
      } catch (e) {
        if (!/relation .* does not exist/i.test(e.message || '')) throw e;
      }

      const otrosIngresos = manuales.filter(m => m.tipo === 'ingreso')
        .reduce((t, m) => t + m.monto, 0);
      const egresos = manuales.filter(m => m.tipo === 'egreso')
        .reduce((t, m) => t + m.monto, 0);

      const ingresos = servicios[0].total + productos.total + otrosIngresos;

      /* Por categoría, para saber en qué se va el dinero. Sin categoría se
         agrupan bajo «Sin clasificar» en vez de desaparecer del desglose. */
      const porCategoria = {};
      manuales.filter(m => m.tipo === 'egreso').forEach(m => {
        const k = m.categoria || 'Sin clasificar';
        porCategoria[k] = (porCategoria[k] || 0) + m.monto;
      });

      /* La meta vive en ajustes, y es diaria: para un periodo se multiplica por
         los días que abarca. Comparar un mes contra la meta de un día no dice
         nada. */
      let meta = 0;
      try {
        const r = await sql`SELECT valor FROM ajuste WHERE clave = 'meta_diaria'`;
        if (r.length) meta = Number(r[0].valor) || 0;
      } catch (e) { /* sin tabla de ajustes */ }

      const dias = Math.max(1, Math.round((hasta - desde) / (24 * 3600 * 1000)));

      return json(res, 200, {
        rango: { desde: d1, hasta: d2, dias },
        ingresos: {
          total: ingresos,
          servicios: servicios[0].total,
          productos: productos.total,
          otros: otrosIngresos,
          citas: servicios[0].cuantas,
          ventas: productos.cuantas
        },
        egresos: { total: egresos, porCategoria },
        /* La cifra que de verdad se busca. Puede ser negativa, y si lo es hay
           que verlo: esconder un mes en rojo detrás de un cero no ayuda. */
        neto: ingresos - egresos,
        meta: { diaria: meta, periodo: meta * dias },
        movimientos: manuales
      });
    }

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (req.method === 'POST' && b.movimiento) {
      const m = b.movimiento;
      if (m.tipo !== 'ingreso' && m.tipo !== 'egreso') {
        return json(res, 400, { error: 'Tiene que ser ingreso o egreso' });
      }
      const concepto = String(m.concepto || '').trim();
      if (!concepto) {
        return json(res, 400, {
          error: 'Escribe qué fue. Una cifra sin nombre no le dice nada a nadie dentro de tres meses.'
        });
      }
      const monto = Math.round(Number(m.monto));
      if (!Number.isFinite(monto) || monto < 0) return json(res, 400, { error: 'Monto no válido' });
      const fecha = FECHA.test(m.fecha || '') ? m.fecha : null;

      const r = await sql`
        INSERT INTO finanza (tipo, concepto, monto, fecha, categoria, nota, profesional_id)
        VALUES (${m.tipo}, ${concepto}, ${monto},
                COALESCE(${fecha}::date, CURRENT_DATE),
                ${m.categoria || null}, ${m.nota || null},
                ${req.sesion.profId || null})
        RETURNING id`;
      return json(res, 201, { id: r[0].id });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'id no válido' });
      /* Solo se borra lo anotado a mano. Un cobro de cita o una venta de
         producto no se tocan desde aquí: tienen su propio sitio y borrarlos
         descuadraría la caja de un día ya cerrado. */
      const r = await sql`DELETE FROM finanza WHERE id = ${id} RETURNING id`;
      if (!r.length) return json(res, 404, { error: 'Ese movimiento no existe' });
      return json(res, 200, { id });
    }

    return json(res, 405, { error: 'Método no admitido' });
  } catch (e) {
    if (/relation .* does not exist/i.test(e.message || '')) {
      return json(res, 200, { sinTablas: true });
    }
    console.error('finanzas', e);
    return json(res, 500, { error: 'No se pudo cargar las finanzas' });
  }
}, { soloDueno: true });

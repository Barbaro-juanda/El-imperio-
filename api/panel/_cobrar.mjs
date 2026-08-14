/* POST /api/panel/cobrar { cita_id, cobrado, metodo_pago }
   Cierra la cita y registra lo que entró en caja.

   OJO: esto NO es facturación electrónica. Una factura ante la DIAN exige
   numeración autorizada, firma y envío, y nada de eso ocurre aquí. Es el
   registro interno con el que se cuadra el día y se liquidan comisiones. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];

export default protegido(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Solo POST' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  if (!b.cita_id) return json(res, 400, { error: 'Falta la cita' });
  if (METODOS.indexOf(b.metodo_pago) === -1) return json(res, 400, { error: 'Forma de pago no válida' });
  const cobrado = Math.round(Number(b.cobrado));
  if (!Number.isFinite(cobrado) || cobrado < 0) return json(res, 400, { error: 'El valor cobrado no es válido' });

  try {
    /* `total` no se toca: es lo que valía al reservar. `cobrado` es lo que
       entró. Difieren cuando hay descuento, propina o un servicio que se
       alargó, y machacar el original perdería la referencia. */
    const r = await sql`
      UPDATE cita
         SET estado = 'cumplida', cobrado = ${cobrado},
             metodo_pago = ${b.metodo_pago}, cobrado_en = now()
       WHERE id = ${b.cita_id}
       RETURNING id, cobrado, metodo_pago`;
    if (!r.length) return json(res, 404, { error: 'Esa cita no existe' });
    return json(res, 200, r[0]);
  } catch (e) {
    console.error('cobrar', e);
    return json(res, 500, { error: 'No se pudo registrar el cobro' });
  }
});

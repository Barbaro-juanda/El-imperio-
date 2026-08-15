/* POST /api/panel/cobrar { cita_id, cobrado, metodo_pago }
   Cierra la cita y registra lo que entró en caja.

   OJO: esto NO es facturación electrónica. Una factura ante la DIAN exige
   numeración autorizada, firma y envío, y nada de eso ocurre aquí. Es el
   registro interno con el que se cuadra el día y se liquidan comisiones. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];

/* Tope del comprobante ya comprimido. El navegador reduce la foto antes de
   enviarla; esto es la red de seguridad para que una petición armada a mano no
   meta diez megas en una fila. */
const TOPE_COMPROBANTE = 900 * 1024;

export default protegido(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Solo POST' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  if (!b.cita_id) return json(res, 400, { error: 'Falta la cita' });
  if (METODOS.indexOf(b.metodo_pago) === -1) return json(res, 400, { error: 'Forma de pago no válida' });
  const cobrado = Math.round(Number(b.cobrado));
  if (!Number.isFinite(cobrado) || cobrado < 0) return json(res, 400, { error: 'El valor cobrado no es válido' });

  /* La transferencia exige comprobante. Es la única forma de pago que no deja
     rastro físico en el local: sin la foto, al cuadrar el día no hay manera de
     saber si ese dinero entró. */
  const comprobante = b.comprobante || null;
  if (b.metodo_pago === 'transferencia' && !comprobante) {
    return json(res, 400, { error: 'Adjunta la foto del comprobante para registrar una transferencia' });
  }
  if (comprobante) {
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(comprobante)) {
      return json(res, 400, { error: 'El comprobante debe ser una imagen' });
    }
    if (comprobante.length > TOPE_COMPROBANTE) {
      return json(res, 400, { error: 'La foto pesa demasiado. Vuelve a tomarla.' });
    }
  }

  try {
    /* `total` no se toca: es lo que valía al reservar. `cobrado` es lo que
       entró. Difieren cuando hay descuento, propina o un servicio que se
       alargó, y machacar el original perdería la referencia. */
    const r = await sql`
      UPDATE cita
         SET estado = 'cumplida', cobrado = ${cobrado},
             metodo_pago = ${b.metodo_pago}, cobrado_en = now(),
             comprobante = COALESCE(${comprobante}, comprobante)
       WHERE id = ${b.cita_id}
       RETURNING id, cobrado, metodo_pago`;
    if (!r.length) return json(res, 404, { error: 'Esa cita no existe' });
    return json(res, 200, r[0]);
  } catch (e) {
    console.error('cobrar', e);
    return json(res, 500, { error: 'No se pudo registrar el cobro' });
  }
});

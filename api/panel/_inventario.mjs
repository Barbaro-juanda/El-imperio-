/* GET   /api/panel/inventario                → productos y últimos movimientos
   POST  /api/panel/inventario  { venta }     → vende y descuenta del stock
                                { producto }  → crea un producto      (dueño)
                                { entrada }   → registra mercancía    (dueño)
   PATCH /api/panel/inventario  { producto }  → precio, mínimo, activo (dueño)
   DELETE /api/panel/inventario { id }        → lo borra si nunca se vendió (dueño)

   Vender lo puede hacer cualquiera: el barbero le vende la cera al cliente en
   la silla y no tiene sentido que tenga que ir a buscar al administrador. Lo
   que toca el catálogo y las existencias sí es del dueño. */
import { sql, json, aUTC } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

const MEDIOS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];
const TOPE_COMPROBANTE = 900 * 1024;

function idDesde(nombre) {
  return String(nombre)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/* Misma comprobación que en los cobros de citas: solo imagen y con un tope,
   porque esto va a una columna de texto y no a un almacén de archivos. */
function revisaComprobante(valor) {
  if (!valor) return null;
  const s = String(valor);
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(s)) return 'El comprobante debe ser una imagen';
  if (s.length > TOPE_COMPROBANTE) return 'La foto pesa demasiado, vuelve a tomarla';
  return null;
}

async function listar() {
  const productos = await sql`
    SELECT id, nombre, marca, descripcion, precio, costo, existencias, minimo, activo
      FROM producto ORDER BY activo DESC, nombre`;
  /* Los últimos movimientos son el «qué pasó aquí» que se mira cuando el
     conteo físico no cuadra. Se limitan porque nadie revisa más que eso. */
  const movimientos = await sql`
    SELECT m.id, m.producto_id, m.tipo, m.cantidad, m.total, m.metodo_pago, m.nota, m.creado,
           p.nombre AS producto, pr.nombre AS profesional
      FROM movimiento m
      JOIN producto p ON p.id = m.producto_id
      LEFT JOIN profesional pr ON pr.id = m.profesional_id
     ORDER BY m.creado DESC LIMIT 40`;
  return { productos, movimientos };
}

export default protegido(async (req, res) => {
  const esDueno = req.sesion.rol === 'dueno';
  try {
    if (req.method === 'GET') {
      try {
        return json(res, 200, await listar());
      } catch (e) {
        /* Si las tablas no existen, decirlo. El error crudo de Postgres —
           «relation "producto" does not exist»— no le dice nada a quien abre
           el panel, y el mensaje genérico «no se pudo guardar» hace pensar en
           un fallo pasajero que se arregla recargando. */
        if (/relation .* does not exist/i.test(e.message || '')) {
          return json(res, 200, { productos: [], movimientos: [], sinTablas: true });
        }
        throw e;
      }
    }

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    /* ---------------- venta ---------------- */
    if (req.method === 'POST' && b.venta) {
      const v = b.venta;
      const cant = Math.round(Number(v.cantidad));
      if (!v.producto_id) return json(res, 400, { error: 'Falta el producto' });
      if (!Number.isFinite(cant) || cant < 1 || cant > 999) {
        return json(res, 400, { error: 'La cantidad no es válida' });
      }
      if (!MEDIOS.includes(v.metodo_pago)) return json(res, 400, { error: 'Medio de pago no válido' });

      const comprobante = v.comprobante || null;
      if (v.metodo_pago === 'transferencia' && !comprobante) {
        return json(res, 400, { error: 'Adjunta la foto del comprobante para registrar una transferencia' });
      }
      const malo = revisaComprobante(comprobante);
      if (malo) return json(res, 400, { error: malo });

      /* El descuento y la comprobación de que alcanza van en la MISMA
         sentencia. Si se leyera el stock, se decidiera en JavaScript y luego
         se restara, dos ventas simultáneas del último frasco pasarían las dos
         y el inventario quedaría en negativo. Aquí la que llega segunda no
         actualiza ninguna fila y se entera. */
      const filas = await sql`
        UPDATE producto SET existencias = existencias - ${cant}
         WHERE id = ${v.producto_id} AND activo AND existencias >= ${cant}
         RETURNING id, nombre, precio, existencias`;

      if (!filas.length) {
        const hay = await sql`SELECT nombre, existencias, activo FROM producto WHERE id = ${v.producto_id}`;
        if (!hay.length) return json(res, 404, { error: 'Ese producto no existe' });
        if (!hay[0].activo) return json(res, 409, { error: 'Ese producto está archivado' });
        return json(res, 409, {
          error: 'Solo quedan ' + hay[0].existencias + ' de ' + hay[0].nombre,
          existencias: hay[0].existencias
        });
      }

      const p = filas[0];
      /* El precio de venta se puede cambiar en el momento —un descuento al
         cliente de siempre—, pero nunca se guarda un total que no cuadre con
         la cantidad por el unitario. */
      const unit = v.precio_unit === undefined || v.precio_unit === null || v.precio_unit === ''
        ? p.precio : Math.round(Number(v.precio_unit));
      if (!Number.isFinite(unit) || unit < 0) return json(res, 400, { error: 'Precio no válido' });

      /* Un profesional solo puede apuntarse a sí mismo la venta; el dueño
         puede atribuírsela a quien la hizo. */
      const profId = esDueno
        ? (v.profesional_id ? Number(v.profesional_id) : null)
        : req.sesion.profId;

      const m = await sql`
        INSERT INTO movimiento (producto_id, tipo, cantidad, precio_unit, total,
                                metodo_pago, comprobante, profesional_id)
        VALUES (${p.id}, 'venta', ${-cant}, ${unit}, ${unit * cant},
                ${v.metodo_pago}, ${comprobante}, ${profId})
        RETURNING id, creado`;

      return json(res, 201, { id: m[0].id, total: unit * cant, quedan: p.existencias, nombre: p.nombre });
    }

    if (!esDueno) return json(res, 403, { error: 'Solo el administrador puede tocar el inventario' });

    /* ---------------- alta de producto ---------------- */
    if (req.method === 'POST' && b.producto) {
      const p = b.producto;
      const nombre = String(p.nombre || '').trim();
      if (!nombre) return json(res, 400, { error: 'El producto necesita un nombre' });

      const precio = Math.round(Number(p.precio));
      if (!Number.isFinite(precio) || precio < 0) return json(res, 400, { error: 'Precio no válido' });
      const costo = p.costo === null || p.costo === '' || p.costo === undefined
        ? null : Math.round(Number(p.costo));
      if (costo !== null && (!Number.isFinite(costo) || costo < 0)) {
        return json(res, 400, { error: 'Costo no válido' });
      }
      const existencias = Math.max(0, Math.round(Number(p.existencias) || 0));
      const minimo = Math.max(0, Math.round(Number(p.minimo) || 0));

      const id = idDesde(nombre);
      if (!id) return json(res, 400, { error: 'Ese nombre no deja construir un identificador' });
      const ya = await sql`SELECT 1 FROM producto WHERE id = ${id}`;
      if (ya.length) return json(res, 409, { error: 'Ya existe un producto con ese nombre' });

      await sql`
        INSERT INTO producto (id, nombre, marca, descripcion, precio, costo, existencias, minimo)
        VALUES (${id}, ${nombre}, ${p.marca || null}, ${p.descripcion || null},
                ${precio}, ${costo}, ${existencias}, ${minimo})`;

      /* El stock inicial entra como movimiento y no solo como número suelto:
         si no, el historial arrancaría con un saldo que nadie sabe de dónde
         salió. */
      if (existencias > 0) {
        await sql`
          INSERT INTO movimiento (producto_id, tipo, cantidad, nota)
          VALUES (${id}, 'entrada', ${existencias}, 'Existencias iniciales')`;
      }
      return json(res, 201, { id });
    }

    /* ---------------- entrada de mercancía y conteo ---------------- */
    if (req.method === 'POST' && b.entrada) {
      const e = b.entrada;
      const cant = Math.round(Number(e.cantidad));
      if (!e.producto_id) return json(res, 400, { error: 'Falta el producto' });
      if (!Number.isFinite(cant) || cant === 0 || Math.abs(cant) > 9999) {
        return json(res, 400, { error: 'La cantidad no es válida' });
      }
      const tipo = e.tipo === 'ajuste' ? 'ajuste' : 'entrada';

      const filas = await sql`
        UPDATE producto SET existencias = existencias + ${cant}
         WHERE id = ${e.producto_id} AND existencias + ${cant} >= 0
         RETURNING id, nombre, existencias`;
      if (!filas.length) {
        return json(res, 409, { error: 'No se puede: el inventario quedaría en negativo' });
      }
      await sql`
        INSERT INTO movimiento (producto_id, tipo, cantidad, nota)
        VALUES (${e.producto_id}, ${tipo}, ${cant}, ${e.nota || null})`;
      return json(res, 201, { quedan: filas[0].existencias, nombre: filas[0].nombre });
    }

    /* ---------------- editar producto ---------------- */
    if (req.method === 'PATCH' && b.producto) {
      const p = b.producto;
      if (!p.id) return json(res, 400, { error: 'Falta el producto' });
      const precio = Math.round(Number(p.precio));
      if (!Number.isFinite(precio) || precio < 0) return json(res, 400, { error: 'Precio no válido' });
      const costo = p.costo === null || p.costo === '' || p.costo === undefined
        ? null : Math.round(Number(p.costo));
      if (costo !== null && (!Number.isFinite(costo) || costo < 0)) {
        return json(res, 400, { error: 'Costo no válido' });
      }
      const minimo = Math.max(0, Math.round(Number(p.minimo) || 0));

      /* Las existencias NO se editan por aquí. Cambiarlas es un movimiento
         —llegó mercancía o el conteo no cuadra— y tiene que quedar registrado
         como tal; si se pudieran sobrescribir a mano, el historial dejaría de
         explicar el saldo. */
      const r = await sql`
        UPDATE producto
           SET precio = ${precio}, costo = ${costo}, minimo = ${minimo},
               marca = ${p.marca === undefined ? null : p.marca},
               descripcion = COALESCE(${p.descripcion === undefined ? null : p.descripcion}, descripcion),
               activo = ${p.activo !== false}
         WHERE id = ${p.id} RETURNING id, precio, existencias, activo`;
      if (!r.length) return json(res, 404, { error: 'Ese producto no existe' });
      return json(res, 200, r[0]);
    }

    /* ---------------- eliminar producto ---------------- */
    if (req.method === 'DELETE') {
      const id = b.id || req.query.id;
      if (!id) return json(res, 400, { error: 'Falta el producto' });

      const hay = await sql`SELECT nombre FROM producto WHERE id = ${id}`;
      if (!hay.length) return json(res, 404, { error: 'Ese producto no existe' });

      /* Si se vendió alguna vez, no se borra. Esas ventas son dinero que entró
         un día concreto y ya está sumado en la caja de ese día: quitarlas haría
         que un cuadre cerrado la semana pasada devolviera otra cifra hoy, sin
         que nadie tocara nada. Para eso está archivar, que lo saca de la vista
         y deja el histórico en pie. */
      const ventas = await sql`
        SELECT count(*)::int AS n FROM movimiento WHERE producto_id = ${id} AND tipo = 'venta'`;
      if (ventas[0].n > 0) {
        return json(res, 409, {
          error: hay[0].nombre + ' ya se vendió ' + ventas[0].n +
                 (ventas[0].n === 1 ? ' vez' : ' veces') +
                 ', así que borrarlo cambiaría cajas ya cerradas. Archívalo.',
          archivar: true
        });
      }

      /* Entradas y correcciones sí se van con él: son el conteo interno de un
         producto que nunca llegó a vender nada, y sin el producto no explican
         ya nada de la caja. */
      await sql`DELETE FROM movimiento WHERE producto_id = ${id}`;
      await sql`DELETE FROM producto WHERE id = ${id}`;
      return json(res, 200, { id, nombre: hay[0].nombre });
    }

    return json(res, 405, { error: 'Nada que hacer' });
  } catch (e) {
    console.error('inventario', e);
    return json(res, 500, { error: 'No se pudo guardar' });
  }
});

/* Ventas de producto de un rango, para que la caja del día las sume. Vive aquí
   y no en _caja.mjs para que la forma de la tabla la conozca un solo archivo. */
export async function ventasDelRango(d1, d2) {
  const desde = aUTC(d1, '00:00');
  const hasta = new Date(aUTC(d2, '00:00').getTime() + 24 * 3600 * 1000);
  return sql`
    SELECT m.id, m.cantidad, m.precio_unit, m.total, m.metodo_pago, m.comprobante, m.creado,
           p.nombre AS producto, pr.id AS profesional_id, pr.nombre AS profesional
      FROM movimiento m
      JOIN producto p ON p.id = m.producto_id
      LEFT JOIN profesional pr ON pr.id = m.profesional_id
     WHERE m.tipo = 'venta' AND m.creado >= ${desde.toISOString()} AND m.creado < ${hasta.toISOString()}
     ORDER BY m.creado`;
}

/* GET    /api/panel/galeria              → lo que hay, para administrarlo
   POST   /api/panel/galeria { foto }     → sube una
   PATCH  /api/panel/galeria { id, ... }  → cambia su texto o la mueve
   DELETE /api/panel/galeria?id=3         → la quita

   Solo el dueño: la galería es la cara del negocio. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

/* Una foto de galería se ve grande —ocupa media pantalla al ampliarla—, así que
   admite más peso que un comprobante. Pero sigue habiendo tope: cada una se
   guarda en la base y se sirve a cada visitante, y una sin comprimir de un
   celular moderno son ocho megas. El navegador ya la encoge a 1400 px antes de
   mandarla; esto es la red por si eso falla. */
const TOPE = 900 * 1024;

function parte(dataUrl) {
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  return { mime: m[1] === 'image/jpg' ? 'image/jpeg' : m[1], datos: m[2] };
}

export default protegido(async (req, res) => {
  try {
    if (req.method === 'GET') {
      /* Sin `datos` tampoco aquí: el panel enseña las miniaturas pidiendo cada
         imagen por su URL, igual que la página. Traerlas todas en el JSON haría
         que abrir la sección descargara la galería entera de golpe. */
      const filas = await sql`
        SELECT id, alt, orden, activo, actualizado,
               length(datos) AS peso
          FROM galeria ORDER BY orden, id`;
      return json(res, 200, {
        fotos: filas.map(f => ({
          id: f.id, alt: f.alt, orden: f.orden, activo: f.activo,
          /* Aproximado: base64 abulta un tercio sobre los bytes reales. */
          kb: Math.round(Number(f.peso) * 0.75 / 1024),
          url: '/api/galeria?img=' + f.id + '&v=' + Date.parse(f.actualizado)
        }))
      });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'id no válido' });
      /* Se borra de verdad, no se archiva. Una foto de galería no es un dato
         del negocio: no hay histórico que se descuadre por quitarla, y dejarla
         ocupando espacio en la base «por si acaso» no le sirve a nadie. */
      const r = await sql`DELETE FROM galeria WHERE id = ${id} RETURNING id`;
      if (!r.length) return json(res, 404, { error: 'Esa foto no existe' });
      return json(res, 200, { id });
    }

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (req.method === 'POST') {
      const p = parte(b.foto);
      if (!p) return json(res, 400, { error: 'Eso no es una imagen' });
      if (p.datos.length > TOPE) {
        return json(res, 400, { error: 'La foto pesa demasiado, vuelve a elegirla' });
      }
      const alt = String(b.alt || '').trim();
      if (!alt) {
        return json(res, 400, {
          error: 'Describe la foto en una línea: es lo que lee quien no puede verla'
        });
      }

      /* Al final de la fila, con hueco de sobra para poder colar otra en medio
         más adelante sin renumerar nada. */
      const ult = await sql`SELECT COALESCE(max(orden), 0) AS n FROM galeria`;
      const r = await sql`
        INSERT INTO galeria (mime, datos, alt, orden)
        VALUES (${p.mime}, ${p.datos}, ${alt}, ${Number(ult[0].n) + 10})
        RETURNING id`;
      return json(res, 201, { id: r[0].id });
    }

    if (req.method === 'PATCH') {
      const id = Number(b.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'id no válido' });

      /* Mover: se intercambia el orden con la vecina en esa dirección. Es más
         simple que arrastrar y funciona igual con el dedo, que es como se va a
         usar esto —el dueño subiendo fotos desde el celular—. */
      if (b.mover === 'antes' || b.mover === 'despues') {
        const yo = await sql`SELECT id, orden FROM galeria WHERE id = ${id}`;
        if (!yo.length) return json(res, 404, { error: 'Esa foto no existe' });
        const vecina = b.mover === 'antes'
          ? await sql`SELECT id, orden FROM galeria WHERE orden < ${yo[0].orden}
                       ORDER BY orden DESC, id DESC LIMIT 1`
          : await sql`SELECT id, orden FROM galeria WHERE orden > ${yo[0].orden}
                       ORDER BY orden ASC, id ASC LIMIT 1`;
        if (!vecina.length) return json(res, 200, { id, sinMovimiento: true });
        await sql`UPDATE galeria SET orden = ${vecina[0].orden} WHERE id = ${id}`;
        await sql`UPDATE galeria SET orden = ${yo[0].orden} WHERE id = ${vecina[0].id}`;
        return json(res, 200, { id });
      }

      if (b.alt !== undefined) {
        const alt = String(b.alt).trim();
        if (!alt) return json(res, 400, { error: 'La descripción no puede quedar vacía' });
        await sql`UPDATE galeria SET alt = ${alt} WHERE id = ${id}`;
        return json(res, 200, { id });
      }

      return json(res, 400, { error: 'Nada que cambiar' });
    }

    return json(res, 405, { error: 'Método no admitido' });
  } catch (e) {
    if (/relation .* does not exist/i.test(e.message || '')) {
      return json(res, 200, { fotos: [], sinTablas: true });
    }
    console.error('galeria panel', e);
    return json(res, 500, { error: 'No se pudo guardar' });
  }
}, { soloDueno: true });

/* GET /api/galeria            → la lista, sin las imágenes
   GET /api/galeria?img=3&v=…  → esa imagen, como imagen

   Dos rutas y no una porque son dos cosas distintas. La lista es un puñado de
   bytes que cambia cuando el local sube una foto; las imágenes pesan cientos de
   kilobytes y no cambian nunca —al reemplazar una, cambia su `v` y por tanto su
   dirección—.

   Esa separación es la razón de que la galería no vaya dentro de /api/catalogo.
   Metidas ahí, las fotos se descargarían enteras, en base64 y sin poder
   cachearse, en cada visita y por delante del flujo de reserva. Servidas aparte
   se descargan una vez y el navegador no las vuelve a pedir. */
import { sql, json } from './_db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });

  /* ---------- el retrato de alguien del equipo ----------
     Vive aquí y no en su propia ruta porque hace exactamente lo mismo que una
     foto de galería —sacar bytes de la base y servirlos cacheados— y cada
     archivo bajo /api cuenta contra el tope de doce funciones.

     Existe porque la foto se guardaba incrustada en el catálogo: 44 KB de
     base64 que TODO visitante descargaba, sin poder cachearse, por delante del
     flujo de reserva. Con cuatro retratos habrían sido 180 KB en la ruta que
     más importa. Servida aparte se descarga una vez y el navegador no la vuelve
     a pedir. */
  if (req.query.prof !== undefined) {
    const n = Number(req.query.prof);
    if (!Number.isInteger(n) || n < 1) return json(res, 400, { error: 'id no válido' });
    try {
      const r = await sql`SELECT foto FROM profesional WHERE id = ${n} AND activo`;
      const foto = r.length ? String(r[0].foto || '') : '';
      const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(foto);
      if (!m) return json(res, 404, { error: 'Sin foto' });

      const cuerpo = Buffer.from(m[2], 'base64');
      res.setHeader('Content-Type', m[1]);
      res.setHeader('Content-Length', cuerpo.length);
      /* La dirección lleva un resumen de la propia foto: si la cambian desde el
         panel cambia la dirección, así que se puede prometer un año. */
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.status(200).send(cuerpo);
    } catch (e) {
      console.error('galeria prof', e);
      return json(res, 500, { error: 'No se pudo cargar la foto' });
    }
    return;
  }

  const id = req.query.img;

  /* ---------- una imagen ---------- */
  if (id !== undefined) {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1) return json(res, 400, { error: 'id no válido' });
    try {
      const r = await sql`SELECT mime, datos FROM galeria WHERE id = ${n} AND activo`;
      if (!r.length) return json(res, 404, { error: 'No existe' });

      const cuerpo = Buffer.from(r[0].datos, 'base64');
      res.setHeader('Content-Type', r[0].mime);
      res.setHeader('Content-Length', cuerpo.length);
      /* Un año e inmutable. Se puede prometer eso porque la dirección lleva la
         marca de tiempo de la foto: si el local la reemplaza, la dirección deja
         de ser esta y nadie sirve la vieja. */
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.status(200).send(cuerpo);
    } catch (e) {
      console.error('galeria img', e);
      return json(res, 500, { error: 'No se pudo cargar la imagen' });
    }
    return;
  }

  /* ---------- la lista ---------- */
  try {
    /* Sin `datos`: es lo que hace que esta respuesta pese menos de un kilobyte
       aunque la galería tenga veinte fotos de medio mega. */
    const filas = await sql`
      SELECT id, alt, orden, actualizado, mime
        FROM galeria WHERE activo ORDER BY orden, id`;

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify({
      fotos: filas.map(f => ({
        id: f.id,
        alt: f.alt,
        /* La página necesita saberlo antes de pedir el archivo: una foto va en
           <img> y un video en <video>, y no se puede decidir mirando los bytes
           cuando ya han llegado. */
        video: String(f.mime || '').indexOf('video/') === 0,
        /* La dirección se arma aquí y no en el navegador para que el `v` salga
           del mismo sitio que el dato: si se calculara fuera, un despiste
           dejaría a todo el mundo viendo la foto vieja durante un año. */
        url: '/api/galeria?img=' + f.id + '&v=' + Date.parse(f.actualizado)
      }))
    }));
  } catch (e) {
    /* Si la tabla no existe todavía, no es un error: es una migración sin
       correr. La página se queda con las fotos que trae escritas. */
    if (/relation .* does not exist/i.test(e.message || '')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).send(JSON.stringify({ fotos: [] }));
      return;
    }
    console.error('galeria', e);
    return json(res, 500, { error: 'No se pudo cargar la galería' });
  }
}

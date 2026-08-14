/* POST /api/panel/entrar { clave }  → abre sesión
   DELETE                            → la cierra
   GET                               → quién soy

   Una sola puerta para los dos paneles: la clave decide cuál se abre. El
   dueño tiene la suya en el entorno; cada profesional la suya, guardada como
   hash en su fila.

   Se prueba primero la del dueño y después las de los profesionales. Siempre
   se recorren TODAS aunque una acierte: si se cortara en la primera
   coincidencia, el tiempo de respuesta diría cuántas se llegaron a comparar. */
import crypto from 'node:crypto';
import { sql, json } from '../_db.mjs';
import { crearSesion, ponerCookie, borrarCookie, leerCookie, leerSesion, COOKIE } from '../_auth.mjs';
import { verificaClave } from '../_hash.mjs';

export default async function handler(req, res) {
  const secreto = process.env.PANEL_SECRETO;

  if (req.method === 'DELETE') { borrarCookie(res); return json(res, 200, { ok: true }); }

  if (req.method === 'GET') {
    const s = leerSesion(leerCookie(req, COOKIE), secreto);
    if (!s) return json(res, 401, { error: 'Sesión no válida' });
    let nombre = null;
    if (s.profId) {
      const r = await sql`SELECT nombre FROM profesional WHERE id = ${s.profId}`;
      nombre = r[0] ? r[0].nombre : null;
    }
    return json(res, 200, { rol: s.rol, profId: s.profId, nombre });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Solo POST' });

  const claveDueno = process.env.PANEL_CLAVE;
  if (!claveDueno || !secreto) return json(res, 500, { error: 'Panel sin configurar' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const dada = String(b.clave || '');

  try {
    const a = crypto.createHash('sha256').update(dada).digest();
    const c = crypto.createHash('sha256').update(claveDueno).digest();
    let acierto = crypto.timingSafeEqual(a, c) ? { rol: 'dueno', profId: null } : null;

    const profs = await sql`
      SELECT id, nombre, clave_hash FROM profesional WHERE activo AND clave_hash IS NOT NULL`;
    for (const p of profs) {
      if (verificaClave(dada, p.clave_hash) && !acierto) acierto = { rol: 'profesional', profId: p.id, nombre: p.nombre };
    }

    if (!acierto) {
      /* Sin almacén no hay límite de intentos real, pero medio segundo por
         intento hace inviable probar claves a lo bruto. */
      await new Promise(r => setTimeout(r, 500));
      return json(res, 401, { error: 'Clave incorrecta' });
    }

    ponerCookie(res, crearSesion(secreto, acierto.rol, acierto.profId));
    return json(res, 200, { rol: acierto.rol, profId: acierto.profId, nombre: acierto.nombre || null });
  } catch (e) {
    console.error('entrar', e);
    return json(res, 500, { error: 'No se pudo entrar' });
  }
}

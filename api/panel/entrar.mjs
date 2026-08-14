/* POST /api/panel/entrar { clave }  → abre sesión
   DELETE                            → la cierra */
import crypto from 'node:crypto';
import { json } from '../_db.mjs';
import { crearSesion, ponerCookie, borrarCookie } from '../_auth.mjs';

export default async function handler(req, res) {
  if (req.method === 'DELETE') { borrarCookie(res); return json(res, 200, { ok: true }); }
  if (req.method !== 'POST')   return json(res, 405, { error: 'Solo POST' });

  const clave = process.env.PANEL_CLAVE;
  const secreto = process.env.PANEL_SECRETO;
  if (!clave || !secreto) return json(res, 500, { error: 'Panel sin configurar' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const dada = String(b.clave || '');

  /* Comparación de tiempo constante y sobre longitudes iguales: con === el
     tiempo de fallo revela cuántos caracteres iniciales acertó. */
  const a = crypto.createHash('sha256').update(dada).digest();
  const c = crypto.createHash('sha256').update(clave).digest();
  if (!crypto.timingSafeEqual(a, c)) {
    /* Freno pequeño: sin almacén no hay límite de intentos real, pero medio
       segundo por intento hace inviable probar claves a lo bruto. */
    await new Promise(r => setTimeout(r, 500));
    return json(res, 401, { error: 'Clave incorrecta' });
  }

  ponerCookie(res, crearSesion(secreto));
  return json(res, 200, { ok: true });
}

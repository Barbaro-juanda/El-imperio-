/* Sesión del panel.

   El panel enseña nombres y teléfonos de clientes, así que no puede quedar
   abierto. No hay cuentas por persona: el local es pequeño y una clave
   compartida basta, pero se guarda fuera del repositorio y la cookie va
   firmada para que nadie se fabrique una sesión escribiéndola a mano.

   Variables de entorno necesarias (Vercel → Settings → Environment Variables):
     PANEL_CLAVE    la clave que teclea el local
     PANEL_SECRETO  cadena larga y aleatoria, solo para firmar la cookie */
import crypto from 'node:crypto';

const COOKIE = 'panel';
const DURACION_H = 12;   // una jornada; al día siguiente vuelve a pedir clave

function firmar(datos, secreto) {
  return crypto.createHmac('sha256', secreto).update(datos).digest('base64url');
}

/* La sesión lleva el rol y, si es un profesional, su id. Va dentro de lo
   firmado: si estuviera fuera, cualquiera editaría la cookie para ascenderse a
   dueño. Formato: <vence>|<rol>|<profId>.<firma> */
export function crearSesion(secreto, rol, profId) {
  const vence = Date.now() + DURACION_H * 3600 * 1000;
  const datos = vence + '|' + rol + '|' + (profId || '');
  return datos + '.' + firmar(datos, secreto);
}

/* Devuelve { rol, profId } si la sesión es válida, o null. */
export function leerSesion(token, secreto) {
  if (!token || !secreto) return null;
  const i = token.lastIndexOf('.');
  if (i === -1) return null;
  const datos = token.slice(0, i);
  const firma = token.slice(i + 1);
  const esperada = firmar(datos, secreto);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [vence, rol, profId] = datos.split('|');
  if (!(Number(vence) > Date.now())) return null;
  return { rol: rol === 'dueno' ? 'dueno' : 'profesional', profId: profId ? Number(profId) : null };
}

export function leerCookie(req, nombre) {
  const bruto = req.headers.cookie || '';
  for (const par of bruto.split(';')) {
    const [k, ...v] = par.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function ponerCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${DURACION_H * 3600}`);
}

export function borrarCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

/* Envuelve un handler para que solo corra con sesión válida. `soloDueno`
   cierra la ruta al profesional.

   El rol se comprueba AQUÍ, en el servidor. Esconder botones en el panel no es
   seguridad: quien sepa la dirección de la ruta la llama igual desde la
   consola del navegador. */
export function protegido(handler, opciones) {
  const soloDueno = !!(opciones && opciones.soloDueno);
  return async (req, res) => {
    const secreto = process.env.PANEL_SECRETO;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!secreto) {
      res.status(500).send(JSON.stringify({ error: 'Falta configurar PANEL_SECRETO' }));
      return;
    }
    const sesion = leerSesion(leerCookie(req, COOKIE), secreto);
    if (!sesion) {
      res.status(401).send(JSON.stringify({ error: 'Sesión no válida' }));
      return;
    }
    if (soloDueno && sesion.rol !== 'dueno') {
      res.status(403).send(JSON.stringify({ error: 'Solo el administrador puede ver esto' }));
      return;
    }
    req.sesion = sesion;
    return handler(req, res);
  };
}

export { COOKIE };

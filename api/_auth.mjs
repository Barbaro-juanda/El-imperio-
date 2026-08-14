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

export function crearSesion(secreto) {
  const vence = Date.now() + DURACION_H * 3600 * 1000;
  const datos = String(vence);
  return datos + '.' + firmar(datos, secreto);
}

export function sesionValida(token, secreto) {
  if (!token || !secreto) return false;
  const i = token.lastIndexOf('.');
  if (i === -1) return false;
  const datos = token.slice(0, i);
  const firma = token.slice(i + 1);
  const esperada = firmar(datos, secreto);
  /* Comparación de tiempo constante: comparar con === filtra el secreto poco a
     poco midiendo cuánto tarda en fallar. */
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(datos) > Date.now();
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

/* Envuelve un handler para que solo corra con sesión válida. */
export function protegido(handler) {
  return async (req, res) => {
    const secreto = process.env.PANEL_SECRETO;
    if (!secreto) {
      res.status(500).send(JSON.stringify({ error: 'Falta configurar PANEL_SECRETO' }));
      return;
    }
    if (!sesionValida(leerCookie(req, COOKIE), secreto)) {
      res.status(401).send(JSON.stringify({ error: 'Sesión no válida' }));
      return;
    }
    return handler(req, res);
  };
}

export { COOKIE };

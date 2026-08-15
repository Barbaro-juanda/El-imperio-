/* Hash de claves con scrypt, que viene en Node y no necesita dependencias.
   Formato: scrypt$<sal en base64url>$<derivada en base64url> */
import crypto from 'node:crypto';

const N = 16384, r = 8, p = 1, LARGO = 32;

export function hashClave(clave) {
  const sal = crypto.randomBytes(16);
  const d = crypto.scryptSync(String(clave), sal, LARGO, { N, r, p });
  return 'scrypt$' + sal.toString('base64url') + '$' + d.toString('base64url');
}

export function verificaClave(clave, guardado) {
  if (!guardado || !guardado.startsWith('scrypt$')) return false;
  const [, salB64, dB64] = guardado.split('$');
  const sal = Buffer.from(salB64, 'base64url');
  const esperada = Buffer.from(dB64, 'base64url');
  const d = crypto.scryptSync(String(clave), sal, esperada.length, { N, r, p });
  /* Comparación de tiempo constante: con === el tiempo de fallo revela cuántos
     bytes iniciales acertó. */
  return crypto.timingSafeEqual(d, esperada);
}

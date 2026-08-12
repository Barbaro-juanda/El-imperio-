/* Conexión y utilidades compartidas por las funciones de /api.
   Vercel Functions, Node. Única dependencia: @vercel/postgres. */
import { sql } from '@vercel/postgres';

export { sql };

export const ZONA = 'America/Bogota';

/* El local trabaja en hora de Bogotá y la base guarda en UTC. Convertir a mano
   con un offset fijo funciona hoy porque Colombia no tiene horario de verano,
   pero deja una bomba puesta si eso cambia: se hace con la zona nombrada. */
export function aUTC(fechaISO, horaHHMM) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const [hh, mm]  = horaHHMM.split(':').map(Number);
  /* Se parte de la interpretación UTC y se corrige con el desfase real que la
     zona tenía ESE día, no el de hoy. */
  const tentativo = Date.UTC(y, m - 1, d, hh, mm);
  const desfase = desfaseZona(new Date(tentativo));
  return new Date(tentativo + desfase);
}

function desfaseZona(fecha) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = Object.fromEntries(dtf.formatToParts(fecha).map(x => [x.type, x.value]));
  const comoUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return fecha.getTime() - comoUTC;
}

export function json(res, estado, cuerpo) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(estado).send(JSON.stringify(cuerpo));
}

/* Código corto y legible por teléfono, sin caracteres que se confundan al
   dictarlos (0/O, 1/I). */
export function codigoCita() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

/* Colombia: +57 y diez dígitos. Se normaliza antes de guardar para que el
   mismo cliente no entre dos veces por escribirlo distinto. */
export function normalizaTelefono(bruto) {
  const d = String(bruto || '').replace(/\D/g, '');
  const sin57 = d.startsWith('57') && d.length === 12 ? d.slice(2) : d;
  if (!/^3\d{9}$/.test(sin57)) return null;
  return '+57' + sin57;
}

/* Respaldo de la base a un archivo JSON.  ·  node scripts/respaldo.mjs
   ==========================================================================
   Lo que hay aquí dentro no se puede volver a generar: los clientes con sus
   teléfonos, el histórico de citas, los cobros con sus comprobantes. El código
   está en Git y se recupera solo; esto no.

   Se guarda como JSON y no como volcado SQL a propósito. Un volcado solo sirve
   para restaurarlo en Postgres; un JSON se abre con cualquier cosa, se lee a
   ojo y se puede rescatar un dato suelto sin levantar una base. Para el tamaño
   de este negocio —miles de filas, no millones— pesa lo mismo.

   Correrlo:   node scripts/respaldo.mjs [carpeta]
   Por defecto escribe en respaldos/ dentro del proyecto, que está ignorada por
   Git: un respaldo con teléfonos de clientes no puede acabar en un repositorio
   público. */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

async function urlBase() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const txt = await readFile(path.join(AQUI, '..', '.env.development.local'), 'utf8');
    const m = txt.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  } catch (e) { /* no hay archivo local */ }
  return null;
}

/* Tablas en orden de dependencia: primero las que nadie referencia. Ese orden
   es el que hay que seguir para restaurar, y por eso se guarda tal cual en vez
   de un objeto suelto —un objeto no promete orden y restaurar al revés falla
   por las claves foráneas—. */
const TABLAS = [
  'profesional', 'servicio', 'servicio_profesional', 'horario',
  'cliente', 'cita', 'cita_servicio', 'bloqueo',
  'producto', 'movimiento', 'ajuste', 'migracion'
];

async function main() {
  const url = await urlBase();
  if (!url) {
    console.error('\nFalta DATABASE_URL.  npx vercel env pull .env.development.local\n');
    process.exit(1);
  }
  const sql = neon(url);

  const destino = process.argv[2] || path.join(AQUI, '..', 'respaldos');
  await mkdir(destino, { recursive: true });

  const datos = {};
  const resumen = [];

  for (const t of TABLAS) {
    try {
      /* sql.query y no la plantilla: el nombre de la tabla no es un parámetro,
         va en el texto de la consulta. Viene de la lista de arriba y no de
         ninguna entrada externa, así que no hay nada que se pueda inyectar. */
      const filas = await sql.query('SELECT * FROM ' + t);
      datos[t] = filas;
      resumen.push(t + ': ' + filas.length);
    } catch (e) {
      /* Una tabla que todavía no existe no es un fallo del respaldo: es una
         migración sin correr. Se anota y se sigue, que es mejor que quedarse
         sin copia de las diez que sí están. */
      datos[t] = null;
      resumen.push(t + ': (no existe)');
    }
  }

  /* La marca de tiempo va en el nombre del archivo, en hora de Bogotá, que es
     la que el local reconoce al buscar «el respaldo del martes». */
  const ahora = new Date();
  const bogota = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(ahora).replace(' ', '_').replace(':', '');

  const archivo = path.join(destino, 'imperial-' + bogota + '.json');
  const cuerpo = JSON.stringify({
    generado: ahora.toISOString(),
    zona: 'America/Bogota',
    orden_de_restauracion: TABLAS,
    datos
  }, null, 1);

  await writeFile(archivo, cuerpo, 'utf8');

  console.log('\nRespaldo escrito en:\n  ' + archivo);
  console.log('  ' + (cuerpo.length / 1024).toFixed(0) + ' KB\n');
  console.log(resumen.map(r => '  · ' + r).join('\n'));
  console.log('\nGuárdalo FUERA de este computador. Un respaldo que vive en el');
  console.log('mismo disco que se puede dañar no es un respaldo.\n');
}

main().catch(e => { console.error(e); process.exit(1); });

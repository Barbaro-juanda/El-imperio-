/* Aplica las migraciones pendientes.  ·  node scripts/migrar.mjs
   ==========================================================================
   Hasta ahora las migraciones se corrían pegándolas a mano en el editor SQL de
   Neon. Eso tiene tres problemas y los tres han pasado ya en este proyecto:

     1. Nadie sabe cuáles se corrieron. Al no quedar registro, la única forma de
        averiguarlo es consultar la base a ver si la tabla existe.
     2. Se olvidan. Cuatro llevaban semanas sin aplicar, y el código que las
        daba por hechas fallaba en producción sin que nadie entendiera por qué.
     3. Se corren a medias o en desorden, y entonces el estado de la base deja
        de ser reproducible.

   Esto las aplica en orden, anota cuáles ya se hicieron y no repite ninguna.
   Correrlo dos veces seguidas es seguro: la segunda no hace nada.

   Vive en scripts/ y no en api/ a propósito: cada archivo bajo api/ cuenta
   como una función serverless y el plan tiene un tope de doce. */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_API = path.join(AQUI, '..', 'api');

/* Se lee del entorno o de .env.development.local, que es donde la deja
   `npx vercel env pull`. Así el comando funciona sin exportar nada a mano. */
async function urlBase() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const txt = await readFile(path.join(AQUI, '..', '.env.development.local'), 'utf8');
    const m = txt.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  } catch (e) { /* no hay archivo local */ }
  return null;
}

/* Postgres no permite varias sentencias en una sola llamada del driver, así que
   el archivo se parte en sentencias. Se respetan los literales entre comillas
   simples y los comentarios `--`, porque dentro de ellos un punto y coma no
   separa nada: partir a ciegas por ';' rompería cualquier migración que traiga
   un texto con punto y coma. */
export function sentencias(sql) {
  const fuera = [];
  let actual = '', enTexto = false, enComentario = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], sig = sql[i + 1];

    if (enComentario) {
      actual += c;
      if (c === '\n') enComentario = false;
      continue;
    }
    if (enTexto) {
      actual += c;
      /* '' dentro de un literal es una comilla escapada, no el final. */
      if (c === "'" && sig === "'") { actual += sig; i++; continue; }
      if (c === "'") enTexto = false;
      continue;
    }
    if (c === '-' && sig === '-') { enComentario = true; actual += c; continue; }
    if (c === "'") { enTexto = true; actual += c; continue; }
    if (c === ';') { fuera.push(actual); actual = ''; continue; }
    actual += c;
  }
  fuera.push(actual);

  /* Lo que queda solo con comentarios o espacios no es una sentencia. */
  return fuera
    .map(s => s.trim())
    .filter(s => s.replace(/--.*$/gm, '').trim().length > 0);
}

async function main() {
  const url = await urlBase();
  if (!url) {
    console.error('\nFalta DATABASE_URL.\n');
    console.error('  Opción A:  npx vercel env pull .env.development.local');
    console.error('  Opción B:  DATABASE_URL="postgres://…" node scripts/migrar.mjs\n');
    process.exit(1);
  }
  const sql = neon(url);

  /* El registro de lo aplicado vive en la propia base. Es el único sitio donde
     no se puede desincronizar de la realidad: si alguien restaura un respaldo
     viejo, el registro vuelve atrás con él. */
  await sql`
    CREATE TABLE IF NOT EXISTS migracion (
      archivo   TEXT PRIMARY KEY,
      aplicada  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  const yaHechas = new Set((await sql`SELECT archivo FROM migracion`).map(r => r.archivo));

  const archivos = (await readdir(DIR_API))
    .filter(f => /^_migracion-\d+\.sql$/.test(f))
    .sort();   // 01, 02, 03… el orden alfabético es el cronológico

  if (!archivos.length) { console.log('No hay migraciones en api/.'); return; }

  /* Las cuatro primeras se corrieron a mano antes de que existiera este
     registro. Si sus tablas ya están, se dan por hechas en vez de volver a
     ejecutarlas: son idempotentes y no romperían nada, pero anotarlas evita
     que el resumen mienta diciendo que se acaban de aplicar. */
  if (!yaHechas.size) {
    const previas = await sql`
      SELECT to_regclass('public.cita') IS NOT NULL AS hay_base`;
    if (previas[0] && previas[0].hay_base) {
      for (const f of ['_migracion-01.sql', '_migracion-02.sql',
                       '_migracion-03.sql', '_migracion-04.sql']) {
        if (archivos.includes(f)) {
          await sql`INSERT INTO migracion (archivo) VALUES (${f}) ON CONFLICT DO NOTHING`;
          yaHechas.add(f);
        }
      }
      console.log('Base ya existente: se dan por aplicadas las migraciones 01–04.\n');
    }
  }

  let aplicadas = 0;
  for (const archivo of archivos) {
    if (yaHechas.has(archivo)) {
      console.log('  ·  ' + archivo + '  (ya estaba)');
      continue;
    }
    const texto = await readFile(path.join(DIR_API, archivo), 'utf8');
    const trozos = sentencias(texto);
    process.stdout.write('  →  ' + archivo + '  (' + trozos.length + ' sentencias) ');

    try {
      for (const t of trozos) await sql.query(t);
      await sql`INSERT INTO migracion (archivo) VALUES (${archivo})`;
      console.log('OK');
      aplicadas++;
    } catch (e) {
      console.log('FALLÓ');
      console.error('\n' + e.message + '\n');
      /* Se para aquí. Seguir con la siguiente dejaría la base en un estado que
         ninguna migración describe, y eso es peor que quedarse a medias en un
         punto conocido. */
      console.error('Se detuvo en ' + archivo + '. Las anteriores quedaron aplicadas.');
      process.exit(1);
    }
  }

  console.log('\n' + (aplicadas ? aplicadas + ' migración(es) aplicada(s).' : 'Todo al día.'));

  /* Resumen de lo que hay, para poder confirmar de un vistazo que el estado es
     el esperado sin abrir el editor SQL. */
  try {
    const r = await sql`
      SELECT (SELECT count(*) FROM servicio WHERE activo)        AS servicios,
             (SELECT count(*) FROM profesional WHERE activo)     AS equipo,
             (SELECT count(*) FROM cita)                         AS citas`;
    const p = await sql`SELECT count(*)::int AS n FROM producto`.catch(() => [{ n: 0 }]);
    console.log('\nEstado:  ' + r[0].servicios + ' servicios activos  ·  ' +
                r[0].equipo + ' en el equipo  ·  ' + r[0].citas + ' citas  ·  ' +
                p[0].n + ' productos');
  } catch (e) { /* el resumen es cortesía, no parte del trabajo */ }
}

/* Solo corre si se invoca como programa. Importado desde las pruebas —para
   comprobar el divisor de SQL— no debe conectarse a ninguna base. */
if (process.argv[1] && process.argv[1].endsWith('migrar.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}

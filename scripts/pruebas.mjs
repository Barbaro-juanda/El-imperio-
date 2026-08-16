/* Pruebas.  ·  node --test scripts/
   ==========================================================================
   Sin librerías: el ejecutor viene con Node desde la 18. Añadir jest o vitest
   traería doscientas dependencias a un proyecto que hoy tiene una, y la razón
   por la que este sitio va a seguir funcionando dentro de tres años es
   justamente que no hay nada que actualizar.

   Se prueba lo que puede fallar en silencio: cuentas de fechas, dinero,
   teléfonos y firmas. Nada de esto avisa cuando se rompe —una cita se agenda
   una hora antes y se descubre cuando el cliente llega a la puerta—, y todo es
   función pura, así que se prueba sin base de datos ni navegador.

   No se prueban las consultas SQL ni el dibujado: eso exige una base y un
   navegador de verdad, y probarlo con imitaciones solo comprueba que las
   imitaciones se parecen a lo que uno cree que hace Postgres. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/* _db.mjs abre la conexión al importarse, así que sin una cadena en el entorno
   ni siquiera se puede cargar el archivo para probar sus funciones de fecha y
   teléfono, que no tocan la base. Se le pone una de mentira: nada aquí ejecuta
   una consulta, así que nunca llega a conectarse a ningún sitio.

   Se pone ANTES del import, y por eso el import es dinámico: los estáticos se
   resuelven antes de que corra la primera línea del archivo, y para entonces la
   variable todavía no existiría. */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://pruebas:pruebas@localhost:5432/pruebas';
}

const { aUTC, normalizaTelefono, codigoCita, ZONA } = await import('../api/_db.mjs');
const { hashClave, verificaClave } = await import('../api/_hash.mjs');
const { crearSesion, leerSesion } = await import('../api/_auth.mjs');

/* ------------------------------------------------------------------
   Horas: Bogotá contra UTC
   ------------------------------------------------------------------ */
test('aUTC convierte hora de Bogotá a UTC', () => {
  /* Colombia va en UTC-5 todo el año. Las 09:00 en Sabaneta son las 14:00Z. */
  assert.equal(aUTC('2026-08-20', '09:00').toISOString(), '2026-08-20T14:00:00.000Z');
  assert.equal(aUTC('2026-08-20', '20:00').toISOString(), '2026-08-21T01:00:00.000Z');
});

test('aUTC no se rompe cruzando el año', () => {
  /* Las 20:00 del 31 de diciembre caen en enero en UTC. Si la conversión se
     hiciera sumando horas al día sin recalcular la fecha, aquí saldría 2026. */
  assert.equal(aUTC('2026-12-31', '20:00').toISOString(), '2027-01-01T01:00:00.000Z');
});

test('aUTC usa la zona nombrada, no un desfase escrito a mano', () => {
  /* Si algún día Colombia adoptara horario de verano, un -5 fijo empezaría a
     agendar con una hora de error durante medio año sin avisar. Esta prueba
     falla el día que eso pase, que es exactamente lo que se busca. */
  assert.equal(aUTC('2026-01-15', '12:00').getUTCHours(), 17);
  assert.equal(aUTC('2026-07-15', '12:00').getUTCHours(), 17);
  assert.equal(ZONA, 'America/Bogota');
});

/* ------------------------------------------------------------------
   Teléfonos
   ------------------------------------------------------------------ */
test('normalizaTelefono acepta las formas en que la gente escribe su celular', () => {
  const esperado = '+573001112233';
  for (const escrito of ['3001112233', '300 111 2233', '300-111-2233',
                         '+573001112233', '57 300 111 2233', '(300) 1112233']) {
    assert.equal(normalizaTelefono(escrito), esperado, 'falló con: ' + escrito);
  }
});

test('normalizaTelefono rechaza lo que no es un celular colombiano', () => {
  /* Se normaliza antes de guardar para que el mismo cliente no entre dos veces
     por escribirlo distinto. Si colara un número inválido, esa fila sería un
     cliente al que nunca se le puede escribir. */
  for (const malo of ['', null, undefined, '123', '4001112233', '30011122', 'abc',
                      '30011122334']) {
    assert.equal(normalizaTelefono(malo), null, 'debió rechazar: ' + malo);
  }
});

/* ------------------------------------------------------------------
   Código de cita
   ------------------------------------------------------------------ */
test('codigoCita evita los caracteres que se confunden al dictarlos', () => {
  /* El código se dicta por teléfono. Un 0 y una O, o un 1 y una I, obligan a
     repetirlo tres veces. */
  for (let i = 0; i < 300; i++) {
    const c = codigoCita();
    assert.match(c, /^[A-HJ-NP-Z2-9]{6}$/, 'código con caracteres ambiguos: ' + c);
  }
});

/* ------------------------------------------------------------------
   Claves
   ------------------------------------------------------------------ */
test('hashClave nunca guarda la clave y verifica bien', () => {
  const clave = 'unaClaveLarga123';
  const hash = hashClave(clave);
  assert.ok(!hash.includes(clave), 'la clave aparece en el hash');
  assert.ok(verificaClave(clave, hash));
  assert.ok(!verificaClave('otraClaveLarga1', hash));
});

test('la misma clave da hashes distintos', () => {
  /* Con sal por clave, dos personas con la misma contraseña no comparten hash.
     Sin eso, ver dos hashes iguales delata que ambas usan la misma. */
  assert.notEqual(hashClave('lamismaclave'), hashClave('lamismaclave'));
});

test('verificaClave no revienta con basura', () => {
  for (const malo of ['', null, undefined, 'no-es-un-hash', 'scrypt$solo$dos']) {
    assert.doesNotThrow(() => verificaClave('x', malo));
    assert.equal(verificaClave('x', malo), false);
  }
});

/* ------------------------------------------------------------------
   Sesión del panel
   ------------------------------------------------------------------ */
const SECRETO = 'secreto-de-prueba-largo-y-aleatorio';

test('la sesión guarda el rol y devuelve lo que se le puso', () => {
  const dueno = leerSesion(crearSesion(SECRETO, 'dueno', null), SECRETO);
  assert.equal(dueno.rol, 'dueno');
  assert.equal(dueno.profId, null);

  const prof = leerSesion(crearSesion(SECRETO, 'profesional', 7), SECRETO);
  assert.equal(prof.rol, 'profesional');
  assert.equal(prof.profId, 7);
});

test('una sesión manipulada no vale', () => {
  /* Esta es LA prueba importante del archivo. El rol va dentro de lo firmado
     precisamente para que nadie se ascienda a dueño editando su cookie. Si
     alguien mueve el rol fuera de la firma, esta prueba falla. */
  const token = crearSesion(SECRETO, 'profesional', 7);
  const trucado = token.replace('|profesional|', '|dueno|');
  assert.equal(leerSesion(trucado, SECRETO), null);
});

test('una sesión firmada con otro secreto no vale', () => {
  const token = crearSesion('otro-secreto-cualquiera', 'dueno', null);
  assert.equal(leerSesion(token, SECRETO), null);
});

test('una sesión vencida no vale', () => {
  /* Se fabrica una con fecha pasada y la firma correcta: comprueba que la
     caducidad se mira de verdad y no solo la firma. */
  const datos = (Date.now() - 1000) + '|dueno|';
  const firma = crypto.createHmac('sha256', SECRETO).update(datos).digest('base64url');
  assert.equal(leerSesion(datos + '.' + firma, SECRETO), null);
});

test('leerSesion aguanta cualquier basura sin lanzar', () => {
  for (const malo of ['', null, undefined, 'sinpunto', '.', 'a.b', '999|dueno|.xxx']) {
    assert.doesNotThrow(() => leerSesion(malo, SECRETO));
    assert.equal(leerSesion(malo, SECRETO), null);
  }
});

/* ------------------------------------------------------------------
   El divisor de SQL del ejecutor de migraciones
   ------------------------------------------------------------------
   Postgres no acepta varias sentencias en una llamada, así que las
   migraciones se parten por punto y coma. Partir a ciegas rompería
   cualquiera que traiga un ';' dentro de un texto o de un comentario, y
   el resultado sería una migración a medias en producción. */
const { sentencias } = await import('./migrar.mjs');

test('parte por sentencias y descarta lo que solo es comentario', () => {
  const sql = `
    -- un comentario suelto
    CREATE TABLE a (id INT);
    INSERT INTO a VALUES (1);
    -- otro comentario al final
  `;
  assert.equal(sentencias(sql).length, 2);
});

test('un punto y coma dentro de un texto NO parte la sentencia', () => {
  const sql = "INSERT INTO t (nota) VALUES ('almuerzo; vuelve a las 2');";
  const r = sentencias(sql);
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('vuelve a las 2'));
});

test('un punto y coma dentro de un comentario tampoco parte', () => {
  const sql = "-- ojo; esto no es el final\nSELECT 1;";
  assert.equal(sentencias(sql).length, 1);
});

test('las comillas escapadas no confunden al divisor', () => {
  /* '' es una comilla dentro del literal, no el cierre. Si se leyera como
     cierre, el resto del archivo se interpretaría al revés: lo que va dentro
     de textos pasaría por código y al contrario. */
  const sql = "INSERT INTO t VALUES ('qué'' raro; sí');\nSELECT 2;";
  const r = sentencias(sql);
  assert.equal(r.length, 2);
  assert.ok(r[0].includes("qué'' raro; sí"));
});

test('las migraciones reales se parten sin perder nada', async () => {
  /* Comprobación de humo contra los archivos de verdad: si alguna se parte en
     cero sentencias, el ejecutor la daría por aplicada sin hacer nada. */
  const dir = path.join(import.meta.dirname, '..', 'api');
  const archivos = (await readdir(dir)).filter(f => /^_migracion-\d+\.sql$/.test(f));
  assert.ok(archivos.length >= 8, 'faltan migraciones');
  for (const f of archivos) {
    const texto = await readFile(path.join(dir, f), 'utf8');
    assert.ok(sentencias(texto).length > 0, f + ' se parte en cero sentencias');
  }
});

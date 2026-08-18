/* GET   /api/panel/ajustes            → servicios y horario
   PATCH /api/panel/ajustes            → { servicio: {id, precio, minutos, activo} }
                                       o { horario: {dow, abre, cierra, abierto} }

   Para que el local cambie un precio o un horario sin depender de nadie. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';
import { hashClave } from '../_hash.mjs';

const SEGMENTOS = ['cortes', 'color', 'depilacion', 'cejas', 'facial', 'unas', 'adicionales'];

/* La foto del equipo llega de dos formas: como ruta —las que ya venían en el
   repositorio— o como imagen incrustada, que es lo que manda el panel desde
   que se elige con el selector de archivos.

   El tope es generoso pero existe: esta foto viaja dentro del catálogo que
   descarga TODO visitante de la página, así que una sin comprimir la haría
   pesada para alguien que entra con datos móviles. El navegador ya la encoge a
   800 px antes de subirla; esto es la red por si eso falla o alguien llama a la
   API por su cuenta. */
const TOPE_FOTO = 400 * 1024;

function revisaFoto(valor) {
  if (valor === null || valor === undefined) return null;
  const v = String(valor);
  if (/^assets\/[\w.-]+\.(jpe?g|png|webp)$/i.test(v)) return null;
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(v)) {
    return 'La foto debe ser una imagen';
  }
  if (v.length > TOPE_FOTO) return 'La foto pesa demasiado, vuelve a elegirla';
  return null;
}

/* Identificador a partir del nombre: minúsculas, sin tildes y con guiones.
   Se deriva y no se pide para que quien crea el servicio no tenga que pensar
   en identificadores, que es cosa de la base y no del local. */
function idDesde(nombre) {
  return String(nombre)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default protegido(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const servicios = await sql`
        SELECT id, nombre, segmento, precio, minutos, activo, descripcion, solo_adicional
          FROM servicio ORDER BY segmento, nombre`;
      const horario = await sql`SELECT dow, abre, cierra, abierto FROM horario ORDER BY dow`;
      /* clave_hash NO sale de aquí. El panel solo necesita saber si esa persona
         ya tiene clave, no cuál es. */
      const equipo = await sql`
        SELECT id, nombre, foto, comision, entra, sale, activo,
               (clave_hash IS NOT NULL) AS tiene_clave
          FROM profesional ORDER BY nombre`;
      /* La meta vive en la base y no en el código: cambiarla no puede exigir
         publicar el sitio. Si la tabla aún no existe se usa el valor que había
         escrito, para que el panel siga pintando la barra. */
      let meta = 300000;
      try {
        const r = await sql`SELECT valor FROM ajuste WHERE clave = 'meta_diaria'`;
        if (r.length) meta = Number(r[0].valor) || meta;
      } catch (e) { /* sin tabla de ajustes todavía */ }

      /* Los descansos futuros y los del mes pasado: hacia atrás no sirven para
         decidir nada, y traerlos todos crecería sin tope. */
      let descansos = [];
      try {
        descansos = await sql`
          SELECT d.id, d.fecha, d.motivo, d.profesional_id, p.nombre AS profesional
            FROM descanso d
            LEFT JOIN profesional p ON p.id = d.profesional_id
           WHERE d.fecha >= CURRENT_DATE - INTERVAL '30 days'
           ORDER BY d.fecha`;
      } catch (e) { /* sin la migración 15 todavía */ }

      return json(res, 200, {
        meta,
        descansos,
        servicios,
        horario: horario.map(h => ({ ...h, abre: String(h.abre).slice(0,5), cierra: String(h.cierra).slice(0,5) })),
        equipo: equipo.map(p => ({ ...p, entra: String(p.entra).slice(0,5), sale: String(p.sale).slice(0,5),
                                  comision: Number(p.comision) }))
      });
    }
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    /* Alta de servicio. Va por POST y no por PATCH porque crear no es
       actualizar: el id se deriva del nombre y tiene que ser único. */
    if (req.method === 'POST') {
      const s2 = b.servicio || {};
      const nombre = String(s2.nombre || '').trim();
      if (!nombre) return json(res, 400, { error: 'El servicio necesita un nombre' });
      if (!SEGMENTOS.includes(s2.segmento)) return json(res, 400, { error: 'Categoría no válida' });

      const min = Number(s2.minutos);
      if (!Number.isFinite(min) || min < 5 || min > 600) {
        return json(res, 400, { error: 'La duración debe estar entre 5 y 600 minutos' });
      }
      const precio = s2.precio === null || s2.precio === '' ? null : Math.round(Number(s2.precio));
      if (precio !== null && (!Number.isFinite(precio) || precio < 0)) {
        return json(res, 400, { error: 'Precio no válido' });
      }

      const id = idDesde(nombre);
      if (!id) return json(res, 400, { error: 'Ese nombre no deja construir un identificador' });
      const ya = await sql`SELECT 1 FROM servicio WHERE id = ${id}`;
      if (ya.length) return json(res, 409, { error: 'Ya existe un servicio con ese nombre' });

      await sql`
        INSERT INTO servicio (id, segmento, nombre, precio, minutos, activo, descripcion, solo_adicional)
        VALUES (${id}, ${s2.segmento}, ${nombre}, ${precio}, ${min}, TRUE,
                ${s2.descripcion || null}, ${s2.segmento === 'adicionales' || !!s2.solo_adicional})`;

      /* Nace sin nadie que lo preste, y entonces no se puede reservar. Se
         asigna a todo el equipo activo: quitar a quien no lo haga es un clic,
         descubrir que el servicio no aparece en la web es media hora perdida. */
      await sql`
        INSERT INTO servicio_profesional (servicio_id, profesional_id)
        SELECT ${id}, id FROM profesional WHERE activo
        ON CONFLICT DO NOTHING`;

      return json(res, 201, { id });
    }

    /* ---------------- días de descanso ----------------
       Acepta un rango, no un día suelto: unas vacaciones son una semana y
       marcarlas de una en una es siete veces el mismo trabajo. Sin `hasta` es
       un solo día, que sigue siendo el caso corriente de un festivo. */
    if (req.method === 'POST' && b.descanso) {
      const d = b.descanso;
      const FECHA = /^\d{4}-\d{2}-\d{2}$/;
      if (!FECHA.test(d.desde || '')) return json(res, 400, { error: 'Fecha no válida' });
      const hasta = FECHA.test(d.hasta || '') ? d.hasta : d.desde;
      if (hasta < d.desde) {
        return json(res, 400, { error: 'La fecha final va después de la inicial' });
      }

      /* Tope de un año. No es por capacidad —caben de sobra— sino porque un
         rango de diez años casi siempre es un dedo que se equivocó de año al
         escribir, y meterlo deja el calendario cerrado hasta 2036 sin que nadie
         entienda por qué. */
      const dias = Math.round(
        (Date.parse(hasta + 'T00:00:00Z') - Date.parse(d.desde + 'T00:00:00Z')) / 86400000) + 1;
      if (dias > 366) {
        return json(res, 400, { error: 'Ese rango pasa de un año. Revisa las fechas.' });
      }

      /* Sin profesional es el local entero. Con uno, descansa solo esa persona
         y los demás siguen atendiendo. */
      const prof = d.profesional_id ? Number(d.profesional_id) : null;
      const motivo = String(d.motivo || '').trim() || null;

      /* Una sola sentencia genera todas las fechas del rango. `ON CONFLICT DO
         NOTHING` deja pasar los días que ya estuvieran marcados en vez de
         abortar el rango entero: quien añade una semana sobre un festivo que ya
         existía espera que se sume, no que falle. */
      const r = await sql`
        INSERT INTO descanso (fecha, profesional_id, motivo)
        SELECT g::date, ${prof}, ${motivo}
          FROM generate_series(${d.desde}::date, ${hasta}::date, '1 day') AS g
        ON CONFLICT DO NOTHING
        RETURNING id`;

      if (!r.length) {
        return json(res, 409, { error: 'Esos días ya estaban marcados' });
      }
      return json(res, 201, { puestos: r.length, dias });
    }

    if (req.method === 'DELETE' && req.query.descanso) {
      const id = Number(req.query.descanso);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'id no válido' });
      const r = await sql`DELETE FROM descanso WHERE id = ${id} RETURNING id`;
      if (!r.length) return json(res, 404, { error: 'Ese descanso no existe' });
      return json(res, 200, { id });
    }

    /* Alta de profesional. */
    if (req.method === 'POST' && b.profesional) {
      const p = b.profesional;
      const nombre = String(p.nombre || '').trim();
      if (!nombre) return json(res, 400, { error: 'El profesional necesita un nombre' });

      const com = p.comision === undefined ? 0.5 : Number(p.comision);
      if (!Number.isFinite(com) || com < 0 || com > 1) {
        return json(res, 400, { error: 'La comisión va entre 0 y 1' });
      }
      const entra = /^\d{2}:\d{2}$/.test(p.entra) ? p.entra : '09:00';
      const sale  = /^\d{2}:\d{2}$/.test(p.sale)  ? p.sale  : '20:00';

      /* El slug se deriva del nombre igual que el id de un servicio, para no
         pedirle a nadie que invente identificadores. */
      let slug = idDesde(nombre);
      if (!slug) return json(res, 400, { error: 'Ese nombre no deja construir un identificador' });
      const choque = await sql`SELECT 1 FROM profesional WHERE slug = ${slug}`;
      if (choque.length) return json(res, 409, { error: 'Ya hay alguien con ese nombre en el equipo' });

      const malaFoto = revisaFoto(p.foto);
      if (malaFoto) return json(res, 400, { error: malaFoto });

      const r = await sql`
        INSERT INTO profesional (nombre, slug, foto, activo, comision, entra, sale)
        VALUES (${nombre}, ${slug}, ${p.foto || null}, TRUE, ${com}, ${entra}, ${sale})
        RETURNING id`;
      const id = r[0].id;

      if (p.clave) {
        if (String(p.clave).length < 8) {
          return json(res, 400, { error: 'La clave debe tener al menos 8 caracteres' });
        }
        await sql`UPDATE profesional SET clave_hash = ${hashClave(String(p.clave))} WHERE id = ${id}`;
      }

      /* Nace sin servicios asignados, y entonces no aparece en ninguna reserva
         ni se le puede agendar nada. Se le asignan todos los activos: quitarle
         los que no haga es un clic, y descubrir que no sale en la web es media
         hora buscando por qué. */
      await sql`
        INSERT INTO servicio_profesional (servicio_id, profesional_id)
        SELECT id, ${id} FROM servicio WHERE activo
        ON CONFLICT DO NOTHING`;

      return json(res, 201, { id, nombre });
    }

    if (req.method !== 'PATCH') return json(res, 405, { error: 'Solo GET, POST o PATCH' });

    if (b.servicio) {
      const s = b.servicio;
      if (!s.id) return json(res, 400, { error: 'Falta el servicio' });
      const min = Number(s.minutos);
      if (!Number.isFinite(min) || min < 5 || min > 600) {
        return json(res, 400, { error: 'La duración debe estar entre 5 y 600 minutos' });
      }
      /* precio null = a convenir. Es un valor legítimo, no un campo sin llenar. */
      const precio = s.precio === null || s.precio === '' ? null : Math.round(Number(s.precio));
      if (precio !== null && (!Number.isFinite(precio) || precio < 0)) {
        return json(res, 400, { error: 'Precio no válido' });
      }
      const r = await sql`
        UPDATE servicio
           SET precio = ${precio}, minutos = ${min}, activo = ${s.activo !== false},
               descripcion = COALESCE(${s.descripcion === undefined ? null : s.descripcion}, descripcion)
         WHERE id = ${s.id} RETURNING id, precio, minutos, activo`;
      if (!r.length) return json(res, 404, { error: 'Ese servicio no existe' });
      return json(res, 200, r[0]);
    }

    if (b.horario) {
      const h = b.horario;
      if (!(h.dow >= 0 && h.dow <= 6)) return json(res, 400, { error: 'Día no válido' });
      if (!/^\d{2}:\d{2}$/.test(h.abre) || !/^\d{2}:\d{2}$/.test(h.cierra)) {
        return json(res, 400, { error: 'Horas no válidas' });
      }
      const r = await sql`
        UPDATE horario SET abre = ${h.abre}, cierra = ${h.cierra}, abierto = ${h.abierto !== false}
         WHERE dow = ${h.dow} RETURNING dow, abierto`;
      return json(res, 200, r[0]);
    }
    if (b.profesional) {
      const p = b.profesional;
      if (!p.id) return json(res, 400, { error: 'Falta el profesional' });
      const com = Number(p.comision);
      if (!Number.isFinite(com) || com < 0 || com > 1) {
        return json(res, 400, { error: 'La comisión va entre 0 y 1' });
      }
      if (!/^\d{2}:\d{2}$/.test(p.entra) || !/^\d{2}:\d{2}$/.test(p.sale)) {
        return json(res, 400, { error: 'Horas no válidas' });
      }
      const malaFoto2 = p.foto === undefined ? null : revisaFoto(p.foto);
      if (malaFoto2) return json(res, 400, { error: malaFoto2 });

      /* El nombre y la foto solo se tocan si vienen: un PATCH que no los manda
         significa «no los cambies», no «bórralos». */
      const nombre = p.nombre === undefined ? null : String(p.nombre).trim();
      if (nombre !== null && !nombre) return json(res, 400, { error: 'El nombre no puede quedar vacío' });

      await sql`
        UPDATE profesional
           SET comision = ${com}, entra = ${p.entra}, sale = ${p.sale},
               activo = ${p.activo !== false},
               nombre = COALESCE(${nombre}, nombre),
               foto = COALESCE(${p.foto === undefined ? null : p.foto}, foto)
         WHERE id = ${p.id}`;

      /* La clave se cambia solo si viene una nueva; el campo vacío significa
         «déjala como está», no «bórrala». */
      if (p.clave) {
        if (String(p.clave).length < 8) {
          return json(res, 400, { error: 'La clave debe tener al menos 8 caracteres' });
        }
        await sql`UPDATE profesional SET clave_hash = ${hashClave(String(p.clave))} WHERE id = ${p.id}`;
      }
      return json(res, 200, { id: p.id });
    }

    if (b.meta !== undefined) {
      const v = Math.round(Number(b.meta));
      /* Cero es legítimo: significa «no medimos contra meta». Un tope alto
         evita que un dedo de más convierta la barra en algo inútil. */
      if (!Number.isFinite(v) || v < 0 || v > 100000000) {
        return json(res, 400, { error: 'Meta no válida' });
      }
      await sql`
        INSERT INTO ajuste (clave, valor, nota)
        VALUES ('meta_diaria', ${String(v)}, 'Meta de caja por día, en pesos.')
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`;
      return json(res, 200, { meta: v });
    }

    return json(res, 400, { error: 'Nada que actualizar' });
  } catch (e) {
    console.error('ajustes', e);
    return json(res, 500, { error: 'No se pudo guardar' });
  }
}, { soloDueno: true });

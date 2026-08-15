/* GET   /api/panel/ajustes            → servicios y horario
   PATCH /api/panel/ajustes            → { servicio: {id, precio, minutos, activo} }
                                       o { horario: {dow, abre, cierra, abierto} }

   Para que el local cambie un precio o un horario sin depender de nadie. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';
import { hashClave } from '../_hash.mjs';

const SEGMENTOS = ['cortes', 'color', 'depilacion', 'cejas', 'facial', 'unas', 'adicionales'];

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
        SELECT id, nombre, comision, entra, sale, activo,
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

      return json(res, 200, {
        meta,
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
      await sql`
        UPDATE profesional SET comision = ${com}, entra = ${p.entra}, sale = ${p.sale},
                               activo = ${p.activo !== false}
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

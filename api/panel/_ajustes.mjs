/* GET   /api/panel/ajustes            → servicios y horario
   PATCH /api/panel/ajustes            → { servicio: {id, precio, minutos, activo} }
                                       o { horario: {dow, abre, cierra, abierto} }

   Para que el local cambie un precio o un horario sin depender de nadie. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';
import { hashClave } from '../_hash.mjs';

export default protegido(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const servicios = await sql`
        SELECT id, nombre, segmento, precio, minutos, activo FROM servicio
         ORDER BY segmento, nombre`;
      const horario = await sql`SELECT dow, abre, cierra, abierto FROM horario ORDER BY dow`;
      /* clave_hash NO sale de aquí. El panel solo necesita saber si esa persona
         ya tiene clave, no cuál es. */
      const equipo = await sql`
        SELECT id, nombre, comision, entra, sale, activo,
               (clave_hash IS NOT NULL) AS tiene_clave
          FROM profesional ORDER BY nombre`;
      return json(res, 200, {
        servicios,
        horario: horario.map(h => ({ ...h, abre: String(h.abre).slice(0,5), cierra: String(h.cierra).slice(0,5) })),
        equipo: equipo.map(p => ({ ...p, entra: String(p.entra).slice(0,5), sale: String(p.sale).slice(0,5),
                                  comision: Number(p.comision) }))
      });
    }
    if (req.method !== 'PATCH') return json(res, 405, { error: 'Solo GET o PATCH' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

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
        UPDATE servicio SET precio = ${precio}, minutos = ${min}, activo = ${s.activo !== false}
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

    return json(res, 400, { error: 'Nada que actualizar' });
  } catch (e) {
    console.error('ajustes', e);
    return json(res, 500, { error: 'No se pudo guardar' });
  }
}, { soloDueno: true });

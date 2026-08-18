/* POST   /api/panel/bloqueo { profesional_id|null, fecha, desde, hasta, motivo }
   DELETE /api/panel/bloqueo?id=…
   Cerrar horas: un almuerzo, una tarde libre, un festivo del local entero.

   SOLO EL DUEÑO. Antes podía hacerlo cualquier profesional desde «Mi día», y
   eso convierte la agenda en algo que cada quien recorta por su cuenta: un
   barbero se cierra la tarde del viernes, el local pierde los cupos y nadie se
   entera hasta que los ve desaparecidos. Quién trabaja y cuándo es una decisión
   del negocio, no de cada silla. */
import { sql, json, aUTC } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

export default protegido(async (req, res) => {
  try {
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return json(res, 400, { error: 'Falta el id' });
      await sql`DELETE FROM bloqueo WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Solo POST o DELETE' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha || '')) return json(res, 400, { error: 'fecha inválida' });
    if (!/^\d{2}:\d{2}$/.test(b.desde || '') || !/^\d{2}:\d{2}$/.test(b.hasta || '')) {
      return json(res, 400, { error: 'horas inválidas' });
    }
    const inicio = aUTC(b.fecha, b.desde);
    const fin    = aUTC(b.fecha, b.hasta);
    if (fin <= inicio) return json(res, 400, { error: 'La hora de fin va después de la de inicio' });

    const r = await sql`
      INSERT INTO bloqueo (profesional_id, inicio, fin, motivo)
      VALUES (${b.profesional_id || null}, ${inicio.toISOString()}, ${fin.toISOString()}, ${b.motivo || null})
      RETURNING id`;
    return json(res, 201, r[0]);
  } catch (e) {
    console.error('bloqueo', e);
    return json(res, 500, { error: 'No se pudo guardar' });
  }
}, { soloDueno: true });

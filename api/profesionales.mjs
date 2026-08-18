/* GET /api/profesionales?servicios=corte-vip,cejas-hilo
   Quién puede atender esa combinación.

   Existe aparte de /api/disponibilidad porque el paso del barbero va ANTES de
   elegir fecha: pedir cupos sin día para obtener la lista sería forzar el otro
   endpoint a hacer algo que no le toca. */
import { sql, json } from './_db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });

  const ids = String(req.query.servicios || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return json(res, 400, { error: 'servicios es obligatorio' });

  try {
    /* Tiene que prestar TODOS los servicios, no alguno: si no, se ofrecería a
       alguien que no hace la mitad de la cita. */
    const filas = await sql`
      SELECT p.id, p.nombre, p.foto, p.dias_libres
        FROM profesional p
        JOIN servicio_profesional sp ON sp.profesional_id = p.id
       WHERE p.activo AND sp.servicio_id = ANY(${ids})
       GROUP BY p.id, p.nombre, p.foto, p.dias_libres
      HAVING COUNT(DISTINCT sp.servicio_id) = ${ids.length}
       ORDER BY p.nombre`;

    /* Los días libres viajan con cada uno para que el calendario del paso
       siguiente pueda apagarlos con su nombre —«Emanuel descansa»— en vez de
       dejar pulsar un día que va a salir vacío. Se manda aquí y no en la
       disponibilidad porque el calendario se pinta entero de una vez y
       preguntar día por día serían treinta y una consultas. */
    return json(res, 200, {
      profesionales: filas.map(p => ({ ...p, dias_libres: (p.dias_libres || []).map(Number) }))
    });
  } catch (e) {
    console.error('profesionales', e);
    return json(res, 500, { error: 'No se pudo consultar el equipo' });
  }
}

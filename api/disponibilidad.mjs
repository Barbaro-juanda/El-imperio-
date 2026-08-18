/* GET /api/disponibilidad?fecha=2026-08-20&servicios=corte-vip,cejas-hilo[&profesional=2]
   Devuelve los cupos reales de ese día.

   El cupo se calcula, no se guarda: duración total de lo elegido, contra el
   horario del día, menos las citas ya confirmadas y los bloqueos. Guardar una
   tabla de cupos obligaría a regenerarla cada vez que cambia un horario o una
   duración, y a que las dos versiones coincidan siempre. */
import { sql, aUTC, json } from './_db.mjs';

const PASO_MIN   = 15;   // cada cuánto se ofrece un inicio
const COLCHON_MIN = 60;  // no se reserva con menos de una hora de antelación

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });

  const { fecha, servicios = '', profesional } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
    return json(res, 400, { error: 'fecha debe ser YYYY-MM-DD' });
  }
  const ids = String(servicios).split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return json(res, 400, { error: 'servicios es obligatorio' });

  try {
    const servs = await sql`
      SELECT id, minutos FROM servicio WHERE id = ANY(${ids}) AND activo`;
    if (servs.length !== ids.length) {
      return json(res, 400, { error: 'Hay servicios que no existen o están inactivos' });
    }
    const duracion = servs.reduce((t, s) => t + s.minutos, 0);

    /* Quién puede atender TODA la selección: el profesional tiene que prestar
       cada uno de los servicios, no solo alguno. Si no, se ofrecerían cupos
       con alguien que no hace la mitad de la cita. */
    const profs = await sql`
      SELECT p.id, p.nombre, p.dias_libres
        FROM profesional p
        JOIN servicio_profesional sp ON sp.profesional_id = p.id
       WHERE p.activo AND sp.servicio_id = ANY(${ids})
       GROUP BY p.id, p.nombre, p.dias_libres
      HAVING COUNT(DISTINCT sp.servicio_id) = ${ids.length}
       ORDER BY p.nombre`;
    if (!profs.length) return json(res, 200, { duracion, profesionales: [], cupos: {} });

    const dow = new Date(fecha + 'T12:00:00Z').getUTCDay();
    /* Quien tiene libre ese día de la semana sale de la lista: «Valentina no
       viene los lunes». Se filtra AQUÍ y no en la consulta de arriba porque el
       día de la semana se acaba de calcular. */
    const disponibles = profs.filter(p => (p.dias_libres || []).indexOf(dow) === -1);
    const elegidos = profesional
      ? disponibles.filter(p => String(p.id) === String(profesional))
      : disponibles;

    if (!elegidos.length) {
      /* Puede pasar que el único que presta el servicio esté descansando. No es
         que el local esté cerrado: es que ese día no hay quien lo haga. */
      return json(res, 200, { duracion, profesionales: [], cupos: {}, cerrado: true });
    }

    const hor = await sql`
      SELECT abre, cierra, abierto FROM horario WHERE dow = ${dow}`;
    if (!hor.length || !hor[0].abierto) {
      return json(res, 200, { duracion, profesionales: elegidos, cupos: {}, cerrado: true });
    }

    const abre   = aUTC(fecha, String(hor[0].abre).slice(0, 5));
    const cierra = aUTC(fecha, String(hor[0].cierra).slice(0, 5));
    /* Cierre pasada la medianoche: la hora de cierre cae al día siguiente. */
    if (cierra <= abre) cierra.setUTCDate(cierra.getUTCDate() + 1);

    const desde = new Date(Date.now() + COLCHON_MIN * 60000);

    const ocupado = await sql`
      SELECT profesional_id, inicio, fin FROM cita
       WHERE estado = 'confirmada' AND inicio < ${cierra.toISOString()} AND fin > ${abre.toISOString()}`;
    const bloqueos = await sql`
      SELECT profesional_id, inicio, fin FROM bloqueo
       WHERE inicio < ${cierra.toISOString()} AND fin > ${abre.toISOString()}`;

    const cupos = {};
    for (const p of elegidos) {
      const ocupa = [
        ...ocupado.filter(o => o.profesional_id === p.id),
        ...bloqueos.filter(b => b.profesional_id === null || b.profesional_id === p.id)
      ].map(o => [new Date(o.inicio).getTime(), new Date(o.fin).getTime()]);

      const libres = [];
      for (let t = abre.getTime(); t + duracion * 60000 <= cierra.getTime(); t += PASO_MIN * 60000) {
        const fin = t + duracion * 60000;
        if (t < desde.getTime()) continue;
        if (ocupa.some(([a, b]) => t < b && fin > a)) continue;
        libres.push(new Intl.DateTimeFormat('es-CO', {
          timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date(t)));
      }
      cupos[p.id] = libres;
    }

    return json(res, 200, { duracion, profesionales: elegidos, cupos });
  } catch (e) {
    console.error('disponibilidad', e);
    return json(res, 500, { error: 'No se pudo consultar la agenda' });
  }
}

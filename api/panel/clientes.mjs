/* GET /api/panel/clientes?q=texto
   Busca por nombre o teléfono para el formulario de crear cita.

   Devuelve pocos resultados a propósito: es un buscador para teclear tres
   letras y elegir, no un listado que haya que recorrer. */
import { sql, json } from '../_db.mjs';
import { protegido } from '../_auth.mjs';

export default protegido(async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });
  const q = String(req.query.q || '').trim();
  try {
    const patron = '%' + q.replace(/[%_]/g, '') + '%';
    const clientes = q
      ? await sql`SELECT id, nombre, telefono FROM cliente
                   WHERE nombre ILIKE ${patron} OR telefono ILIKE ${patron}
                   ORDER BY nombre LIMIT 12`
      /* Sin búsqueda se ofrecen los últimos que vinieron: en un local pequeño
         casi siempre el que llama es uno de ellos. */
      : await sql`SELECT DISTINCT ON (c.id) c.id, c.nombre, c.telefono, MAX(ci.inicio) AS ultima
                    FROM cliente c JOIN cita ci ON ci.cliente_id = c.id
                   GROUP BY c.id ORDER BY c.id, ultima DESC LIMIT 12`;
    return json(res, 200, { clientes });
  } catch (e) {
    console.error('clientes', e);
    return json(res, 500, { error: 'No se pudo buscar' });
  }
});

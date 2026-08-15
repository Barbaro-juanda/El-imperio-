/* GET /api/catalogo
   Lo que el panel publica hacia la página: carta de servicios, horario del
   local y productos de la vitrina.

   Va todo en una sola llamada y no en tres porque la página los necesita a la
   vez, al cargar, y tres viajes desde un celular en la calle son tres
   oportunidades de que uno llegue tarde y la página se pinte a medias. Además
   cada archivo bajo /api cuenta como una función serverless, y el plan Hobby
   admite doce.

   Es pública: no lleva sesión ni la necesita. Todo lo que devuelve ya está a
   la vista de cualquiera que entre al sitio —precios, horario, qué se vende—.
   Lo que no sale de aquí es igual de importante: nada de costos, márgenes,
   comisiones, claves ni existencias exactas. */
import { sql, json } from './_db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });

  try {
    /* Los servicios llegan con la lista de quién los presta. La página la usa
       para saltarse el paso de barbero cuando lo hace una sola persona: quien
       viene por las uñas no debería tener que «elegir» entre una opción. */
    const servicios = await sql`
      SELECT s.id, s.segmento, s.nombre, s.precio, s.minutos, s.descripcion,
             s.solo_adicional,
             /* Se agrega p.id y no sp.profesional_id: el JOIN filtra por activo,
                pero la fila de servicio_profesional sigue existiendo para quien
                ya no está en el equipo. Contando el id de la tabla enlazada,
                quien está inactivo desaparece de la cuenta —que es lo que
                decide si el paso de barbero se salta o no—. */
             COALESCE(array_agg(p.id ORDER BY p.id)
                      FILTER (WHERE p.id IS NOT NULL), '{}') AS profesionales
        FROM servicio s
        LEFT JOIN servicio_profesional sp ON sp.servicio_id = s.id
        LEFT JOIN profesional p ON p.id = sp.profesional_id AND p.activo
       WHERE s.activo
       GROUP BY s.id
       ORDER BY s.segmento, s.nombre`;

    const horario = await sql`SELECT dow, abre, cierra, abierto FROM horario ORDER BY dow`;

    /* Productos: solo los que están a la venta y de los que queda algo. Anunciar
       en la página algo que no está en la vitrina es prometer lo que no se
       puede cumplir. La cantidad exacta no sale: al cliente no le sirve y es
       información del negocio. */
    let productos = [];
    try {
      productos = await sql`
        SELECT id, nombre, marca, descripcion, precio
          FROM producto
         WHERE activo AND existencias > 0
         ORDER BY nombre`;
    } catch (e) {
      /* La tabla puede no existir todavía si no se ha corrido la migración 05.
         Que falte el inventario no puede tumbar la carta ni el horario, que es
         de lo que depende poder reservar. */
      productos = [];
    }

    /* Un minuto de caché en el borde y otro sirviendo lo viejo mientras se
       revalida. La carta cambia unas pocas veces al año: sin esto, cada visita
       despierta la base para leer lo mismo. Con esto, el cambio hecho en el
       panel tarda como mucho un minuto en verse, que es de sobra. */
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify({
      servicios: servicios.map(s => ({
        ...s,
        precio: s.precio === null ? null : Number(s.precio),
        profesionales: (s.profesionales || []).map(Number)
      })),
      horario: horario.map(h => ({
        dow: h.dow,
        abre: String(h.abre).slice(0, 5),
        cierra: String(h.cierra).slice(0, 5),
        abierto: h.abierto
      })),
      productos
    }));
  } catch (e) {
    console.error('catalogo', e);
    return json(res, 500, { error: 'No se pudo cargar el catálogo' });
  }
}

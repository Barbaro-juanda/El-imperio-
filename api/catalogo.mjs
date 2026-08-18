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

/* Huella de todo lo que la página enseña. Si cambia un precio, un horario, un
   nombre del equipo o un producto, cambia la huella.

   Existe para que la página pueda preguntar «¿ha cambiado algo?» sin traerse
   el catálogo entero. La respuesta son treinta y dos caracteres contra unos
   seis kilobytes, y eso es lo que hace viable preguntarlo cada veinte segundos
   en vez de solo al cargar.

   Se calcula sobre las filas en vez de guardar un contador que se sube en cada
   escritura. Un contador se olvida: basta que alguien corrija un precio por SQL
   —o que un camino de escritura nuevo no lo suba— para que la página se quede
   convencida de que nada cambió. La huella no se puede desincronizar porque no
   es un dato aparte, es un resumen de los datos. Las tablas son de decenas de
   filas; recorrerlas cuesta menos que la latencia de la propia llamada. */
async function huella() {
  const partes = [];

  const a = await sql`
    SELECT md5(string_agg(
             id || ':' || COALESCE(precio::text, '-') || ':' || minutos || ':' ||
             activo || ':' || nombre || ':' || COALESCE(descripcion, '') || ':' ||
             segmento || ':' || solo_adicional || ':' || precio_desde, ',' ORDER BY id)) AS v
      FROM servicio`;
  partes.push(a[0] && a[0].v);

  const b2 = await sql`
    SELECT md5(string_agg(dow || ':' || abre || ':' || cierra || ':' || abierto,
                          ',' ORDER BY dow)) AS v FROM horario`;
  partes.push(b2[0] && b2[0].v);

  const c = await sql`
    SELECT md5(string_agg(id || ':' || nombre || ':' || COALESCE(foto, '') || ':' || activo,
                          ',' ORDER BY id)) AS v FROM profesional`;
  partes.push(c[0] && c[0].v);

  /* Quién presta qué. Entra en la huella porque de ahí sale el oficio con el
     que se agrupa el equipo en la página: quitarle los cortes a alguien lo
     mueve de «Barberos» a «Manicurista», y eso es un cambio visible. */
  const e = await sql`
    SELECT md5(string_agg(servicio_id || ':' || profesional_id, ',' 
                          ORDER BY servicio_id, profesional_id)) AS v
      FROM servicio_profesional`;
  partes.push(e[0] && e[0].v);

  /* Los descansos. Marcar un festivo desde el panel tiene que apagar ese día en
     el calendario del cliente sin que nadie recargue. */
  try {
    const dsc = await sql`
      SELECT md5(string_agg(fecha::text || ':' || COALESCE(profesional_id::text, 'local'),
                            ',' ORDER BY fecha, profesional_id)) AS v FROM descanso`;
    partes.push(dsc[0] && dsc[0].v);
  } catch (e) { partes.push('sin-descansos'); }

  /* La galería. Entra en la huella para que una foto nueva llegue a la página
     sin recargar, igual que un precio. No se resume su contenido —serían megas
     de base64 en cada comprobación— sino qué fotos hay y cuándo se tocaron, que
     es lo único que puede cambiar. */
  try {
    const g = await sql`
      SELECT md5(string_agg(id || ':' || activo || ':' || alt || ':' || orden || ':' ||
                            extract(epoch from actualizado), ',' ORDER BY id)) AS v
        FROM galeria`;
    partes.push(g[0] && g[0].v);
  } catch (e) { partes.push('sin-galeria'); }

  /* Igual que en el listado: que falte el inventario no puede tumbar esto. */
  try {
    const d = await sql`
      SELECT md5(string_agg(id || ':' || nombre || ':' || precio || ':' || existencias || ':' || activo,
                            ',' ORDER BY id)) AS v FROM producto`;
    partes.push(d[0] && d[0].v);
  } catch (e) { partes.push('sin-inventario'); }

  return partes.map(x => x || '-').join('|');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Solo GET' });

  /* Consulta barata: solo la huella. Es lo que la página pregunta en bucle. */
  if (req.query.solo === 'version') {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).send(JSON.stringify({ version: await huella() }));
    } catch (e) {
      console.error('catalogo version', e);
      return json(res, 500, { error: 'No se pudo consultar' });
    }
    return;
  }

  try {
    /* Los servicios llegan con la lista de quién los presta. La página la usa
       para saltarse el paso de barbero cuando lo hace una sola persona: quien
       viene por las uñas no debería tener que «elegir» entre una opción. */
    const servicios = await sql`
      SELECT s.id, s.segmento, s.nombre, s.precio, s.minutos, s.descripcion,
             s.solo_adicional, s.precio_desde,
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

    /* Los días que el local cierra entero, para que el calendario del cliente
       los pinte apagados en vez de dejarle pulsar y descubrir que no hay nada.
       Solo los del local: que Valentina esté de vacaciones no cierra el día, y
       decirlo en la portada sería contar de más sobre el equipo. */
    let descansos = [];
    try {
      const d = await sql`
        SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, motivo
          FROM descanso
         WHERE profesional_id IS NULL AND fecha >= CURRENT_DATE
         ORDER BY fecha`;
      descansos = d;
    } catch (e) { /* sin la migración 15 todavía */ }

    /* El equipo que sale en «El Equipo». Solo los activos y en el orden en que
       entraron, que es el que el local reconoce. No sale la comisión, ni el
       horario personal, ni si tiene clave: eso es de dentro.

       El oficio se DEDUCE de lo que cada quien presta, en vez de guardarse en
       una columna aparte. Quien corta el pelo es barbero; quien no corta pero
       hace uñas es manicurista. Una columna habría que acordarse de llenarla al
       dar de alta a alguien, y el día que se olvide la persona aparece en el
       grupo equivocado sin que nada avise. Deducirlo no se puede olvidar: sale
       de los servicios que ya hay que asignarle igualmente para que se le pueda
       reservar.

       Si algún día alguien hace las dos cosas, sale como barbero. Entonces
       tocará una columna de verdad, no antes. */
    const equipo = await sql`
      SELECT p.id, p.nombre,
             /* Si la foto se subió desde el panel viene incrustada, y así
                viajaría entera en cada catálogo. Se cambia por una dirección
                que la sirve aparte y cacheada; el resumen del contenido va en
                la URL, así que cambiarla desde el panel cambia la dirección y
                nadie se queda con la vieja. Las rutas de archivo que ya venían
                en el repositorio pasan tal cual. */
             CASE WHEN p.foto LIKE 'data:%'
                  THEN '/api/galeria?prof=' || p.id || '&v=' || substr(md5(p.foto), 1, 8)
                  ELSE p.foto END AS foto,
             CASE
               WHEN EXISTS (SELECT 1 FROM servicio_profesional sp
                              JOIN servicio s ON s.id = sp.servicio_id
                             WHERE sp.profesional_id = p.id AND s.activo
                               AND s.segmento = 'cortes') THEN 'barbero'
               WHEN EXISTS (SELECT 1 FROM servicio_profesional sp
                              JOIN servicio s ON s.id = sp.servicio_id
                             WHERE sp.profesional_id = p.id AND s.activo
                               AND s.segmento = 'unas') THEN 'manicurista'
               ELSE 'equipo'
             END AS oficio
        FROM profesional p WHERE p.activo ORDER BY p.id`;

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
      productos,
      equipo,
      descansos,
      version: await huella()
    }));
  } catch (e) {
    console.error('catalogo', e);
    return json(res, 500, { error: 'No se pudo cargar el catálogo' });
  }
}

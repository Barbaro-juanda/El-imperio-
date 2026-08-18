/* =========================================================
   The Imperial Clasic Barber — landing + flujo de reserva
   ========================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------
     Analítica — envuelve gtag() para no romper si GA4 no
     cargó (bloqueador de anuncios, sin red) y para poder ver
     los eventos en consola durante desarrollo local.
     ------------------------------------------------------ */
  const DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
  function track(eventName, params) {
    if (DEV) console.debug('[analytics]', eventName, params || {});
    if (typeof window.gtag === 'function') window.gtag('event', eventName, params || {});
  }

  /* ------------------------------------------------------
     Datos
     ------------------------------------------------------ */
  /* Carta real del local. Sin duraciones: no se muestran en ninguna parte y el
     calendario reparte espacios fijos. `price: null` = precio según diseño; esos
     no suman al total y el recibo lo advierte en vez de inventar una cifra.

     Precios y segmentos tomados de la página de reservas del propio local
     (beunik.co/entity-view/1414), que es donde se agenda hoy de verdad.

     `group` es el segmento: agrupa la carta de la portada y las pestañas del
     paso 1 de la reserva. Cualquier servicio puede abrir una cita —quien viene
     solo por las cejas no debería tener que elegir un corte primero—, así que
     no hay lista de «principales». `destacado` resalta la fila en la carta.
     `min` es la duración en minutos —no se muestra en ninguna parte, pero de
     ella salen los cupos de la agenda—. `sinBarbero` salta el paso de barbero
     cuando el servicio lo presta una sola persona: nueve de los doce de uñas
     los hace solo Valentina, pero la base rubber, el press-on y su retiro los
     prestan los tres, así que ahí sí hay a quién elegir. */
  /* No es constante: el catálogo del panel la reemplaza al cargar. */
  let SEGMENTOS = {
    cortes:     'Cortes',
    cejas:      'Cejas',
    facial:     'Limpieza facial',
    unas:       'Uñas',
    color:      'Color y tratamiento',
    depilacion: 'Depilación facial'
  };

  /* Segmentos de los que solo tiene sentido llevar una cosa: no se piden dos
     cortes en la misma cita, ni dos diseños de cejas. Elegir otro reemplaza al
     anterior en vez de sumarlo.

     Depilación facial entra aquí aunque parezca que se combinan zonas: la
     carta ya trae «nariz y oídos» como una sola línea, así que elegir nariz y
     luego oídos por separado es la forma cara de pedir lo mismo. Con una sola
     opción, quien quiere las dos zonas coge la que las junta.

     Limpieza facial sigue admitiendo varios: ahí sí son tratamientos que se
     suman a un mismo ritual. */
  /* Uñas NO está aquí: se pueden combinar varios. Manicura y pedicura en la
     misma cita es lo normal, y también añadir decoración o un retiro a lo que
     ya se eligió. Los demás segmentos sí son de una sola cosa: nadie pide dos
     cortes ni dos diseños de cejas en la misma silla. */
  const UNICO = ['cortes', 'color', 'cejas', 'depilacion'];

  /* Respaldo. Se ve al instante, se indexa y funciona sin API; cuando llega
     el catálogo de la base se reemplaza entero. */
  let SERVICES = [
    // — Cortes —
    { id: 'corte-sencillo', group: 'cortes', name: 'Corte Sencillo', price: 35000, desc: 'Lavado de cabello y peinado.', min: 45 },
    { id: 'corte-vip', group: 'cortes', name: 'Corte VIP', price: 45000, desc: 'Bebida de cortesía, limpieza facial y vapor ozono.', destacado: true, min: 60 },
    { id: 'corte-barba-senc', group: 'cortes', name: 'Corte y Barba Sencillo', price: 48000, desc: 'Corte y barba, con lavado y peinado.', min: 60 },
    { id: 'corte-barba-vip', group: 'cortes', name: 'Corte y Barba VIP', price: 60000, desc: 'Todo el VIP, con la barba incluida.', destacado: true, min: 90 },
    { id: 'ritual-barba', group: 'cortes', name: 'Ritual de Barba', price: 26000, desc: 'Limpieza facial, afeitado con vapor y diseño.', min: 30 },
    { id: 'barba-sencilla', group: 'cortes', name: 'Barba Sencilla', price: 15000, desc: 'Diseño de barba y afeitado.', min: 30 },
    { id: 'pigmentacion', group: 'cortes', name: 'Pigmentación', price: 20000, desc: 'Densifica barba o cuero cabelludo.', min: 30 },

    // — Color y tratamiento —
    { id: 'colorimetria', group: 'color', name: 'Colorimetría', price: null, nota: 'Según diseño, color y cabello', desc: 'Platinados, rayos, plumillas y más.' },
    { id: 'freestyle', group: 'color', name: 'Freestyle', price: null, nota: 'Según diseño', desc: 'Dibujo tallado en el cuero cabelludo.' },
    { id: 'hidrocauterizacion', group: 'color', name: 'Hidrocauterización capilar', price: null, nota: 'Según largo y densidad', desc: 'Sella la cutícula y controla el frizz.' },

    // — Depilación facial —
    { id: 'dep-nariz-oidos', group: 'depilacion', name: 'Depilación de nariz y oídos', price: 25000, nota: 'Desde', desc: 'Las dos zonas en una sola sesión.', min: 15 },
    { id: 'dep-nasales', group: 'depilacion', name: 'Depilación de fosas nasales', price: 15000, desc: 'Depilación con cera.', min: 15 },
    { id: 'dep-oidos', group: 'depilacion', name: 'Depilación de oídos', price: 15000, desc: 'Depilación con cera.', min: 15 },

    // — Cejas —
    { id: 'cejas-hilo', group: 'cejas', name: 'Cejas con hilo', price: 20000, desc: 'Depilación con hilo y diseño de cejas.', min: 20 },
    { id: 'cejas-cuchilla', group: 'cejas', name: 'Cejas con cuchilla', price: 10000, desc: 'Depilación con cuchilla y diseño de cejas.', min: 15 },

    // — Limpieza facial —
    { id: 'ritual-facial', group: 'facial', name: 'Ritual Facial', price: 56000, desc: 'Vapor ozono, mascarillas, parches y masaje ocular.', destacado: true, min: 45 },
    { id: 'masc-negros', group: 'facial', name: 'Mascarilla de puntos negros', price: 16000, desc: 'Retira impurezas y exceso de grasa.', min: 15 },
    { id: 'masc-hialuronico', group: 'facial', name: 'Mascarilla de hialurónico', price: 20000, desc: 'Piel hidratada y de aspecto más joven.', min: 15 },
    { id: 'masajeador', group: 'facial', name: 'Masajeador ocular', price: 20000, desc: 'Reduce líneas de expresión y ojeras.', min: 10 },
    { id: 'parches-ojeras', group: 'facial', name: 'Parches para ojeras', price: 10000, desc: 'Hidrata y mejora el contorno de ojos.', min: 30 },

    // — Uñas —
    { id: 'manos-pies', group: 'unas', name: 'Manos y pies', price: null, nota: 'Consultar', desc: 'Manicura y pedicura en una sola cita.', destacado: true, min: 120, sinBarbero: true },
    { id: 'manos-tradicional', group: 'unas', name: 'Manos Tradicionales', price: 30000, desc: 'Limado, cutícula y esmalte tradicional.', min: 45, sinBarbero: true },
    { id: 'pies-tradicional', group: 'unas', name: 'Pies Tradicional', price: 35000, desc: 'Limado, cutícula y esmalte en los pies.', min: 45, sinBarbero: true },
    { id: 'manos-semi', group: 'unas', name: 'Manos Semipermanentes', price: 40000, desc: 'Esmalte semipermanente, con brillo que dura semanas.', min: 60, sinBarbero: true },
    { id: 'pies-semi', group: 'unas', name: 'Pies Semipermanente', price: 45000, desc: 'Semipermanente en pies, de larga duración.', min: 60, sinBarbero: true },
    { id: 'rubber', group: 'unas', name: 'Manicura con Base Rubber', price: 65000, desc: 'Base rubber: uñas más fuertes y parejas.', destacado: true, min: 60 },
    { id: 'press-on', group: 'unas', name: 'Extensión Press-on', price: 100000, desc: 'Extensiones aplicadas al momento, largo a elección.', min: 120 },
    { id: 'decoracion', group: 'unas', name: 'Decoración y diseño de uñas', price: null, nota: 'Consultar', desc: 'Diseño a mano, del detalle simple al completo.', min: 30, sinBarbero: true },
    { id: 'stiker', group: 'unas', name: 'Stiker y pedrería', price: 3000, desc: 'Apliques y pedrería para rematar el diseño.', min: 5, sinBarbero: true },
    { id: 'velo', group: 'unas', name: 'Velo Terapia', price: 6000, desc: 'Parafina tibia y masaje: nutre y suaviza.', min: 5, sinBarbero: true },
    { id: 'retiro-presson', group: 'unas', name: 'Retiro de Press-on', price: 15000, desc: 'Retiro cuidado, sin dañar la uña natural.', min: 30 },
    { id: 'retiro-semi', group: 'unas', name: 'Retiro de Semipermanente', price: 5000, desc: 'Retiro del esmalte sin desgastar la uña.', min: 10, sinBarbero: true },
  ];

  const byId = id => SERVICES.find(s => s.id === id);

  /* Barberos reales del local. `spec` va vacío a propósito: los tres nombres y
     especialidades anteriores (Mateo/Samuel/Tomás) eran relleno del diseño, y no
     sé cuál es la especialidad real de Emanuel y Simon — inventarla sería
     atribuirle una destreza a una persona real. Al llenarla, la línea aparece
     sola.

     Los nombres se contrastaron con la página de reservas del local: la foto
     que decía «Ema» es literalmente el mismo avatar que allí figura como
     Emanuel Gómez, así que ese queda confirmado. «Simon» NO aparece entre los
     profesionales agendables, y la foto tampoco corresponde a Jeronimo Garcia
     —son dos personas distintas—, así que se deja como está hasta confirmar
     con el local. Faltan por sumar Jeronimo Garcia y Valentina Romero, que sí
     reciben citas allí. */
  /* Respaldo del equipo, igual que SERVICES: se ve al instante y sin API, y el
     catálogo lo reemplaza con quien esté activo en la base. */
  let BARBERS = [
    { id: 1, name: 'Emanuel', spec: '', photo: 'assets/barbero-ema.jpg', oficio: 'barbero',
      alt: 'Emanuel, barbero de The Imperial Clasic, apoyado en la silla de barbería' },
    /* Sin id: no figura entre los profesionales que reciben citas. Se muestra
       en la portada porque trabaja en el local, pero su tarjeta no preselecciona
       a nadie al abrir la reserva —hacerlo agendaría con quien no existe en la
       agenda—. En cuanto el local confirme quién es, se le pone su id. */
    { id: null, name: 'Simon', spec: '', photo: 'assets/barbero-simon.jpg', oficio: 'barbero',
      alt: 'Simon, barbero de The Imperial Clasic, de brazos cruzados en el local' }
  ];

  /* Fotos por id de profesional. La base guarda la ruta, pero Jeronimo y
     Valentina todavía no tienen foto propia en el sitio. */
  const FOTO_PROF = { 1: 'assets/barbero-ema.jpg' };

  /* Equipo que puede atender lo elegido. Lo llena la API en cuanto cambia la
     selección; vacío mientras no haya respuesta. */
  let PROFS = [];
  /* Por qué falló la última carga del equipo, o null si fue bien. */
  let PROFS_ERROR = null;
  const profPorId = id => PROFS.find(p => p.id === id) || null;

  /* REVIEWS se eliminó: los tres testimonios eran inventados por el diseño.
     La sección ahora muestra la calificación real de Google, que es HTML
     estático y no necesita render. Al conseguir reseñas reales, volver a
     declarar el arreglo aquí y reponer renderReviews(). */

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  /* Perfil de Instagram. El href del pie se toma de aquí, así queda un solo
     sitio que tocar si cambia. Si se deja vacío, el enlace se oculta en vez
     de llevar a ninguna parte. */
  const INSTAGRAM_URL = 'https://www.instagram.com/theimperialclasic_/';

  /* Los días de la semana en que no hay nadie: cuando todo el equipo tiene ese
     día libre. Llega del catálogo; vacío hasta entonces. */
  let SEMANA_CERRADA = [];

  const SHOP = {
    name: 'The Imperial Clasic Barber',
    address: 'Prados de Sabaneta, Antioquia, Colombia',
    /* El mismo número que sale en Ubicación. Escrito una vez: dos copias es
       una que se queda vieja el día que lo cambien. */
    whatsapp: '573145832948',
    utcOffsetHours: -5 // America/Bogota, sin horario de verano
  };

  /* La API vive en el mismo origen; en local no existe (el servidor de
     desarrollo solo sirve archivos), así que las llamadas fallan y la interfaz
     lo dice en vez de inventar horarios libres. Enseñar disponibilidad falsa
     es peor que no enseñar ninguna: alguien reservaría una hora que no existe. */
  const API = '/api';

  /* Mensaje para cuando la ruta ni siquiera existe. Pasa al abrir el sitio con
     un servidor de archivos —el de desarrollo entrega HTML y nada más—, y ahí
     decir «revisa tu conexión» manda a buscar el problema al sitio equivocado:
     la conexión está perfecta, lo que falta es el servidor. */
  const SIN_API = 'La reserva necesita el sitio publicado. Este servidor entrega ' +
                  'archivos pero no ejecuta la API.';

  async function pedir(ruta, opciones) {
    /* Un reintento, y solo para lecturas.

       La base se suspende sola cuando lleva un rato sin uso —es cómo funciona
       el plan en el que está—, y la primera consulta después de eso tiene que
       esperar a que despierte. A veces tarda más de lo que la función aguanta
       y responde 500. Es un fallo intermitente y engañoso: el visitante ve un
       error, recarga, y ya funciona, porque su primer intento fue justamente
       el que pagó el despertar.

       Reintentar una lectura es gratis: pedir dos veces la lista de barberos
       da la misma lista. Reintentar un POST NO lo es —crearía la cita dos
       veces—, así que las escrituras fallan a la primera y las decide quien
       llamó. */
    const metodo = (opciones && opciones.method) || 'GET';
    const puedeReintentar = metodo === 'GET';

    let ultimo = null;
    for (let intento = 0; intento < (puedeReintentar ? 2 : 1); intento++) {
      if (intento) await new Promise(r => setTimeout(r, 900));
      try {
        return await unaVez(ruta, opciones);
      } catch (e) {
        ultimo = e;
        /* Solo se reintenta lo que puede arreglarse solo: la base dormida (5xx)
           o un corte momentáneo (estado 0). Un 400 o un 404 van a fallar igual
           la segunda vez y esperar novecientos milisegundos para repetirlo solo
           hace que el error tarde más en verse. */
        const vale = e.estado === 0 || (e.estado >= 500 && e.estado < 600);
        if (!vale) throw e;
      }
    }
    throw ultimo;
  }

  async function unaVez(ruta, opciones) {
    let r;
    try {
      r = await fetch(API + ruta, opciones);
    } catch (e) {
      /* fetch solo rechaza si no hubo respuesta: sin red, DNS caído o CORS.
         Ese sí es un problema de conexión de verdad. */
      throw Object.assign(new Error('Sin conexión.'), { estado: 0 });
    }
    let cuerpo = null;
    try { cuerpo = await r.json(); } catch (e) { /* respuesta no JSON */ }
    if (!r.ok) {
      /* Un 404 sin cuerpo JSON no es «no encontrado»: es que la función no se
         está ejecutando. Con cuerpo sí es la API contestando de verdad. */
      const msg = (cuerpo && cuerpo.error) ||
                  (r.status === 404 ? SIN_API :
                   r.status >= 500 ? 'El servidor tardó en responder. Vuelve a intentarlo.' :
                   'Error ' + r.status);
      throw Object.assign(new Error(msg), { estado: r.status });
    }
    return cuerpo;
  }

  const money = n => '$' + n.toLocaleString('es-CO');
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const $  = sel => document.querySelector(sel);
  /* Devuelve un arreglo y no la NodeList, para poder usar indexOf y filter
     sin convertirla en cada sitio. */
  const $$ = sel => Array.prototype.slice.call(document.querySelectorAll(sel));
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  /* Los horarios los calcula el servidor con las duraciones reales y las citas
     ya tomadas. Aquí solo se guarda la última respuesta. */
  let CUPOS = { cargando: false, error: null, libres: [], clave: null };

  async function cargarCupos() {
    const ids = seleccion();
    if (!ids.length || !state.date || state.barber === null) return;
    const clave = ymd(state.date) + '|' + state.barber + '|' + ids.join(',');
    if (CUPOS.clave === clave && !CUPOS.error) return;
    CUPOS = { cargando: true, error: null, libres: [], clave };
    renderSlots();
    try {
      const r = await pedir('/disponibilidad?fecha=' + ymd(state.date) +
                            '&servicios=' + encodeURIComponent(ids.join(',')) +
                            '&profesional=' + state.barber);
      if (CUPOS.clave !== clave) return;            // llegó tarde, ya cambió la selección
      CUPOS = { cargando: false,
                error: r.descansa ? 'descansa' : r.cerrado ? 'cerrado' : null,
                quien: r.descansa || null,
                libres: (r.cupos && r.cupos[state.barber]) || [], clave };
    } catch (e) {
      if (CUPOS.clave !== clave) return;
      CUPOS = { cargando: false, error: e.message || 'sin conexión', libres: [], clave };
    }
    renderSlots();
    render();
  }

  /* ------------------------------------------------------
     Landing
     ------------------------------------------------------ */
  function barberCard(b, index, onPick) {
    const card = el('button', 'barber');
    card.type = 'button';
    card.setAttribute('aria-pressed', 'false');
    card.dataset.barber = String(index);
    card.innerHTML =
      '<img class="barber__photo" loading="lazy" decoding="async">' +
      '<span class="barber__body">' +
        '<span class="barber__name"></span>' +
        '<span class="barber__spec"></span>' +
        '<span class="barber__tag">Elegir</span>' +
      '</span>';
    const img = card.querySelector('.barber__photo');
    if (b.photo) {
      img.src = b.photo;
      /* El alt describe la foto (sirve para buscadores y si la imagen no
         carga), y el botón lleva su propio aria-label para que el lector de
         pantalla no lea el nombre dos veces. */
      img.alt = b.alt || '';
    } else {
      /* Sin foto NO se deja un <img> vacío: el navegador pinta el icono de
         imagen rota con el alt desbordado encima, que se ve peor que no tener
         foto. Se sustituye por la inicial, que llena el mismo hueco y no
         parece un error. Que a alguien le falte el retrato es normal —entra
         al equipo antes de que haya sesión de fotos—. */
      const ini = el('span', 'barber__photo barber__inicial');
      ini.setAttribute('aria-hidden', 'true');
      ini.textContent = String(b.name || '?').trim().charAt(0).toUpperCase();
      img.replaceWith(ini);
    }
    card.setAttribute('aria-label', 'Elegir a ' + b.name);
    card.querySelector('.barber__name').textContent = b.name;
    const spec = card.querySelector('.barber__spec');
    if (b.spec) spec.textContent = b.spec; else spec.remove();
    card.addEventListener('click', () => onPick(b.id, index));
    return card;
  }

  /* Rótulo del grupo. En plural o en singular según cuántos haya: «Manicurista»
     con una sola persona y «Manicuristas» con dos se lee como está escrito por
     alguien, no como una plantilla. */
  const ROTULO_OFICIO = {
    barbero:     ['Barbero', 'Barberos'],
    manicurista: ['Manicurista', 'Manicuristas'],
    equipo:      ['Equipo', 'Equipo']
  };

  /* El orden es el de la carta: primero lo que trae a la mayoría. Un oficio
     nuevo que no esté aquí va al final, en vez de desaparecer. */
  const ORDEN_OFICIO = ['barbero', 'manicurista', 'equipo'];

  function renderBarbers() {
    const wrap = $('#barbers-list');
    wrap.textContent = ''; // reemplaza el contenido estático (SEO/no-JS) por la versión con handlers

    const porOficio = {};
    BARBERS.forEach((b, i) => {
      const k = b.oficio || 'equipo';
      (porOficio[k] = porOficio[k] || []).push({ b, i });
    });

    const grupos = Object.keys(porOficio).sort((x, y) => {
      const a2 = ORDEN_OFICIO.indexOf(x), b2 = ORDEN_OFICIO.indexOf(y);
      return (a2 === -1 ? 99 : a2) - (b2 === -1 ? 99 : b2);
    });

    /* Con un solo grupo no se pone rótulo: «Barberos» encima de la única fila
       que hay no separa nada de nada, solo añade ruido. */
    const conRotulo = grupos.length > 1;

    grupos.forEach(k => {
      const caja = el('div', 'oficio');
      if (conRotulo) {
        const r = el('div', 'oficio__rot');
        const t = el('span');
        const par = ROTULO_OFICIO[k] || [k, k];
        t.textContent = porOficio[k].length === 1 ? par[0] : par[1];
        r.appendChild(t);
        caja.appendChild(r);
      }
      const rejilla = el('div', 'barbers');
      porOficio[k].forEach(({ b, i }) => rejilla.appendChild(tarjeta(b, i)));
      caja.appendChild(rejilla);
      wrap.appendChild(caja);
    });

    function tarjeta(b, i) {
      return barberCard(b, i, id => {
        /* Atajo desde la portada. Solo preselecciona si esa persona existe en la
           agenda; si no, abre la reserva sin barbero elegido en vez de dejar un
           id inválido que reventaría al pedir cupos. */
        state.barber = id;
        track('booking_started', { trigger_location: 'barber_card' });
        if (id !== null) track('barber_selected', { barber_name: b.name });
        syncBarberCards(wrap);
        openBooking(PASO_BARBERO);
      });
    }
  }

  function syncBarberCards(scope) {
    scope.querySelectorAll('.barber').forEach(card => {
      const on = card.dataset.barber !== '' && Number(card.dataset.barber) === state.barber;
      card.setAttribute('aria-pressed', String(on));
      const tag = card.querySelector('.barber__tag');
      if (tag) tag.textContent = on ? '⚜ Elegido' : 'Elegir';
    });
  }

  /* ------------------------------------------------------
     Estado de la reserva
     ------------------------------------------------------ */
  const state = {
    step: 1,
    service: null,   // id del servicio principal
    extras: [],      // ids de los adicionales elegidos
    barber: null,   // id de profesional en la base, no índice
    date: null,
    slot: null,
    month: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
    customer: { name: '', phone: '', email: '' },
    codigo: null   // el que devuelve el servidor al confirmar
  };

  const booking     = $('#booking');
  const panel       = booking.querySelector('.booking__panel');
  const heading     = $('#booking-heading');
  const counter     = $('#step-counter');
  const summary     = $('#step-summary');
  const progress    = $('#progress');
  const backBtn     = $('#back');
  const nextBtn     = $('#next');
  const stepFoot    = $('#step-foot');
  let lastFocused   = null;

  const PASOS = 5;
  const PASO_BARBERO = 2;

  /* Todo lo elegido, en orden: el primero es `service` y el resto `extras`.
     Se conserva esa forma porque el recibo, el .ics y la analítica distinguen
     el servicio de sus acompañantes. */
  const seleccion = () => [state.service, ...state.extras].filter(Boolean);
  const elegido   = id => seleccion().indexOf(id) !== -1;

  /* El paso de barbero no siempre aplica: las uñas las atiende una sola
     especialista. Solo se salta si NADA de lo elegido necesita barbero —una
     cita de corte + manicura sí tiene barbero que elegir. */
  function pasosActivos() {
    const items = seleccion().map(byId).filter(Boolean);
    const salta = items.length > 0 && items.every(s => s.sinBarbero);

    /* Cambiando una cita se recorren SOLO los pasos que se pidieron cambiar, y
       nunca el de los datos: el nombre y el celular ya están, y volver a pedir
       un formulario entero para mover una hora es exactamente lo que hace que
       la gente abandone y reserve otra vez. */
    if (cambiando && quiereCambiar.length) {
      return quiereCambiar
        .filter(n => !(salta && n === PASO_BARBERO))
        .concat([PASOS]);
    }

    return [1, 2, 3, 4, 5].filter(n => !(salta && n === PASO_BARBERO));
  }
  const saltaBarbero = () => !pasosActivos().includes(PASO_BARBERO);
  const TITLES = [
    '¿Qué te vas a <em>hacer</em>?',
    'Elige tu <em>barbero</em>',
    'Fecha y <em>hora</em>',
    'Tus <em>datos</em>',
    ''
  ];

  function longDate(d) {
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()].toLowerCase();
  }
  function shortDate(d) {
    return WEEKDAYS_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
  }

  /* Suma de la cita. Los servicios de precio variable no suman una cifra: se
     devuelven aparte para poder decirlo en vez de inventar un número. */
  function totales() {
    const items = [state.service, ...state.extras].filter(Boolean).map(byId).filter(Boolean);
    return {
      items,
      fijo: items.reduce((n, s) => n + (s.price || 0), 0),
      variables: items.filter(s => s.price === null)
    };
  }

  /* Texto del total. Si todo lo elegido es de precio variable, el fijo es 0 y
     mostrar "$0 + según diseño" se lee como si algo estuviera roto. */
  function totalTexto() {
    const t = totales();
    if (!t.variables.length) return money(t.fijo);
    return t.fijo > 0 ? money(t.fijo) + ' + según diseño' : 'Según diseño';
  }

  function summaryFor(step) {
    const s = state.service ? byId(state.service) : null;
    const b = state.barber !== null ? profPorId(state.barber) : null;
    const especialista = saltaBarbero() ? 'Especialista' : null;
    const extras = state.extras.length ? '+' + state.extras.length : '';
    if (step === 1) return '⚜ Reserva';
    if (step === 2) return [s && s.name, extras].filter(Boolean).join(' ');
    if (step === 3) return [s && s.name, (b && b.name) || especialista].filter(Boolean).join(' · ');
    if (step === 4) return state.date && state.slot ? shortDate(state.date) + ' · ' + state.slot : '';
    return 'Confirmada';
  }

  /* Primer paso que aún no está completo. Sirve para no dejar al visitante
     más adelante de donde sus datos alcanzan: si entra por un atajo (p. ej.
     tocando un barbero en la portada) se le lleva al primer hueco real.
     El paso 2 (adicionales) es opcional, así que nunca frena el avance. */
  /* Qué agenda se consulta. Con barbero, la suya; sin barbero (manicura) la de
     la especialista, que es una persona distinta y por tanto otra ocupación. */
  function agendaDe() {
    return state.barber !== null ? state.barber : 'especialista';
  }

  function firstIncompleteStep() {
    if (!state.service) return 1;
    if (!saltaBarbero() && state.barber === null) return PASO_BARBERO;
    if (!state.date || !state.slot) return 3;
    return 4;
  }

  /* Los requisitos son acumulativos, no solo los del paso actual. Antes cada
     paso miraba únicamente su propio campo, así que se podía llegar al final
     sin servicio y la confirmación reventaba al leer su precio. */
  function canAdvance() {
    if (!state.service) return false;
    if (!saltaBarbero() && state.step >= PASO_BARBERO && state.barber === null) return false;
    if (state.step >= 3 && !(state.date && state.slot)) return false;
    return true;
  }

  function render() {
    const step = state.step;
    panel.dataset.step = String(step);

    booking.querySelectorAll('.step').forEach(s => {
      s.hidden = Number(s.dataset.step) !== step;
    });

    const pasos = pasosActivos();
    const pos = pasos.indexOf(step) + 1;
    counter.textContent = step === 0
      ? 'Tu cita actual'
      : 'Paso ' + pos + ' de ' + pasos.length;
    summary.textContent = summaryFor(step);
    heading.innerHTML = step === 0
      ? 'Modificar tu <em>cita</em>'
      : TITLES[step - 1];
    heading.hidden = step === PASOS;

    /* La barra se dibuja con un segmento por paso aplicable: si el de barbero
       se salta, quedan cinco y no un hueco. */
    if (progress.children.length !== pasos.length) {
      progress.textContent = '';
      pasos.forEach(() => progress.appendChild(el('span')));
    }
    Array.prototype.forEach.call(progress.children, (bar, i) => {
      bar.className = i + 1 < pos ? 'is-done' : (i + 1 === pos ? 'is-now' : '');
    });
    progress.setAttribute('aria-valuemax', String(pasos.length));
    progress.setAttribute('aria-valuenow', String(pos));

    /* El pie se queda en el paso 0 también. Quitarlo dejaba esa pantalla sin
       «Atrás» y sin salida visible: quien entraba por error solo tenía la ✕ de
       la esquina, y no todo el mundo la busca ahí. */
    stepFoot.hidden = step === PASOS;
    backBtn.hidden = step === 1;

    /* La entrada al modo de cambio solo se ofrece al empezar de cero. A mitad
       de una reserva estorba, y dentro del propio modo de cambio no tiene
       sentido. */
    if (step === 0) {
      backBtn.textContent = '← Salir';
      /* «Continuar» no se activa hasta haber encontrado la cita: antes de eso
         no hay nada que continuar. Encontrada, lleva al paso 1 para revisarlo
         todo desde el principio; los tres botones de arriba son el atajo para
         ir directo a una cosa. */
      nextBtn.textContent = 'Continuar';
      nextBtn.className = 'btn btn--wine';
      nextBtn.disabled = !cambiando || !quiereCambiar.length;
    } else {
      backBtn.textContent = '← Atrás';
    }
    stepFoot.dataset.single = String(step === 1);

    pintarCotizacion(step);

    const esConfirmacion = step === PASOS - 1 || esUltimoDelCambio();
    nextBtn.textContent = esConfirmacion
      ? (cambiando ? 'Confirmar el cambio' : 'Confirmar reserva')
      : 'Continuar';
    nextBtn.className = 'btn ' + (esConfirmacion ? 'btn--gold' : 'btn--wine');
    /* Con algo a convenir no se puede seguir: la agenda no sabe cuánto dura ni
       cuánto cuesta lo que se acordará, y apartar dos horas para una cita cuyo
       precio nadie ha dicho todavía es la cancelación más cara posible. */
    nextBtn.disabled = !canAdvance() || (step === 1 && aConvenir().length > 0);

    /* Reflejar el estado en los selectores cada vez que se pinta, no solo al
       hacer clic. Si no, una selección hecha fuera del modal (el atajo del
       barbero en la portada) llega al paso 2 sin marcar y parece perdida. */
    syncPickServices();
    syncBarberCards($('#pick-barbers'));

    if (step === 3) { renderCalendar(); renderSlots(); cargarCupos(); }
  }

  const precioTexto = s => (s.price === null ? (s.nota || 'Consultar')
                                            : (s.desde ? 'Desde ' : '') + money(s.price));

  /* ------------------------------------------------------
     Servicios que se cotizan antes
     ------------------------------------------------------
     Cinco de los treinta y dos no tienen precio fijo: un platinado depende del
     largo, del color de partida y de lo castigado que venga el pelo, y eso no
     se sabe hasta ver la cabeza. Son además los más largos —dos de ellos de dos
     horas—, así que son justamente los que peor sienta perder.

     Antes se podían reservar igual, y el precio aparecía en el mostrador. Eso
     tiene dos finales malos: el cliente se echa atrás y se pierden dos horas de
     agenda que ya no se venden, o se queda sintiéndose emboscado. Ninguno de
     los dos lo arregla una cifra inventada.

     Así que no abren agenda: llevan a WhatsApp, donde el local pide una foto,
     da el precio y —si hay trato— crea la cita desde el panel. La hora se
     aparta cuando hay acuerdo, no antes. */
  const aConvenir = () =>
    [state.service].concat(state.extras).filter(Boolean)
      .map(byId).filter(s => s && s.price === null);

  function pintarCotizacion(step) {
    const caja = $('#cotiza');
    if (!caja) return;
    const pendientes = aConvenir();

    /* Solo en el paso 1: más adelante ya no hay nada a convenir, porque no se
       deja avanzar con ello. */
    caja.hidden = step !== 1 || !pendientes.length;
    if (caja.hidden) return;

    const nombres = pendientes.map(s => s.name);
    const otros = [state.service].concat(state.extras).filter(Boolean)
      .map(byId).filter(s => s && s.price !== null);

    $('#cotiza-txt').textContent = nombres.length === 1
      ? nombres[0] + ' se cotiza antes: el precio depende de tu cabello y hay que verlo. Te lo damos por WhatsApp y ahí mismo te apartamos la hora.'
      : 'Estos se cotizan antes —' + nombres.join(' y ') + '— porque el precio depende de tu cabello. Te lo damos por WhatsApp y ahí mismo te apartamos la hora.';

    /* El mensaje llega escrito: quien pide un precio no tiene por qué redactar
       nada, y al local le llega ya dicho qué quiere y con la foto pedida. */
    const texto = '¡Hola! Quiero cotizar ' + nombres.join(' y ') +
      (otros.length ? ' (y de paso ' + otros.map(s => s.name).join(' y ') + ')' : '') +
      '. Les mando una foto de mi cabello para que me digan el precio.';
    $('#cotiza-wa').href = 'https://wa.me/' + SHOP.whatsapp.replace(/\D/g, '') +
                           '?text=' + encodeURIComponent(texto);

    /* Salida para quien eligió una mezcla: se queda con lo que sí tiene precio
       y reserva normal, en vez de tener que volver a empezar. */
    const quitar2 = $('#cotiza-quitar');
    quitar2.hidden = !otros.length;
  }

  /* ---- paso 1: qué se va a hacer ----
     Un único paso segmentado. Antes había dos listas —«principales» y
     «adicionales»— y eso obligaba a elegir un corte para poder llegar a las
     cejas. Quien viene solo por las cejas ahora empieza por las cejas.
     La cita es la suma de lo elegido; el primero queda como `service` y el
     resto como `extras`, que es la forma que esperan el recibo y el .ics. */
  let segActivo = 'cortes';

  /* Saca un id de la selección venga de donde venga. Si era el principal,
     asciende el primer adicional para que no queden extras huérfanos. */
  function quitar(id) {
    if (state.service === id) { state.service = state.extras.shift() || null; return; }
    const i = state.extras.indexOf(id);
    if (i !== -1) state.extras.splice(i, 1);
  }

  function alternar(id) {
    if (state.service === id) {
      /* Se quita el principal: asciende el primer adicional para que la cita
         no quede con extras huérfanos y sin servicio. */
      state.service = state.extras.shift() || null;
      track('service_removed', { service_name: byId(id).name });
    } else {
      const i = state.extras.indexOf(id);
      if (i !== -1) {
        state.extras.splice(i, 1);
        track('service_removed', { service_name: byId(id).name });
      } else {
        /* Segmento de elección única: lo que hubiera de ese segmento sale. */
        const grupo = byId(id).group;
        if (UNICO.indexOf(grupo) !== -1) {
          seleccion().forEach(otro => {
            if (otro !== id && byId(otro) && byId(otro).group === grupo) quitar(otro);
          });
        }
        if (!state.service) {
          state.service = id;
          track('service_selected', { service_name: byId(id).name, service_price: byId(id).price });
        } else {
          state.extras.push(id);
          track('extra_added', { service_name: byId(id).name, service_price: byId(id).price });
        }
      }
    }
    /* Cambiar la selección puede activar o desactivar el paso de barbero. */
    if (saltaBarbero()) state.barber = null;
    CUPOS = { cargando: false, error: null, libres: [], clave: null };
    cargarProfesionales();
    render();
  }

  function renderSegs() {
    const cont = $('#segs');
    cont.textContent = '';
    Object.keys(SEGMENTOS).forEach(key => {
      const btn = el('button', 'seg');
      btn.type = 'button';
      btn.dataset.seg = key;
      btn.innerHTML = '<span class="seg__name"></span><span class="seg__count"></span>';
      btn.querySelector('.seg__name').textContent = SEGMENTOS[key];
      btn.addEventListener('click', () => {
        segActivo = key;
        renderPickServices();
        syncSegs();
        /* Seis pestañas no caben en un móvil: si la elegida quedó fuera de la
           tira, se trae a la vista o parece que no pasó nada. */
        btn.scrollIntoView({ block: 'nearest', inline: 'center' });
      });
      cont.appendChild(btn);
    });
  }

  /* El contador por segmento evita que lo elegido en otra pestaña se sienta
     perdido: son seis listas y solo se ve una. */
  function syncSegs() {
    $('#segs').querySelectorAll('.seg').forEach(btn => {
      const key = btn.dataset.seg;
      const n = seleccion().filter(id => byId(id) && byId(id).group === key).length;
      btn.setAttribute('aria-pressed', String(key === segActivo));
      btn.querySelector('.seg__count').textContent = n ? String(n) : '';
      btn.dataset.conSeleccion = String(n > 0);
    });
  }

  function renderPickServices() {
    const list = $('#pick-services');
    list.textContent = '';
    SERVICES.filter(s => s.group === segActivo).forEach(s => {
      const li = el('li');
      const btn = el('button', 'pick pick--multi');
      btn.type = 'button';
      btn.dataset.id = s.id;
      btn.innerHTML =
        '<span class="pick__name"></span>' +
        '<span class="pick__desc"></span>' +
        '<span class="pick__price"></span>' +
        '<span class="pick__check" aria-hidden="true"></span>';
      btn.querySelector('.pick__name').textContent = s.name;
      btn.querySelector('.pick__desc').textContent = s.desc;
      btn.querySelector('.pick__price').textContent = precioTexto(s);
      btn.addEventListener('click', () => alternar(s.id));
      li.appendChild(btn);
      list.appendChild(li);
    });
    syncPickServices();
  }

  function syncPickServices() {
    $('#pick-services').querySelectorAll('.pick').forEach(btn => {
      const on = elegido(btn.dataset.id);
      btn.setAttribute('aria-pressed', String(on));
      btn.querySelector('.pick__check').textContent = on ? '⚜' : '';
    });
    syncSegs();

    const resumen = $('#extras-total');
    if (!resumen) return;
    const n = seleccion().length;
    resumen.textContent = n ? totalTexto() : 'Sin servicios';
    const hint = $('#segs-hint');
    if (hint) hint.textContent = n
      ? (n === 1 ? '1 servicio elegido. Puedes sumar de otros segmentos.'
                 : n + ' servicios elegidos. Puedes sumar de otros segmentos.')
      : 'Elige uno o varios. Puedes combinar segmentos.';
  }

  /* ---- paso 3: barbero ---- */
  /* El equipo del paso 2 sale de la base, no de la lista local: quién puede
     atender depende de lo elegido —solo Valentina hace la pedicura— y esa
     verdad vive en el servidor. */
  async function cargarProfesionales() {
    const ids = seleccion();
    if (!ids.length) { PROFS = []; return; }
    try {
      const r = await pedir('/profesionales?servicios=' + encodeURIComponent(ids.join(',')));
      PROFS = r.profesionales || [];
      PROFS_ERROR = null;
    } catch (e) {
      PROFS = [];
      /* Se guarda el motivo en vez de descartarlo: el paso 2 lo enseña tal
         cual, que es la diferencia entre «arregla tu wifi» y «esto solo
         funciona publicado». */
      PROFS_ERROR = e.message || 'No pudimos cargar el equipo.';
    }
    /* Si el elegido ya no puede con la nueva selección, se suelta. */
    if (state.barber !== null && !profPorId(state.barber)) { state.barber = null; state.slot = null; }
    /* Con una sola opción no hay nada que elegir: se asigna y el paso se salta. */
    if (PROFS.length === 1) state.barber = PROFS[0].id;
    renderPickBarbers();
    render();
  }

  function renderPickBarbers() {
    const wrap = $('#pick-barbers');
    if (!wrap) return;
    wrap.textContent = '';
    if (!PROFS.length) {
      const p = el('p', 'step__hint');
      p.textContent = !seleccion().length ? 'Elige primero un servicio.'
        : PROFS_ERROR ? PROFS_ERROR
        : 'Ningún profesional del equipo presta ese servicio ahora mismo.';
      wrap.appendChild(p);
      return;
    }
    PROFS.forEach(prof => {
      const b = { id: prof.id, name: prof.nombre, spec: '',
                  photo: FOTO_PROF[prof.id] || prof.foto || '',
                  alt: prof.nombre + ', del equipo de The Imperial Clasic' };
      wrap.appendChild(barberCard(b, prof.id, id => {
        state.barber = id;
        state.slot = null;
        /* Un día que valía para el anterior puede ser el libre del nuevo. Se
           suelta la fecha en vez de arrastrarla: llegar al paso siguiente con
           un día ya elegido y muerto es peor que llegar sin ninguno.

           PERO solo si después se va a pasar por el calendario. Cambiando SOLO
           el barbero no se pasa, y soltarla ahí dejaba la cita sin fecha: el
           envío reventaba al construirla y el botón se quedaba en «Enviando…»
           para siempre. En ese caso se conserva, y quien avisa es la guarda de
           goNext, que sabe explicarlo. */
        const nuevo = profPorId(id);
        if (state.date && nuevo && pasosActivos().indexOf(PASO_FECHA) !== -1 &&
            (nuevo.dias_libres || []).indexOf(state.date.getDay()) !== -1) {
          state.date = null;
        }
        CUPOS = { cargando: false, error: null, libres: [], clave: null };
        track('barber_selected', { barber_name: prof.nombre });
        syncBarberCards(wrap);
        syncBarberCards($('#barbers-list'));
        render();
      }));
    });
    syncBarberCards(wrap);
  }

  /* ---- paso 3 ---- */
  function renderCalendar() {
    const grid  = $('#cal-grid');
    const label = $('#cal-month');
    const month = state.month;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    label.textContent = MONTHS[month.getMonth()] + ' ' + month.getFullYear();
    grid.textContent = '';

    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const total    = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const v = el('span', 'day day--void');
      v.setAttribute('aria-hidden', 'true');
      grid.appendChild(v);
    }

    for (let n = 1; n <= total; n++) {
      const date = new Date(month.getFullYear(), month.getMonth(), n);
      const btn  = el('button', 'day');
      btn.type = 'button';
      btn.textContent = String(n);
      btn.setAttribute('aria-label', longDate(date));

      /* Se descartan los días pasados y los que el local cierra. Saber si un
         día tiene cupo exigiría una consulta por casilla —treinta y una al
         pintar el mes—, así que para eso el calendario deja elegir y es la
         lista de horarios la que responde «sin horas». Un día en que no viene
         nadie sí se sabe de antemano y sin preguntar nada: apagarlo evita que
         alguien lo pulse para descubrir que no había nada. */
      /* Dos motivos para apagar un día, y se distinguen porque el cliente hace
         cosas distintas con cada uno. Si no viene nadie, la salida es otro día.
         Si el que descansa es SU barbero, la salida puede ser otro barbero, y
         para verlo tiene que leer el nombre. */
      const suyo = profPorId(state.barber);
      const cerrado = SEMANA_CERRADA.indexOf(date.getDay()) !== -1 ? 'Cerrado'
        : (suyo && (suyo.dias_libres || []).indexOf(date.getDay()) !== -1)
          ? suyo.nombre.split(' ')[0] + ' descansa'
          : null;
      if (cerrado) {
        btn.classList.add('day--cerrado');
        btn.title = cerrado;
        btn.setAttribute('aria-label', longDate(date) + ' — ' + cerrado);
      }
      btn.disabled = date < today || !!cerrado;
      btn.setAttribute('aria-pressed', String(!!state.date && ymd(state.date) === ymd(date)));

      btn.addEventListener('click', () => {
        state.date = date;
        state.slot = null;
        renderCalendar();
        renderSlots();
        render();
      });
      grid.appendChild(btn);
    }

    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    $('#cal-prev').disabled = month <= start;

    /* Y se dice con letras. En plural —«los jueves»— porque es lo que pasa
       todas las semanas, no una fecha suelta; y con la salida delante, que es
       lo único que el cliente puede hacer al respecto. */
    const nota = $('#cal-nota');
    if (nota) {
      const suyo2 = profPorId(state.barber);
      const libres2 = (suyo2 && suyo2.dias_libres || []).slice().sort();
      nota.hidden = !libres2.length;
      if (libres2.length) {
        const nombres = libres2.map(d => WEEKDAYS[d].toLowerCase() + (d === 6 ? 's' : d === 0 ? 's' : ''));
        const dias = nombres.length === 1 ? 'los ' + nombres[0]
                   : 'los ' + nombres.slice(0, -1).join(', ') + ' y los ' + nombres[nombres.length - 1];
        nota.textContent = suyo2.nombre.split(' ')[0] + ' descansa ' + dias +
                           '. Elige otro día o vuelve atrás para escoger a otra persona.';
      }
    }
  }

  function renderSlots() {
    const grid  = $('#slots-grid');
    const dayEl = $('#slots-day');
    const count = $('#slots-count');
    grid.textContent = '';

    if (!state.date) {
      dayEl.textContent = 'Elige un día';
      count.textContent = '';
      return;
    }

    if (CUPOS.cargando) {
      dayEl.textContent = WEEKDAYS[state.date.getDay()] + ' ' + state.date.getDate();
      count.textContent = 'Buscando…';
      return;
    }
    if (CUPOS.error) {
      dayEl.textContent = WEEKDAYS[state.date.getDay()] + ' ' + state.date.getDate();
      /* Nunca se cae a horarios inventados: si no sabemos qué está libre, se
         dice. Mostrar cupos falsos haría que alguien reserve una hora que no
         existe y llegue al local para nada. */
      count.textContent = CUPOS.error === 'descansa'
                          ? (CUPOS.quien || '').split(' ')[0] + ' descansa ese día'
                        : CUPOS.error === 'cerrado' ? 'Cerrado ese día'
                        : 'No pudimos ver la agenda';
      const p = el('p', 'step__hint');
      p.textContent = CUPOS.error === 'descansa'
        ? 'Elige otro día, o vuelve atrás y escoge a otra persona del equipo.'
        : CUPOS.error === 'cerrado'
        ? 'Elige otro día.'
        : 'Vuelve a intentarlo en un momento o escríbenos por WhatsApp.';
      grid.appendChild(p);
      return;
    }

    const libres = CUPOS.libres;
    dayEl.textContent = WEEKDAYS[state.date.getDay()] + ' ' + state.date.getDate();
    count.textContent = !libres.length ? 'Sin horas'
                      : 'Quedan ' + libres.length + (libres.length === 1 ? ' hora' : ' horas');

    libres.forEach(hora => {
      const btn = el('button', 'slot');
      btn.type = 'button';
      btn.textContent = hora;
      btn.setAttribute('aria-pressed', String(state.slot === hora));
      btn.addEventListener('click', () => {
        state.slot = hora;
        track('datetime_selected', { booking_date: ymd(state.date), booking_time: hora });
        renderSlots();
        render();
      });
      grid.appendChild(btn);
    });
  }

  /* ---- paso 4 ---- */
  const form = $('#booking-form');

  function setError(input, message) {
    const field = input.closest('.field');
    const wasInvalid = field.classList.contains('field--invalid');
    field.classList.toggle('field--invalid', !!message);
    field.querySelector('.field__error').textContent = message || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    // Solo al pasar de válido a inválido — evita disparar el evento en cada
    // tecla mientras el usuario sigue corrigiendo el mismo campo.
    if (message && !wasInvalid) track('form_error', { field_name: input.name, error_type: message });
  }

  /* Valida un campo individual — se usa tanto en blur (fricción temprana,
     antes de que el usuario llegue al botón) como al enviar el formulario. */
  function validateField(input) {
    if (input === form.elements.name) {
      if (input.value.trim().length < 3) { setError(input, 'Escribe tu nombre completo.'); return false; }
      setError(input, ''); return true;
    }
    if (input === form.elements.phone) {
      const digits = input.value.replace(/\D/g, '');
      if (digits.length < 7) { setError(input, 'Escribe un teléfono válido.'); return false; }
      setError(input, ''); return true;
    }
    if (input === form.elements.email) {
      if (input.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim())) {
        setError(input, 'Revisa el correo.'); return false;
      }
      setError(input, ''); return true;
    }
    return true;
  }

  function validateForm() {
    const name  = form.elements.name;
    const phone = form.elements.phone;
    const email = form.elements.email;
    const ok = [name, phone, email].map(validateField).every(Boolean);

    if (ok) {
      state.customer = {
        name: name.value.trim(),
        phone: phone.value.trim(),
        email: email.value.trim()
      };
    }
    return ok;
  }

  form.addEventListener('input', e => {
    if (e.target.closest('.field--invalid')) setError(e.target, '');
  });
  /* Valida al salir del campo (blur) en vez de esperar al envío — así el
     usuario corrige un teléfono mal escrito de inmediato, no tres campos
     después de haber llegado al botón. Se salta el primer blur en vacío
     para no regañar a alguien que solo está tabulando por el formulario. */
  form.addEventListener('focusout', e => {
    const input = e.target;
    if (input.tagName !== 'INPUT') return;
    if (!input.value.trim() && !input.dataset.touched) return;
    input.dataset.touched = '1';
    validateField(input);
  });
  form.addEventListener('submit', e => { e.preventDefault(); goNext(); });

  /* ---- paso 5 ---- */
  function renderReceipt() {
    const dl = $('#receipt');
    dl.textContent = '';
    const t = totales();

    /* Una sola fila con todo lo elegido. La separación principal/adicionales es
       interna —la necesitan el .ics y la analítica— pero para quien reserva la
       cita es una sola cosa, y llamarle «adicional» a las únicas cejas que pidió
       sonaba a que le faltaba algo. */
    const nombres = seleccion().map(id => byId(id) && byId(id).name).filter(Boolean);
    const rows = [[nombres.length > 1 ? 'Servicios' : 'Servicio', nombres.join(', ')]];
    /* Sin barbero (manicura) no se inventa un nombre: se dice quién atiende. */
    rows.push(state.barber !== null
      ? ['Barbero', (profPorId(state.barber) || {}).nombre || 'Por confirmar']
      : ['Atiende', 'Nuestra especialista en manicura']);
    rows.push(['Fecha y hora', shortDate(state.date) + ' · ' + state.slot]);
    /* Si hay algo de precio variable no se inventa un total: se suma lo fijo y
       se advierte que el resto se cotiza en el local. */
    rows.push(['Total', totalTexto()]);

    rows.forEach(([k, v], i) => {
      const row = el('div', 'receipt__row' + (i === rows.length - 1 ? ' receipt__row--total' : ''));
      const dt = el('dt'); dt.textContent = k;
      const dd = el('dd'); dd.textContent = v;
      row.append(dt, dd);
      dl.appendChild(row);
    });

    /* Con qué se vuelve a entrar. Sin esto, el cliente termina la reserva sin
       saber cómo cambiarla, y quien quiere moverla reserva otra vez y acaba con
       dos citas — que es justo lo que la pantalla de cambios viene a evitar. */
    const llave = $('#receipt-llave');
    if (llave) {
      llave.textContent = '¿Necesitas cambiarla? Vuelve aquí y busca tu cita con tu celular, ' +
                          state.customer.phone + '. No hace falta ningún código.';
    }

    const aviso = $('#receipt-note');
    if (aviso) {
      aviso.hidden = !t.variables.length;
      if (t.variables.length) {
        aviso.textContent = t.variables.map(s => s.name).join(' y ') +
          (t.variables.length > 1 ? ' se cotizan' : ' se cotiza') + ' en el local antes de empezar.';
      }
    }
  }

  /* Envío real: reemplazar por la llamada al backend / WhatsApp Business API. */
  /* Envía la cita de verdad. El total no se manda: lo calcula el servidor con
     los precios de la base, porque lo que sale del navegador es editable. */
  function submitBooking() {
    return pedir('/reservar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: ymd(state.date),
        hora: state.slot,
        servicios: seleccion(),
        profesional: state.barber,
        cliente: {
          nombre: state.customer.name,
          telefono: state.customer.phone,
          email: state.customer.email
        },
        /* Si esto es un cambio, el servidor cancela la anterior — pero solo
           DESPUÉS de que esta haya entrado. Si el cupo nuevo se lo llevó otro
           entre medias, la petición falla y el cliente conserva la que tenía. */
        reemplaza: cambiando ? { telefono: state.customer.phone } : undefined
      })
    }).then(r => {
      state.codigo = r.codigo;
      if (r.cambiada) {
        /* Se anuncia el cambio en la pantalla final: quien movió su cita
           necesita ver que la anterior ya no está, o vuelve a llamar para
           asegurarse. */
        const done = document.querySelector('.step--done p');
        if (done) {
          done.textContent = 'Cambiamos tu cita. Te enviamos la confirmación ' +
            'actualizada a tu celular.';
        }
      }
      cambiando = null;
      quiereCambiar = [];
      return r;
    });
  }

  /* ---- .ics ---- */
  function icsStamp(date, time, addMinutes) {
    const [hh, mm] = time.split(':').map(Number);
    const utc = new Date(Date.UTC(
      date.getFullYear(), date.getMonth(), date.getDate(),
      hh - SHOP.utcOffsetHours, mm + (addMinutes || 0)
    ));
    return utc.getUTCFullYear() + pad(utc.getUTCMonth() + 1) + pad(utc.getUTCDate()) +
           'T' + pad(utc.getUTCHours()) + pad(utc.getUTCMinutes()) + '00Z';
  }

  /* Cuánto dura la cita de verdad, sumando lo elegido. Es el dato que la agenda
     del local ya usa para repartir cupos, así que el evento del cliente queda
     ocupando exactamente lo mismo que su silla.

     Con respaldo de una hora por si algún servicio llegara sin duración: un
     evento de cero minutos lo pintan mal casi todos los calendarios. */
  function duracionCita() {
    const suma = seleccion().map(byId).filter(Boolean)
      .reduce((t, s) => t + (Number(s.min) || 0), 0);
    return suma > 0 ? suma : 60;
  }

  function downloadIcs() {
    const svc = byId(state.service);
    const titulo = [svc.name, ...state.extras.map(id => byId(id).name)].join(' + ');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Imperial Clasic Barber//Reservas//ES',
      'BEGIN:VEVENT',
      'UID:' + ymd(state.date) + '-' + state.slot.replace(':', '') + '@imperialclasic.co',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
      'DTSTART:' + icsStamp(state.date, state.slot, 0),
      'DTEND:'   + icsStamp(state.date, state.slot, duracionCita()),
      'SUMMARY:' + titulo + ' · ' + SHOP.name,
      'LOCATION:' + SHOP.address,
      'DESCRIPTION:' + (state.barber !== null ? 'Barbero: ' + ((profPorId(state.barber) || {}).nombre || '') : 'Atiende nuestra especialista') + '. Llega cinco minutos antes.',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = 'reserva-imperial-clasic.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------
     Navegación
     ------------------------------------------------------ */
  const STEP_NAMES = ['servicio', 'adicionales', 'barbero', 'fecha_hora', 'datos'];
  const PASO_DATOS = PASOS - 1;  // el último con formulario
  const PASO_FECHA = PASOS - 2;  // fecha y hora

  /* Aviso de error del envío, junto al botón. role=alert para que un lector de
     pantalla lo anuncie sin que haya que moverle el foco. */
  function avisoEnvio(texto) {
    let n = $('#aviso-envio');
    if (!n) {
      n = el('p', 'step__hint');
      n.id = 'aviso-envio';
      n.setAttribute('role', 'alert');
      n.style.color = 'var(--wine)';
      stepFoot.parentNode.insertBefore(n, stepFoot);
    }
    n.textContent = texto;
    n.hidden = !texto;
  }

  /* En modo cambio, el último de los pasos elegidos es el que confirma: de ahí
     se va directo a la pantalla final. */
  /* La fecha que se conserva puede ser el día libre de quien se acaba de
     elegir. Pasa justo cuando se cambia SOLO el barbero: entonces no se pasa
     por el calendario y esa fecha no la mira nadie. */
  function chocaConSuDescanso() {
    const p = profPorId(state.barber);
    return !!(p && state.date && (p.dias_libres || []).indexOf(state.date.getDay()) !== -1);
  }

  const esUltimoDelCambio = () => {
    if (!cambiando || !quiereCambiar.length) return false;
    const pasos = pasosActivos().filter(n => n !== PASOS);
    return state.step === pasos[pasos.length - 1];
  };

  function goNext() {
    /* Del paso 0 se arranca el recorrido con lo que se haya marcado. */
    if (state.step === 0) {
      if (!cambiando || !quiereCambiar.length) return;
      state.step = pasosActivos()[0];
      render();
      panel.scrollTop = 0;
      return;
    }

    if (state.step === PASO_DATOS || esUltimoDelCambio()) {
      /* Se para antes de enviar y se dice por qué. El servidor también lo
         rechaza —es quien manda— pero enterarse aquí evita mandar una petición
         que ya se sabe perdida, y sobre todo evita el susto de ver un error
         rojo después de pulsar «Confirmar». */
      if (cambiando && chocaConSuDescanso()) {
        const p = profPorId(state.barber);
        avisoEnvio(p.nombre.split(' ')[0] + ' descansa el día que tienes reservado. ' +
                   'Vuelve atrás y marca también «el día o la hora» para mover la cita.');
        return;
      }

      /* Solo se valida el formulario si se está en él. Cambiando una cita no se
         pasa por ahí: los datos ya vinieron con la cita. */
      if (state.step === PASO_DATOS && !validateForm()) {
        const bad = form.querySelector('.field--invalid input');
        if (bad) bad.focus();
        return;
      }
      track('booking_step_completed', { step_number: PASO_DATOS, step_name: STEP_NAMES[PASO_DATOS - 1] });

      /* Mientras viaja la petición el botón se bloquea: sin esto, dos toques
         seguidos mandan dos citas. */
      nextBtn.disabled = true;
      nextBtn.textContent = 'Enviando…';
      avisoEnvio('');

      /* Si algo revienta ANTES de la petición —al construir la cita, por
         ejemplo— submitBooking lanza de forma síncrona y el .catch de abajo no
         llega a existir: el botón se queda en «Enviando…» y no hay forma de
         seguir ni de saber por qué. Envolverlo en una promesa lleva también ese
         fallo al mismo sitio donde se tratan los demás. */
      Promise.resolve().then(submitBooking).catch(e => {
        nextBtn.disabled = false;
        /* El rótulo vuelve al que tocaba: quien está cambiando una cita no ve
           «Confirmar reserva», que le haría pensar que va a crear otra. */
        nextBtn.textContent = cambiando ? 'Confirmar el cambio' : 'Confirmar reserva';
        /* 409 = el cupo se lo llevaron mientras llenaba el formulario. Se
           devuelve al paso de fecha con los horarios recargados, que es lo
           único que puede hacer. */
        avisoEnvio(e.message || 'No pudimos enviar la reserva. Inténtalo de nuevo.');
        if (e.estado === 409) {
          state.slot = null;
          CUPOS = { cargando: false, error: null, libres: [], clave: null };
          state.step = PASO_FECHA;
          render();
          cargarCupos();
        }
        throw e;
      }).then(() => {
        const t = totales();
        const conversionParams = {
          value: t.fijo,
          currency: 'COP',
          service_name: byId(state.service).name,
          extras_count: state.extras.length,
          barber_name: state.barber !== null ? ((profPorId(state.barber) || {}).nombre || '') : '(especialista)',
          booking_date: ymd(state.date),
          booking_time: state.slot
        };
        track('booking_completed', conversionParams);
        // Espejo con el evento recomendado de GA4 para negocios de cita/lead —
        // permite importar la conversión directo en Google Ads sin remapear.
        track('generate_lead', conversionParams);
        renderReceipt();
        state.step = PASOS;
        render();
        panel.scrollTop = 0;
      });
      return;
    }
    if (!canAdvance()) return;
    track('booking_step_completed', { step_number: state.step, step_name: STEP_NAMES[state.step - 1] });
    const pasos = pasosActivos();
    const siguiente = pasos[pasos.indexOf(state.step) + 1] || PASOS;
    const entraAlFormulario = siguiente === PASO_DATOS;
    state.step = siguiente;
    render();
    panel.scrollTop = 0;
    /* Autofoco al primer campo: quien ya llenó cuatro pasos no debería tener
       que hacer un clic más para empezar a escribir su nombre. */
    if (entraAlFormulario) form.elements.name.focus();
  }

  function goBack() {
    /* Desde la pantalla de buscar la cita, «Atrás» sale del modo de cambio y
       devuelve a reservar normal. `pasosActivos()` no incluye el 0, así que sin
       este caso el índice caía en -1 y se quedaba encallado ahí. */
    if (state.step === 0) {
      salirDeModificar();
      return;
    }
    const pasos = pasosActivos();
    state.step = pasos[Math.max(0, pasos.indexOf(state.step) - 1)];
    render();
    panel.scrollTop = 0;
  }

  function salirDeModificar() {
    cambiando = null;
    quiereCambiar = [];
    $$('[data-cambiar]').forEach(o => o.setAttribute('aria-pressed', 'false'));
    state.service = null;
    state.extras = [];
    state.barber = null;
    state.date = null;
    state.slot = null;
    state.step = 1;
    render();
    panel.scrollTop = 0;
  }

  backBtn.addEventListener('click', goBack);
  nextBtn.addEventListener('click', goNext);

  $('#cal-prev').addEventListener('click', () => {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
    renderCalendar();
  });
  $('#cal-next').addEventListener('click', () => {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
    renderCalendar();
  });

  /* Lleva a Google Calendar con la cita ya escrita.

     Antes descargaba un archivo .ics. Eso funciona, pero descargar algo en un
     celular es un callejón: aparece un archivo en la carpeta de descargas y hay
     que saber qué hacer con él. Un enlace abre el calendario con todo puesto y
     solo queda pulsar «Guardar».

     Las horas van en UTC —el sufijo Z— y no en hora local: el evento es a las
     once y media en Sabaneta, y escribirlo sin zona haría que el calendario de
     alguien que viaja lo colocara a otra hora. */
  function urlGoogleCalendar() {
    const nombres = seleccion().map(id => (byId(id) || {}).name).filter(Boolean);
    const quien = state.barber !== null
      ? (profPorId(state.barber) || {}).nombre || ''
      : 'Nuestra especialista';

    const detalle = [
      nombres.join(' + '),
      quien ? 'Te atiende: ' + quien : '',
      'Llega cinco minutos antes — el tinto va por la casa.',
      '',
      '¿Necesitas cambiarla? Entra a ' + location.origin +
        ' y busca tu cita con tu celular, ' + state.customer.phone + '.'
    ].filter(Boolean).join('\n');

    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: (nombres.join(' + ') || 'Cita') + ' · ' + SHOP.name,
      dates: icsStamp(state.date, state.slot, 0) + '/' +
             icsStamp(state.date, state.slot, duracionCita()),
      details: detalle,
      location: SHOP.address
    });
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  }

  $('#add-calendar').addEventListener('click', () => {
    track('add_to_calendar_click', { destino: 'google' });
    window.open(urlGoogleCalendar(), '_blank', 'noopener');
  });

  $('#add-ics').addEventListener('click', () => {
    track('add_to_calendar_click', { destino: 'ics' });
    downloadIcs();
  });
  /* Este botón REINICIABA la reserva desde el paso 1, dejando la recién creada
     en pie: el cliente creía estar cambiándola y terminaba con dos citas. Era
     la trampa exacta que la pantalla de cambios vino a resolver, puesta en el
     único sitio donde todo el mundo la pulsa.

     Ahora entra al modo de cambio con la cita que se acaba de hacer ya cargada:
     no hay que buscar nada, porque los datos están aquí mismo. */
  $('#restart').addEventListener('click', () => {
    track('booking_restarted', {});
    cambiando = { codigo: state.codigo, telefono: state.customer.phone };
    state.step = 0;
    render();
    /* Se enseña directamente el «¿qué quieres cambiar?»: buscarla sería pedirle
       el celular que acaba de escribir dos pantallas atrás. */
    mostrarHallada({
      inicio: new Date(state.date.getFullYear(), state.date.getMonth(), state.date.getDate(),
                       Number(state.slot.slice(0, 2)), Number(state.slot.slice(3))),
      servicios: seleccion()
    });
    panel.scrollTop = 0;
  });

  /* ------------------------------------------------------
     Overlay
     ------------------------------------------------------ */
  function openBooking(step) {
    /* Sin esperarlo: la reserva abre ya con lo que hay y se repinta sola si
       llega algo distinto. Bloquear la apertura por una llamada de red haría
       que el botón principal del sitio pareciera trabado. */
    refrescarCatalogo(5000);
    lastFocused = document.activeElement;
    const pedido = step || (state.step === PASOS ? 1 : state.step);
    /* Nunca abrir más adelante del primer paso incompleto: quien toca un
       barbero en la portada entra por el paso 1 (servicio) con su barbero ya
       marcado, en vez de saltárselo. Si el servicio ya estaba elegido, el
       atajo sí lo lleva directo al paso 2. */
    state.step = Math.min(pedido, firstIncompleteStep());
    booking.hidden = false;
    document.body.classList.add('is-locked');
    render();
    panel.scrollTop = 0;

    /* La clase que dispara la entrada va en el cuadro SIGUIENTE al de quitar
       `hidden`. Puesta a la vez, el navegador ve un elemento que nace ya en su
       estado final y no hay transición que animar: aparecería de golpe.

       Y no es solo estética: el estado inicial de esa animación es opacidad
       cero, así que si esta clase no llegara a ponerse, el modal quedaría
       invisible con la reserva abierta. Por eso también se pone por
       `setTimeout` de respaldo. */
    requestAnimationFrame(() => booking.classList.add('is-abierto'));
    setTimeout(() => booking.classList.add('is-abierto'), 120);

    panel.focus();
  }

  function closeBooking() {
    /* Salir del modal cancela el cambio en curso. Si no, volver a abrirlo más
       tarde seguiría creyendo que se está modificando una cita y el botón final
       diría «Confirmar el cambio» en una reserva nueva. */
    cambiando = null;
    quiereCambiar = [];

    /* El paso 0 no está en TITLES —no es un paso de la reserva, es la pantalla
       de buscar la cita— así que TITLES[-1] era `undefined` y `.replace`
       reventaba aquí mismo. La función moría antes de ocultar el modal, y el
       resultado era una reserva que no se podía cerrar ni con la ✕ ni con
       Escape. Un cierre no puede depender de que una métrica salga bien. */
    if (state.step > 0 && state.step < 5) {
      const titulo = TITLES[state.step - 1] || '';
      track('booking_abandoned', {
        last_step: state.step,
        last_step_name: titulo.replace(/<[^>]+>/g, '')
      });
    }
    /* Cerrar es más rápido que abrir: esperar a que se vaya algo que ya
       decidiste cerrar se siente lento aunque dure la mitad. */
    booking.classList.add('is-cerrando');
    booking.classList.remove('is-abierto');
    document.body.classList.remove('is-locked');
    if (lastFocused && lastFocused.focus) lastFocused.focus();

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      booking.hidden = true;
      booking.classList.remove('is-cerrando');
    }, quieto ? 0 : 200);
  }

  /* Deja solo lo que tiene precio y sigue con la reserva normal. */
  $('#cotiza-quitar').addEventListener('click', () => {
    aConvenir().forEach(s => quitar(s.id));
    render();
  });

  document.querySelectorAll('[data-book]').forEach(b =>
    b.addEventListener('click', () => {
      track('booking_started', { trigger_location: b.dataset.bookLocation || 'unknown' });
      openBooking(state.step === PASOS ? 1 : state.step);
    })
  );
  document.querySelectorAll('[data-close-booking]').forEach(b =>
    b.addEventListener('click', closeBooking)
  );

  document.addEventListener('keydown', e => {
    if (booking.hidden) return;
    if (e.key === 'Escape') { closeBooking(); return; }
    if (e.key !== 'Tab') return;

    const focusables = panel.querySelectorAll(
      'button:not([disabled]):not([hidden]), input, a[href], [tabindex]:not([tabindex="-1"])'
    );
    const visible = Array.prototype.filter.call(focusables, n => n.offsetParent !== null);
    if (!visible.length) return;
    const first = visible[0], last = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ------------------------------------------------------
     Video del hero
     ------------------------------------------------------ */
  function setupHeroVideo() {
    const video = $('#hero-video');
    if (!video) return;

    /* Movimiento reducido: no reproducir. El póster queda como imagen fija, así
       que el hero no pierde nada visualmente — solo deja de moverse. */
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    function applyMotionPreference() {
      if (reduced.matches) { video.pause(); video.removeAttribute('autoplay'); }
      else { video.play().catch(() => {}); } // el navegador puede rechazar el autoplay; el póster cubre ese caso
    }
    applyMotionPreference();
    reduced.addEventListener('change', applyMotionPreference);

    /* Bucle recortado: el video termina con ~4s de placa de logo que no
       queremos en un fondo que se repite. `timeupdate` dispara ~4 veces por
       segundo, por eso el corte va con margen antes del inicio real (14.9s). */
    const loopEnd = parseFloat(video.dataset.loopEnd);
    if (loopEnd > 0) {
      video.addEventListener('timeupdate', () => {
        if (video.currentTime >= loopEnd) video.currentTime = 0;
      });
    }

    /* Ahorra batería y decodificación cuando el hero no está en pantalla. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (reduced.matches) return;
          if (entry.isIntersecting) video.play().catch(() => {});
          else video.pause();
        });
      }, { threshold: 0.1 }).observe(video);
    }
  }

  /* ------------------------------------------------------
     Video de la galería
     ------------------------------------------------------ */
  /* Videos en línea (galería y carta). Comparten comportamiento: arrancan al
     entrar en pantalla, se pausan al salir, respetan "reducir movimiento" y —
     si traen data-loop-end— recortan el bucle antes de la placa de logo. */
  function setupInlineVideos() {
    const vids = document.querySelectorAll('.tile--video video, #ritual-video');
    if (!vids.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    vids.forEach(vid => {
      const loopEnd = parseFloat(vid.dataset.loopEnd);
      if (loopEnd > 0) {
        /* `timeupdate` dispara solo ~4 veces por segundo, por eso el corte va
           con margen antes del inicio real de la placa. */
        vid.addEventListener('timeupdate', () => {
          if (vid.currentTime >= loopEnd) vid.currentTime = 0;
        });
      }

      if (!('IntersectionObserver' in window)) return;
      new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) { vid.pause(); return; }
          if (reduced.matches) return; // el póster ya muestra el trabajo
          /* preload="none" en el markup: el archivo no se descarga hasta que
             el visitante llega, para no competir con el video del hero. */
          vid.play().catch(() => {});
        });
      }, { threshold: 0.3 }).observe(vid);
    });
  }


  /* ------------------------------------------------------
     Cinta de reseñas
     ------------------------------------------------------ */
  function setupReviewsMarquee() {
    const marquee = $('#reviews-marquee');
    if (!marquee) return;
    const track = marquee.querySelector('.marquee__track');
    const cards = [...track.children];
    if (!cards.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* Se duplica la pista y la copia va aria-hidden: visualmente completa el
       bucle, pero un lector de pantalla no lee las mismas reseñas dos veces. */
    cards.forEach(card => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('[aria-label]').forEach(n => n.removeAttribute('aria-label'));
      track.appendChild(clone);
    });

    /* La velocidad se calcula desde lo único que importa aquí: cuánto tiempo
       está cada reseña delante de los ojos.

       Antes fue velocidad fija en píxeles, y luego vuelta fija de 30 segundos.
       Las dos estaban mal por la misma razón: ignoran el ancho de la pantalla.
       El recorrido es el mismo en un celular y en un portátil, pero la ventana
       no. En escritorio se ven varias reseñas a la vez y la siguiente ya
       entrando; en un celular cabe una sola, y cruza los 330 px de pantalla en
       la mitad de tiempo del que hace falta para leerla.

       Atándolo al tiempo en pantalla, cada reseña dura lo mismo en cualquier
       aparato: la cinta va despacio en un celular y más suelta en un monitor
       ancho, que es exactamente lo que hace falta en cada uno.

       Veinticuatro segundos, no treinta. Treinta daba tiempo de sobra pero se
       arrastraba —una cinta que se mueve tan despacio parece atascada— y veinte
       no alcanzaba a leerse en un celular. En medio: cómodo sin llegar a
       aburrir. */
    const SEGUNDOS_A_LA_VISTA = 24;

    function syncSpeed() {
      const vuelta = track.scrollWidth / 2;   // la mitad = un ciclo completo
      if (vuelta <= 0) return;

      const tarjeta = track.firstElementChild;
      const anchoTarjeta = tarjeta ? tarjeta.getBoundingClientRect().width : 300;
      const anchoVentana = track.parentElement.getBoundingClientRect().width;

      /* Una tarjeta está a la vista mientras recorre su propio ancho más el de
         la ventana: desde que asoma por un lado hasta que desaparece por el
         otro. */
      const velocidad = (anchoTarjeta + anchoVentana) / SEGUNDOS_A_LA_VISTA;
      track.style.setProperty('--marquee-duration', Math.round(vuelta / velocidad) + 's');
    }
    syncSpeed();
    window.addEventListener('resize', syncSpeed);

    /* No animar mientras la sección está fuera de pantalla.
       Se hace con una clase, no con style.animationPlayState: un estilo inline
       gana sobre las reglas CSS y anularía la pausa de :hover / :focus-within. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        entries.forEach(e => marquee.classList.toggle('is-offscreen', !e.isIntersecting));
      }, { threshold: 0 }).observe(marquee);
    }
  }

  /* ------------------------------------------------------
     Carta de servicios de la portada
     ------------------------------------------------------ */
  /* La aparición de la carta la hace ahora el módulo `reveal` de motion.js, con
     el mismo observador que todo lo demás. Esta función se queda vacía a
     propósito en vez de borrarse: la llama el arranque y su nombre explica
     dónde vivía esto antes. */
  function setupServiceMenu() {}




  /* ------------------------------------------------------
     Acordeón de la carta
     ------------------------------------------------------ */
  function setupAcordeon() {
    const grupos = $$('.menu__group');
    if (grupos.length < 2) return;

    /* El acordeón se construye aquí y no viene escrito en el HTML por una
       razón concreta: sin JavaScript, un acordeón cerrado deja cinco de las
       seis categorías inalcanzables, y este bloque existe justamente para
       poder leerse y indexarse sin scripts. Escrito así, quien no ejecuta
       JavaScript ve la carta entera; quien sí, la ve plegada. */
    grupos.forEach((g, gi) => {
      const titulo = g.querySelector('.menu__group-title');
      const lista  = g.querySelector('.menu__list');
      if (!titulo || !lista) return;

      const id = 'carta-panel-' + gi;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu__group-btn';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', id);

      const mas = document.createElement('span');
      mas.className = 'menu__plus';
      mas.setAttribute('aria-hidden', 'true');
      mas.textContent = '+';

      titulo.parentNode.insertBefore(btn, titulo);
      btn.appendChild(titulo);
      btn.appendChild(mas);

      /* El envoltorio es lo que permite animar de 0fr a 1fr: la fila de la
         rejilla crece, y el hijo con overflow oculto recorta mientras tanto. */
      const panel = document.createElement('div');
      panel.className = 'menu__panel';
      panel.id = id;
      const caja = document.createElement('div');
      lista.parentNode.insertBefore(panel, lista);
      caja.appendChild(lista);
      panel.appendChild(caja);

      btn.addEventListener('click', () => abrir(g, btn.getAttribute('aria-expanded') !== 'true'));
    });

    function abrir(grupo, si) {
      grupos.forEach(g => {
        const b = g.querySelector('.menu__group-btn');
        const panel = g.querySelector('.menu__panel');
        const mas = g.querySelector('.menu__plus');
        if (!b || !panel) return;

        /* Una sola abierta: con seis categorías abiertas a la vez el acordeón
           no ahorra nada y la página vuelve a ser la lista larga de antes. */
        const abierta = g === grupo && si;

        b.setAttribute('aria-expanded', String(abierta));
        g.classList.toggle('is-open', abierta);

        /* Las tres propiedades que se animan se escriben además en línea. La
           clase sola debería bastar, pero hay motores que no reevalúan la hoja
           al cambiarla y dejan el panel pintado como estaba —abierto con la
           clase ya quitada— aunque el DOM sea correcto. Un estilo en línea no
           pasa por el emparejado de selectores, así que se aplica siempre. La
           transición sigue viniendo del CSS: funciona igual sobre un cambio
           en línea. */
        panel.style.gridTemplateRows = abierta ? '1fr' : '0fr';
        panel.style.opacity = abierta ? '1' : '0';
        if (mas) mas.style.transform = abierta ? 'rotate(135deg)' : 'rotate(0deg)';
      });
    }

    /* Cortes abierta de entrada: es la categoría por la que entra casi todo el
       mundo, y una carta que arranca entera cerrada parece vacía. */
    abrir(grupos[0], true);
  }


  /* ------------------------------------------------------
     El panel manda: carta, horario y vitrina
     ------------------------------------------------------
     Todo lo que sigue existe para que el local pueda cambiar la página desde
     el panel sin tocar código. Lo escrito en el HTML y en SERVICES no es
     decoración: es el respaldo. Se ve al instante, se indexa, funciona sin
     JavaScript y sigue funcionando si la base no responde. Cuando el catálogo
     llega, se pinta encima.

     Ese orden importa. Al revés —página vacía que espera a la API— cualquier
     tropiezo del servidor deja al visitante mirando un hueco, y el visitante
     no vuelve. */

  const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  /* La base guarda el segmento; el rótulo que ve el cliente vive aquí. Añadir
     una categoría nueva en el panel no debería obligar a tocar este archivo,
     así que un segmento desconocido se rotula con su propio nombre. */
  /* Con qué segmentos abre la carta. Sale de qué busca la gente al entrar, no
     del alfabeto —que es como los devuelve la base— ni de cuántos servicios
     tiene cada uno.

     Los que no estén en esta lista van después, en el orden en que vengan. Así,
     una categoría nueva creada desde el panel aparece sin tener que tocar este
     archivo: se coloca al final, que es donde corresponde hasta que alguien
     decida otra cosa. */
  const ORDEN_SEGMENTOS = ['cortes', 'cejas', 'facial', 'unas'];
  const ordenSeg = k => {
    const i = ORDEN_SEGMENTOS.indexOf(k);
    return i === -1 ? 99 : i;
  };

  const ROTULO_SEG = {
    cortes: 'Cortes', color: 'Color y tratamiento', depilacion: 'Depilación facial',
    cejas: 'Cejas', facial: 'Limpieza facial', unas: 'Uñas', adicionales: 'Adicionales'
  };
  const rotuloSeg = k => ROTULO_SEG[k] ||
    String(k).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());

  /* Traduce una fila de la base a la forma que ya usa el resto del archivo.
     Se hace aquí y en un solo sitio para que el cambio de origen no se note en
     ninguna otra función. */
  function deLaBase(s) {
    const respaldo = SERVICES.find(x => x.id === s.id);
    return {
      id: s.id,
      group: s.solo_adicional ? 'adicionales' : s.segmento,
      name: s.nombre,
      price: s.precio === null || s.precio === undefined ? null : Number(s.precio),
      desc: s.descripcion || (respaldo && respaldo.desc) || '',
      min: Number(s.minutos),
      /* Precio sin fijar no es un dato que falte: es «según diseño», y así se
         anuncia en vez de inventar una cifra. */
      nota: s.precio === null ? 'Consultar' : undefined,
      /* Si el precio es un mínimo y no una cifra cerrada. Sin esto, la carta
         anunciaba «$25.000» donde el local había puesto «Desde $25.000»: el
         sitio prometía precio fijo por algo que varía. */
      desde: !!s.precio_desde,
      /* Con un solo profesional no hay nada que elegir y el paso se salta.
         Sale de quién presta el servicio hoy, no de una lista escrita a mano
         que envejece en cuanto alguien entra o sale del equipo. */
      sinBarbero: (s.profesionales || []).length === 1,
      /* El destacado es criterio editorial del sitio, no un dato del negocio:
         la base no lo guarda, así que se conserva el del respaldo. */
      destacado: !!(respaldo && respaldo.destacado)
    };
  }

  /* Cuándo se pidió el catálogo por última vez. Sirve para no repetir la
     llamada cada vez que el visitante cambia de pestaña y vuelve. */
  let catalogoPedido = 0;
  /* Huella del catálogo que la página tiene pintado ahora mismo. */
  let catalogoVersion = null;
  let vigilante = null;

  /* Un minuto, no veinte segundos.

     Cada pregunta despierta la base, y a 20 s una visita de quince minutos
     genera 47 llamadas. A 60 s son 16: un tercio del consumo, que es lo que
     separa aguantar 400 visitas diarias de aguantar 1.200 sin pagar nada.

     Lo que se pierde no lo nota nadie: es el tiempo que tarda un cambio de
     precio en llegar a una pestaña que ya estaba abierta y quieta. Quien entra
     nuevo lo ve al instante, y quien vuelve a la pestaña también, porque eso se
     refresca aparte. */
  const VIGILANCIA_MS = 60000;

  /* Mantiene la página al día sin que nadie la toque.

     Es consulta periódica, no aviso del servidor. Lo segundo sería más
     elegante, pero exige una conexión abierta por cada visitante, y ni el plan
     donde corre esto la sostiene —las funciones se cortan solas al minuto— ni
     tiene sentido pagar una conexión permanente por un cambio de precio que
     ocurre cada varios meses.

     Lo que se pregunta no es el catálogo sino su huella: treinta y dos
     caracteres. Solo cuando cambia se pide el catálogo entero. Así el coste de
     estar al día es una llamada minúscula cada veinte segundos, y el trabajo
     de verdad se hace únicamente el día que el local cambia algo.

     Solo con la pestaña a la vista. Una pestaña de fondo no la está mirando
     nadie: seguir preguntando ahí gastaría batería del visitante y despertaría
     la base para nada, y al volver se refresca igual. */
  async function vigilar() {
    if (document.hidden) return;
    try {
      const r = await pedir('/catalogo?solo=version');
      if (!r || !r.version) return;
      if (catalogoVersion === null) { catalogoVersion = r.version; return; }
      if (r.version !== catalogoVersion) cargarCatalogo();
    } catch (e) { /* si falla, se reintenta en el siguiente turno */ }
  }

  function arrancarVigilancia() {
    if (vigilante) return;
    vigilante = setInterval(vigilar, VIGILANCIA_MS);
  }
  function pararVigilancia() {
    clearInterval(vigilante);
    vigilante = null;
  }

  /* Vuelve a leer el catálogo si ya pasó un rato. La página lo pedía UNA vez,
     al cargar, y con eso bastaba para quien entra y reserva de una sentada.
     No basta para lo demás: una pestaña que lleva abierta desde la mañana
     enseña los precios de la mañana, y si el local sube uno a mediodía, el
     visitante lo ve viejo y —peor— empieza a reservar con él.

     Se refresca al volver a la pestaña y al abrir la reserva. Ese segundo
     momento es el que importa de verdad: es justo antes de que el cliente
     elija y vea un total, así que es la última oportunidad de que lo que
     decide sea el precio de verdad y no el de hace tres horas. */
  function refrescarCatalogo(minimoMs) {
    if (Date.now() - catalogoPedido < (minimoMs || 20000)) return;
    cargarCatalogo();
  }

  async function cargarCatalogo() {
    catalogoPedido = Date.now();
    let cat;
    try {
      cat = await pedir('/catalogo');
    } catch (e) {
      /* Sin catálogo la página se queda con lo que trae escrito, que es válido
         y está a la vista. No se avisa de nada: el visitante no tiene por qué
         enterarse de que una llamada falló si lo que ve es correcto. */
      return;
    }

    if (cat.servicios && cat.servicios.length) {
      SERVICES = cat.servicios.map(deLaBase);
      /* Los segmentos salen de lo que hay, y en el orden en que la carta los
         presenta. Si el local deja de prestar todo un grupo, la pestaña
         desaparece sola en vez de abrir en un vacío. */
      const vistos = [];
      SERVICES.forEach(s => { if (vistos.indexOf(s.group) === -1) vistos.push(s.group); });
      vistos.sort((a, b) => ordenSeg(a) - ordenSeg(b));
      SEGMENTOS = {};
      vistos.forEach(k => { SEGMENTOS[k] = rotuloSeg(k); });
      if (vistos.indexOf(segActivo) === -1) segActivo = vistos[0];

      pintarCarta();
      setupAcordeon();   // la carta se rehízo entera: hay que volver a plegarla
      renderSegs();
      renderPickServices();
    }

    catalogoVersion = cat.version || catalogoVersion;

    /* Días que el local cierra. Se guardan como texto «AAAA-MM-DD» para
       compararlos con ymd() sin cuentas de zona horaria de por medio. */
    SEMANA_CERRADA = (cat.semanaCerrada || []).map(Number);
    if (state.month) renderCalendar();
    cargarGaleria();

    if (cat.equipo && cat.equipo.length) {
      /* Con esto «Las Manos» deja de ser una lista escrita a mano. Quien entra
         o sale del equipo desde el panel entra o sale de la portada, y con su
         id de verdad: la tarjeta preselecciona a esa persona al abrir la
         reserva en vez de abrirla en blanco. */
      BARBERS = cat.equipo.map(p => ({
        id: p.id,
        name: p.nombre,
        spec: '',
        photo: p.foto || '',
        oficio: p.oficio || 'equipo',
        alt: p.foto ? p.nombre + ', del equipo de The Imperial Clasic' : ''
      }));
      renderBarbers();
    }

    if (cat.horario && cat.horario.length) pintarHorario(cat.horario);
    pintarProductos(cat.productos || []);
  }

  /* ---------- carta de la portada ---------- */
  function pintarCarta() {
    const menu = $('.menu');
    if (!menu) return;

    const porGrupo = {};
    SERVICES.forEach(s => { (porGrupo[s.group] = porGrupo[s.group] || []).push(s); });

    menu.textContent = '';
    Object.keys(porGrupo).sort((a, b) => ordenSeg(a) - ordenSeg(b)).forEach(g => {
      const grupo = el('div', 'menu__group');
      grupo.setAttribute('data-reveal', 'up');

      const h3 = el('h3', 'menu__group-title');
      const motivo = el('span', 'menu__motif');
      motivo.setAttribute('aria-hidden', 'true');
      motivo.textContent = '⚜';
      h3.append(motivo, document.createTextNode(' ' + rotuloSeg(g)));

      const ul = el('ul', 'menu__list');
      porGrupo[g].forEach(s => {
        const li = el('li', 'menu__row' + (s.destacado ? ' menu__row--destacado' : ''));

        const nom = el('span', 'menu__name');
        nom.appendChild(document.createTextNode(s.name));
        if (s.destacado) {
          const m = el('span', 'menu__motif');
          m.setAttribute('aria-hidden', 'true');
          m.textContent = ' ⚜';
          nom.appendChild(m);
        }
        const desc = el('span', 'menu__desc'); desc.textContent = s.desc || '';
        const pre = el('span', 'menu__price');
        pre.textContent = s.price === null ? (s.nota || 'Consultar') : money(s.price);
        /* La duración no se enseña en ninguna parte del sitio, pero la celda
           sostiene la rejilla de cuatro columnas. */
        const dur = el('span', 'menu__dur'); dur.textContent = '—';

        li.append(nom, desc, pre, dur);
        ul.appendChild(li);
      });

      grupo.append(h3, ul);
      menu.appendChild(grupo);
    });
  }

  /* ---------- horario ---------- */
  function pintarHorario(horario) {
    const caja = $('#horario-local');
    if (!caja) return;

    /* Los días con el mismo horario se juntan en un tramo: «Lun – Vie · 9:00 –
       20:00» se lee de un vistazo y siete líneas no. Se recorre de lunes a
       domingo, que es como lo lee la gente, y no de domingo a sábado, que es
       como lo numera la base. */
    const orden = [1, 2, 3, 4, 5, 6, 0];
    const dias = orden.map(dow => horario.find(h => h.dow === dow)).filter(Boolean);
    if (!dias.length) return;

    const clave = d => d.abierto ? d.abre + '-' + d.cierra : 'cerrado';
    const tramos = [];
    dias.forEach(d => {
      const ultimo = tramos[tramos.length - 1];
      if (ultimo && clave(ultimo.fin) === clave(d)) { ultimo.fin = d; return; }
      tramos.push({ ini: d, fin: d });
    });

    const nombre = d => DIAS_LARGO[d.dow].slice(0, 3);
    caja.textContent = '';
    tramos.forEach((t, i) => {
      if (i) caja.appendChild(document.createElement('br'));
      const rango = t.ini === t.fin ? DIAS_LARGO[t.ini.dow] : nombre(t.ini) + ' – ' + nombre(t.fin);
      caja.appendChild(document.createTextNode(
        rango + ' · ' + (t.ini.abierto ? t.ini.abre + ' – ' + t.ini.cierra : 'Cerrado')));
    });
  }

  /* ---------- galería ---------- */
  /* Va por su cuenta y no dentro del catálogo: las fotos pesan y no cambian,
     así que se piden aparte y el navegador las guarda. Metidas en el catálogo
     se descargarían enteras en cada visita y por delante de la reserva. */
  async function cargarGaleria() {
    const rejilla = $('.gallery');
    if (!rejilla) return;
    let r;
    try { r = await pedir('/galeria'); } catch (e) { return; }
    if (!r || !r.fotos || !r.fotos.length) return;   // se quedan las de fábrica

    /* El video de fábrica se conserva y se pone al final: es material del local
       y la galería del panel es solo de fotos. */
    const video = rejilla.querySelector('.tile--video');
    rejilla.textContent = '';

    r.fotos.forEach(f => {
      const b = el('button', 'tile');
      b.type = 'button';
      b.setAttribute('data-reveal', 'up');
      if (f.video) {
        /* Mismo tratamiento que el video que ya traía la galería: sin sonido,
           en bucle y sin controles. Es una pieza de portada, no un reproductor.
           `preload="none"` para que no se descargue hasta que haga falta: son
           megas, y la mayoría de visitantes no llega a tocarlo. */
        b.classList.add('tile--video');
        const v = document.createElement('video');
        v.src = f.url;
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
        v.setAttribute('aria-hidden', 'true');
        b.setAttribute('aria-label', f.alt);
        b.appendChild(v);
      } else {
        const img = document.createElement('img');
        /* La baldosa pide la miniatura; la grande solo se descarga si alguien
           amplía, que es una minoría de las visitas. `data-grande` es de donde
           la saca el visor. */
        img.src = f.mini || f.url;
        img.setAttribute('data-grande', f.url);
        img.alt = f.alt;
        img.loading = 'lazy';
        img.decoding = 'async';
        b.appendChild(img);
      }
      rejilla.appendChild(b);
    });
    if (video) rejilla.appendChild(video);

    /* Se renumeran y ya está: el lightbox lee la lista al abrirse y los clics
       van por delegación sobre esta misma rejilla, así que no hay que volver a
       montar nada. */
    [...rejilla.querySelectorAll('.tile')].forEach((t, i) => t.setAttribute('data-lightbox', i));
    if (window.__motion) window.__motion.reveal();
  }

  /* ---------- vitrina ---------- */
  function pintarProductos(productos) {
    const seccion = $('#productos');
    const caja = $('#prods-web');
    if (!seccion || !caja) return;

    /* Sin productos la sección no se enseña vacía ni con un «próximamente»:
       simplemente no está. Una sección vacía en una página comercial parece un
       error, no una promesa. */
    seccion.hidden = !productos.length;
    caja.textContent = '';
    if (!productos.length) return;

    productos.forEach(p => {
      const n = el('article', 'prod-web');
      const nom = el('h3', 'prod-web__n'); nom.textContent = p.nombre;
      n.appendChild(nom);
      if (p.marca) { const m = el('span', 'prod-web__m'); m.textContent = p.marca; n.appendChild(m); }
      if (p.descripcion) { const d = el('p', 'prod-web__d'); d.textContent = p.descripcion; n.appendChild(d); }
      const pr = el('span', 'prod-web__p'); pr.textContent = money(Number(p.precio));
      n.appendChild(pr);
      caja.appendChild(n);
    });
  }

  /* ------------------------------------------------------
     Enlaces externos configurables
     ------------------------------------------------------ */
  function setupEnlacesExternos() {
    document.querySelectorAll('[data-instagram]').forEach(a => {
      if (INSTAGRAM_URL) { a.href = INSTAGRAM_URL; return; }
      /* Sin perfil configurado se retira el enlace en vez de dejarlo muerto o
         llevando al inicio de Instagram, que no es el de la barbería. */
      a.remove();
    });
  }


  /* ------------------------------------------------------
     Modificar una cita
     ------------------------------------------------------
     El cliente entra con su código y su celular, elige qué quiere cambiar y va
     directo a ese paso. De ahí sigue con «Continuar» y «Atrás» como en una
     reserva normal, y al confirmar se crea la nueva y se cancela la anterior.

     Hasta ahora no existía: quien quería mover su cita reservaba otra vez y
     acababa con dos. La vieja seguía bloqueando su hora, nadie iba a ocuparla y
     el local no se enteraba hasta que el cliente no aparecía. */
  let cambiando = null;      // la cita que se está cambiando, o null
  let quiereCambiar = [];    // qué pasos pidió cambiar: [1,2,3]

  function entrarAModificar() {
    cambiando = null;
    quiereCambiar = [];
    $$('[data-cambiar]').forEach(o => o.setAttribute('aria-pressed', 'false'));
    $('#buscar-error').hidden = true;
    $('#hallada').hidden = true;
    $('#buscar-tel').value = '';
    state.step = 0;
    render();
    /* Desde el hero el modal está cerrado y hay que abrirlo; desde dentro ya lo
       está y `openBooking` solo recoloca. Sirve para los dos. */
    openBooking(0);
    setTimeout(() => $('#buscar-tel').focus(), 80);
  }

  /* Delegado en el documento. El enlace vive en el hero, y motion.js reescribe
     ese bloque para animarlo por líneas: un manejador puesto sobre el botón
     concreto moriría al reemplazarse el nodo. Delegando sobrevive, y además
     funciona para cualquier «modificar» que se añada mañana en otro sitio. */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-modificar]');
    if (!b) return;
    e.preventDefault();
    entrarAModificar();
  });

  $('#buscar-ir').addEventListener('click', async () => {
    const err = $('#buscar-error');
    err.hidden = true;
    const telefono = $('#buscar-tel').value.trim();
    if (!telefono) {
      err.textContent = 'Escribe tu celular.';
      err.hidden = false; return;
    }
    const b = $('#buscar-ir');
    b.disabled = true;
    b.textContent = 'Buscando…';
    try {
      const r = await pedir('/reservar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buscar: { telefono } })
      });
      cambiando = r.cita;

      /* Se precarga la cita entera en el estado. Así, cambie lo que cambie, lo
         que no toca viaja igual que estaba: quien solo mueve la hora conserva
         su barbero y sus servicios sin tener que volver a elegirlos. */
      state.service = r.cita.servicios[0] || null;
      state.extras  = r.cita.servicios.slice(1);
      state.barber  = r.cita.profesional;
      /* `state.date` es un objeto Date en todo el flujo, no una cadena: el
         calendario lo compara con ymd() y el .ics lo formatea. Guardarlo como
         texto aquí lo habría roto en el paso siguiente. */
      const d = new Date(r.cita.inicio);
      state.date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      state.slot = pad(d.getHours()) + ':' + pad(d.getMinutes());
      state.customer = {
        name: r.cita.cliente.nombre,
        phone: r.cita.cliente.telefono,
        email: r.cita.cliente.email || ''
      };

      /* Se pide el equipo YA, con los servicios de la cita. Sin esto PROFS
         llegaba vacío —el paso del barbero decía «elige primero un servicio»
         teniendo uno— y el calendario del paso siguiente no sabía los días
         libres de nadie: dejaba elegir el día de descanso del barbero. */
      await cargarProfesionales();

      mostrarHallada({ inicio: new Date(r.cita.inicio), servicios: r.cita.servicios });
    } catch (e) {
      err.textContent = e.message || 'No se pudo buscar';
      err.hidden = false;
    } finally {
      b.disabled = false;
      b.textContent = 'Buscar mi cita';
    }
  });

  /* Enseña la cita encontrada y las tres opciones. La usan los dos caminos: el
     que busca por celular y el botón «Modificar esta reserva» de la pantalla
     final, que ya tiene los datos y no necesita buscar nada. */
  function mostrarHallada(cita) {
    const nombres = (cita.servicios || []).map(id => (byId(id) || {}).name).filter(Boolean);
    const caja = $('#hallada-cita');
    caja.textContent = '';
    const cuando = el('strong');
    const d = cita.inicio;
    cuando.textContent = shortDate(d) + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    const qué = el('span');
    qué.textContent = nombres.join(' + ') || 'Tu cita';
    caja.append(cuando, qué);
    $('#hallada').hidden = false;
    $('#buscar-error').hidden = true;
  }

  /* Se marcan las que se quieran y luego «Continuar»: quien viene a cambiar el
     barbero Y la hora no debería tener que hacer el recorrido dos veces. */
  $$('[data-cambiar]').forEach(op => op.addEventListener('click', () => {
    const n = Number(op.getAttribute('data-cambiar'));
    const i = quiereCambiar.indexOf(n);
    if (i === -1) quiereCambiar.push(n); else quiereCambiar.splice(i, 1);
    quiereCambiar.sort();
    op.setAttribute('aria-pressed', String(i === -1));

    /* Solo se marca lo que se pulsó. Antes, marcar «el servicio» encendía
       también «el día o la hora» —con la idea de que otro servicio dura otra
       cosa y el cupo podría no caber—, y eso hacía dos daños: encendía una
       casilla que nadie había tocado, y al desmarcar el servicio la dejaba
       encendida, así que quien deshacía su clic acababa con «el día o la hora»
       marcado sin saber por qué.

       Si el servicio nuevo no cabe en la hora de siempre, lo dice el servidor
       al confirmar y la cita se queda como estaba. Vale más un aviso al final
       que tocarle las casillas por detrás a quien está mirándolas. */

    $('#hallada-pista').textContent = quiereCambiar.length
      ? 'Pulsa Continuar y solo te preguntamos eso.'
      : 'Marca lo que quieras cambiar y pulsa Continuar.';
    render();
  }));

  /* ------------------------------------------------------
     Lightbox de la galería
     ------------------------------------------------------ */
  function setupLightbox() {
    const caja = $('#lightbox');
    if (!caja) return;
    const panel   = caja.querySelector('.lightbox__panel');
    const figura  = $('#lb-figura');
    const texto   = $('#lb-texto');
    const contador= $('#lb-contador');
    if (!document.querySelector('[data-lightbox]')) return;

    /* Las piezas se leen del marcado CADA VEZ que se abre, no una sola vez al
       arrancar. La galería se rehace cuando llegan las fotos del panel, y una
       lista capturada al principio se quedaría enseñando las de fábrica —o
       peor, mezclándolas—. Leerlas al abrir cuesta nada y no puede quedar
       desfasada. */
    const leerPiezas = () => [...document.querySelectorAll('[data-lightbox]')].map(btn => {
      const img = btn.querySelector('img');
      const vid = btn.querySelector('video');
      return img
        ? { tipo: 'img', src: img.getAttribute('data-grande') || img.src, texto: img.alt }
        : { tipo: 'video', src: vid.currentSrc || vid.getAttribute('src'),
            poster: vid.getAttribute('poster'),
            texto: (btn.getAttribute('aria-label') || '').replace(/^Ver el /, '') };
    });

    let piezas = leerPiezas();
    let i = 0;
    let ultimoFoco = null;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');

    function pintar() {
      const p = piezas[i];
      figura.textContent = '';
      let nodo;
      if (p.tipo === 'img') {
        nodo = el('img');
        nodo.src = p.src;
        nodo.alt = p.texto;
      } else {
        nodo = el('video');
        nodo.src = p.src;
        nodo.poster = p.poster;
        nodo.muted = true; nodo.loop = true; nodo.playsInline = true;
        nodo.setAttribute('aria-label', p.texto);
        /* Con movimiento reducido queda el póster y controles para verlo a mano. */
        if (reducido.matches) nodo.controls = true;
        else nodo.play().catch(() => {});
      }
      figura.appendChild(nodo);
      texto.textContent = p.texto;
      contador.textContent = (i + 1) + ' / ' + piezas.length;
    }

    function mover(paso) {
      i = (i + paso + piezas.length) % piezas.length; // circular
      pintar();
    }

    function abrir(indice) {
      piezas = leerPiezas();
      if (!piezas.length) return;
      ultimoFoco = document.activeElement;
      i = indice;
      caja.hidden = false;
      document.body.classList.add('is-locked');
      pintar();
      panel.focus();
      track('gallery_opened', { index: indice });
    }

    function cerrar() {
      caja.hidden = true;
      figura.textContent = ''; // suelta el video para que no siga corriendo
      document.body.classList.remove('is-locked');
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }

    /* Delegación en la rejilla, no un manejador por baldosa. Las baldosas se
       reemplazan cuando llegan las fotos del panel, y unos manejadores puestos
       sobre las viejas se irían con ellas —dejando la galería sin responder al
       clic justo después de cargar—. La rejilla, en cambio, no se sustituye. */
    const rejilla = $('.gallery');
    if (rejilla) {
      rejilla.addEventListener('click', e => {
        const baldosa = e.target.closest('[data-lightbox]');
        if (!baldosa) return;
        abrir(Number(baldosa.getAttribute('data-lightbox')) || 0);
      });
    }

    const verTodo = $('#ver-galeria');
    if (verTodo) verTodo.addEventListener('click', () => abrir(0));

    caja.querySelectorAll('[data-cerrar-lightbox]').forEach(b => b.addEventListener('click', cerrar));
    $('#lb-prev').addEventListener('click', () => mover(-1));
    $('#lb-next').addEventListener('click', () => mover(1));

    document.addEventListener('keydown', e => {
      if (caja.hidden) return;
      if (e.key === 'Escape')     { cerrar(); return; }
      if (e.key === 'ArrowLeft')  { mover(-1); return; }
      if (e.key === 'ArrowRight') { mover(1);  return; }
      if (e.key !== 'Tab') return;
      // Foco atrapado dentro del panel mientras esté abierto
      const focoables = [...panel.querySelectorAll('button')].filter(n => n.offsetParent !== null);
      if (!focoables.length) return;
      const primero = focoables[0], ultimo = focoables[focoables.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    });
  }

  /* ------------------------------------------------------
     Init
     ------------------------------------------------------ */
  setupEnlacesExternos();
  setupLightbox();
  setupHeroVideo();
  setupServiceMenu();
  setupAcordeon();

  /* Al volver a la pestaña. `visibilitychange` y no `focus` porque es el que
     dispara también cuando se vuelve desde otra aplicación en el celular, que
     es como se navega la mitad de las veces. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pararVigilancia(); return; }
    refrescarCatalogo();
    arrancarVigilancia();
  });
  if (!document.hidden) arrancarVigilancia();
  /* Va al final y sin await: la página ya está completa y usable con lo que
     trae escrito. Esto solo la pone al día con lo que diga el panel. */
  cargarCatalogo();
  setupReviewsMarquee();
  setupInlineVideos();
  renderBarbers();
  renderSegs();
  renderPickServices();
  renderPickBarbers();
  render();
})();

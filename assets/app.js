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
    color:      'Color y tratamiento',
    depilacion: 'Depilación facial',
    cejas:      'Cejas',
    facial:     'Limpieza facial',
    unas:       'Uñas'
  };

  /* Segmentos de los que solo tiene sentido llevar una cosa: no se piden dos
     cortes en la misma cita, ni dos diseños de cejas. Elegir otro reemplaza al
     anterior en vez de sumarlo. Depilación facial y limpieza facial sí admiten
     varios: son zonas y tratamientos que se combinan. */
  const UNICO = ['cortes', 'color', 'cejas', 'unas'];

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
  const BARBERS = [
    { id: 1, name: 'Emanuel', spec: '', photo: 'assets/barbero-ema.jpg',
      alt: 'Emanuel, barbero de The Imperial Clasic, apoyado en la silla de barbería' },
    /* Sin id: no figura entre los profesionales que reciben citas. Se muestra
       en la portada porque trabaja en el local, pero su tarjeta no preselecciona
       a nadie al abrir la reserva —hacerlo agendaría con quien no existe en la
       agenda—. En cuanto el local confirme quién es, se le pone su id. */
    { id: null, name: 'Simon', spec: '', photo: 'assets/barbero-simon.jpg',
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

  const SHOP = {
    name: 'The Imperial Clasic Barber',
    address: 'Prados de Sabaneta, Antioquia, Colombia',
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
      const msg = (cuerpo && cuerpo.error) || (r.status === 404 ? SIN_API : 'Error ' + r.status);
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
      CUPOS = { cargando: false, error: r.cerrado ? 'cerrado' : null,
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
    img.src = b.photo;
    /* El alt describe la foto (sirve para buscadores y si la imagen no carga),
       y el botón lleva su propio aria-label para que el lector de pantalla no
       lea el nombre dos veces. */
    img.alt = b.alt || '';
    card.setAttribute('aria-label', 'Elegir a ' + b.name);
    card.querySelector('.barber__name').textContent = b.name;
    const spec = card.querySelector('.barber__spec');
    if (b.spec) spec.textContent = b.spec; else spec.remove();
    card.addEventListener('click', () => onPick(b.id, index));
    return card;
  }

  function renderBarbers() {
    const wrap = $('#barbers-list');
    wrap.textContent = ''; // reemplaza el contenido estático (SEO/no-JS) por la versión con handlers
    BARBERS.forEach((b, i) => {
      wrap.appendChild(barberCard(b, i, id => {
        /* Atajo desde la portada. Solo preselecciona si esa persona existe en la
           agenda; si no, abre la reserva sin barbero elegido en vez de dejar un
           id inválido que reventaría al pedir cupos. */
        state.barber = id;
        track('booking_started', { trigger_location: 'barber_card' });
        if (id !== null) track('barber_selected', { barber_name: b.name });
        syncBarberCards(wrap);
        openBooking(PASO_BARBERO);
      }));
    });
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
    counter.textContent = 'Paso ' + pos + ' de ' + pasos.length;
    summary.textContent = summaryFor(step);
    heading.innerHTML = TITLES[step - 1];
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

    stepFoot.hidden = step === PASOS;
    backBtn.hidden = step === 1;
    stepFoot.dataset.single = String(step === 1);

    const esConfirmacion = step === PASOS - 1;
    nextBtn.textContent = esConfirmacion ? 'Confirmar reserva' : 'Continuar';
    nextBtn.className = 'btn ' + (esConfirmacion ? 'btn--gold' : 'btn--wine');
    nextBtn.disabled = !canAdvance();

    /* Reflejar el estado en los selectores cada vez que se pinta, no solo al
       hacer clic. Si no, una selección hecha fuera del modal (el atajo del
       barbero en la portada) llega al paso 2 sin marcar y parece perdida. */
    syncPickServices();
    syncBarberCards($('#pick-barbers'));

    if (step === 3) { renderCalendar(); renderSlots(); cargarCupos(); }
  }

  const precioTexto = s => (s.price === null ? (s.nota || 'Según diseño') : money(s.price));

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

      /* Solo se descartan los días pasados. Saber si un día concreto tiene
         cupo exigiría una consulta por casilla —treinta y una al pintar el
         mes—, así que el calendario deja elegir y es la lista de horarios la
         que responde «sin horas» o «cerrado ese día». */
      btn.disabled = date < today;
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
      count.textContent = CUPOS.error === 'cerrado' ? 'Cerrado ese día' : 'No pudimos ver la agenda';
      const p = el('p', 'step__hint');
      p.textContent = CUPOS.error === 'cerrado'
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
        }
      })
    }).then(r => {
      state.codigo = r.codigo;
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

  /* Un evento .ics necesita hora de fin obligatoriamente. Como la carta no
     maneja duraciones, se reserva un bloque neutro que NO se muestra en ninguna
     parte del sitio: solo evita que el calendario del cliente cree un evento
     inválido o de duración cero. */
  const ICS_BLOQUE_MIN = 60;

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
      'DTEND:'   + icsStamp(state.date, state.slot, ICS_BLOQUE_MIN),
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

  function goNext() {
    if (state.step === PASO_DATOS) {
      if (!validateForm()) {
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

      submitBooking().catch(e => {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Confirmar reserva';
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
    const pasos = pasosActivos();
    state.step = pasos[Math.max(0, pasos.indexOf(state.step) - 1)];
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

  $('#add-calendar').addEventListener('click', () => { track('add_to_calendar_click', {}); downloadIcs(); });
  $('#restart').addEventListener('click', () => {
    track('booking_restarted', {});
    state.step = 1; render(); panel.scrollTop = 0;
  });

  /* ------------------------------------------------------
     Overlay
     ------------------------------------------------------ */
  function openBooking(step) {
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
    panel.focus();
  }

  function closeBooking() {
    if (state.step < 5) {
      track('booking_abandoned', { last_step: state.step, last_step_name: TITLES[state.step - 1].replace(/<[^>]+>/g, '') });
    }
    booking.hidden = true;
    document.body.classList.remove('is-locked');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

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

    /* Velocidad constante en px/s en vez de duración fija: con 3 reseñas o con
       15, la cinta se mueve igual de rápido. */
    const PX_PER_SECOND = 45;
    function syncSpeed() {
      const distance = track.scrollWidth / 2; // la mitad = un ciclo completo
      if (distance > 0) track.style.setProperty('--marquee-duration', (distance / PX_PER_SECOND) + 's');
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
  function setupServiceMenu() {
    /* La portada ya no lista servicios uno a uno, así que no hay botones por
       servicio: el CTA de la carta usa [data-book] como el resto del sitio.
       Aquí solo queda la aparición en cascada del bloque. */
    const bloque = $('.carta-wrap'); // incluye el texto y el video de al lado
    if (!bloque) return;

    const piezas = bloque.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      piezas.forEach(n => n.classList.add('is-in'));
      return;
    }
    new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        piezas.forEach((n, i) => {
          n.style.setProperty('--d', i * 110 + 'ms');
          n.classList.add('is-in');
        });
        obs.unobserve(e.target); // una sola vez: no reaparece al volver a subir
      });
    }, { threshold: 0.2 }).observe(bloque);
  }



  /* ------------------------------------------------------
     Aparición al hacer scroll
     ------------------------------------------------------ */
  function setupRevelado() {
    const piezas = $$('[data-rv]');
    if (!piezas.length) return;

    /* Si el navegador no trae el observador, o el visitante pidió no ver
       movimiento, no se toca nada: el contenido ya está visible en el HTML y
       esconderlo para luego enseñarlo sería empeorarlo. */
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto || !('IntersectionObserver' in window)) return;

    /* El estado inicial se pone AQUÍ y no en la hoja de estilos a propósito.
       Un `opacity:0` en CSS deja la página en blanco para siempre si este
       archivo no llega a ejecutarse —un error de red, un bloqueador, una
       sintaxis nueva en un navegador viejo—. Puesto desde JavaScript, el
       riesgo desaparece: si el script no corre, tampoco esconde nada. */
    piezas.forEach(n => {
      n.style.opacity = '0';
      n.style.transform = 'translateY(26px)';
      n.style.willChange = 'opacity, transform';
    });

    /* Mostrar un elemento, venga de donde venga la orden. */
    function revelar(n, d) {
      if (n.dataset.rvHecho) return;
      n.dataset.rvHecho = '1';
      n.style.transition = 'opacity .9s var(--ease) ' + d + 'ms, ' +
                           'transform .9s var(--ease) ' + d + 'ms';
      n.style.opacity = '1';
      n.style.transform = 'none';
      /* Se suelta el will-change: si se deja puesto, el navegador mantiene una
         capa reservada en memoria por cada elemento del sitio, para siempre. */
      setTimeout(() => { n.style.willChange = ''; }, 900 + d);
    }

    /* Red de seguridad. El observador puede no llegar a dispararse nunca:
       navegadores que lo implementan a medias, pestañas que el sistema
       congela por estar en segundo plano, un contenedor con overflow que
       rompe el cálculo. Cualquiera de esos casos dejaría media página en
       blanco de forma permanente, que es mucho peor que perderse la
       animación. Pasados tres segundos se enseña lo que siga escondido. */
    setTimeout(() => piezas.forEach(n => revelar(n, 0)), 3000);

    const obs = new IntersectionObserver((entradas, o) => {
      entradas.forEach(e => {
        if (!e.isIntersecting) return;
        const n = e.target;

        /* El escalonado se calcula contra los hermanos marcados, no contra
           todos los elementos de la página: así una fila de cuatro tarjetas
           entra en cascada, pero un título suelto no hereda el retraso de lo
           que vino antes. Se topa en seis para que una galería larga no acabe
           con el último elemento entrando medio segundo tarde. */
        const hermanos = n.parentElement
          ? Array.prototype.filter.call(n.parentElement.children, x => x.hasAttribute('data-rv'))
          : [n];
        const i = Math.min(6, hermanos.indexOf(n));
        const d = i * 90;

        revelar(n, d);
        o.unobserve(n);   // una sola vez: al volver a subir no reaparece
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    piezas.forEach(n => obs.observe(n));
  }

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
      /* Con un solo profesional no hay nada que elegir y el paso se salta.
         Sale de quién presta el servicio hoy, no de una lista escrita a mano
         que envejece en cuanto alguien entra o sale del equipo. */
      sinBarbero: (s.profesionales || []).length === 1,
      /* El destacado es criterio editorial del sitio, no un dato del negocio:
         la base no lo guarda, así que se conserva el del respaldo. */
      destacado: !!(respaldo && respaldo.destacado)
    };
  }

  async function cargarCatalogo() {
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
      SEGMENTOS = {};
      vistos.forEach(k => { SEGMENTOS[k] = rotuloSeg(k); });
      if (vistos.indexOf(segActivo) === -1) segActivo = vistos[0];

      pintarCarta();
      setupAcordeon();   // la carta se rehízo entera: hay que volver a plegarla
      renderSegs();
      renderPickServices();
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
    Object.keys(porGrupo).forEach(g => {
      const grupo = el('div', 'menu__group');
      grupo.setAttribute('data-rv', '');

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
     Lightbox de la galería
     ------------------------------------------------------ */
  function setupLightbox() {
    const caja = $('#lightbox');
    if (!caja) return;
    const panel   = caja.querySelector('.lightbox__panel');
    const figura  = $('#lb-figura');
    const texto   = $('#lb-texto');
    const contador= $('#lb-contador');
    const disparadores = [...document.querySelectorAll('[data-lightbox]')];
    if (!disparadores.length) return;

    /* Las piezas se leen del propio marcado: una sola fuente, y si mañana se
       agrega una foto a la galería el lightbox la toma sin tocar el JS. */
    const piezas = disparadores.map(btn => {
      const img = btn.querySelector('img');
      const vid = btn.querySelector('video');
      return img
        ? { tipo: 'img', src: img.src, texto: img.alt }
        : { tipo: 'video', src: vid.currentSrc || vid.getAttribute('src'),
            poster: vid.getAttribute('poster'),
            texto: (btn.getAttribute('aria-label') || '').replace(/^Ver el /, '') };
    });

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

    disparadores.forEach((btn, n) => btn.addEventListener('click', () => abrir(n)));
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
  setupRevelado();
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

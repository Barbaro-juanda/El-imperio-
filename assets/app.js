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
     `sinBarbero` salta el paso de barbero: las uñas las atiende una sola
     especialista, no hay a quién elegir. */
  const SEGMENTOS = {
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

  const SERVICES = [
    // — Cortes —
    { id: 'corte-sencillo', group: 'cortes', name: 'Corte Sencillo', price: 35000, desc: 'Lavado de cabello y peinado.' },
    { id: 'corte-vip', group: 'cortes', name: 'Corte VIP', price: 45000, desc: 'Bebida de cortesía, limpieza facial y vapor ozono.', destacado: true },
    { id: 'corte-barba-senc', group: 'cortes', name: 'Corte y Barba Sencillo', price: 48000, desc: 'Corte y barba, con lavado y peinado.' },
    { id: 'corte-barba-vip', group: 'cortes', name: 'Corte y Barba VIP', price: 60000, desc: 'Todo el VIP, con la barba incluida.', destacado: true },
    { id: 'ritual-barba', group: 'cortes', name: 'Ritual de Barba', price: 26000, desc: 'Limpieza facial, afeitado con vapor y diseño.' },
    { id: 'barba-sencilla', group: 'cortes', name: 'Barba Sencilla', price: 15000, desc: 'Diseño de barba y afeitado.' },
    { id: 'pigmentacion', group: 'cortes', name: 'Pigmentación', price: 20000, desc: 'Densifica barba o cuero cabelludo.' },

    // — Color y tratamiento —
    { id: 'colorimetria', group: 'color', name: 'Colorimetría', price: null, nota: 'Según diseño, color y cabello', desc: 'Platinados, rayos, plumillas y más.' },
    { id: 'freestyle', group: 'color', name: 'Freestyle', price: null, nota: 'Según diseño', desc: 'Dibujo tallado en el cuero cabelludo.' },
    { id: 'hidrocauterizacion', group: 'color', name: 'Hidrocauterización capilar', price: null, nota: 'Según largo y densidad', desc: 'Sella la cutícula y controla el frizz.' },

    // — Depilación facial —
    { id: 'dep-nariz-oidos', group: 'depilacion', name: 'Depilación de nariz y oídos', price: 25000, nota: 'Desde', desc: 'Las dos zonas en una sola sesión.' },
    { id: 'dep-nasales', group: 'depilacion', name: 'Depilación de fosas nasales', price: 15000, desc: 'Depilación con cera.' },
    { id: 'dep-oidos', group: 'depilacion', name: 'Depilación de oídos', price: 15000, desc: 'Depilación con cera.' },

    // — Cejas —
    { id: 'cejas-hilo', group: 'cejas', name: 'Cejas con hilo', price: 20000, desc: 'Depilación con hilo y diseño de cejas.' },
    { id: 'cejas-cuchilla', group: 'cejas', name: 'Cejas con cuchilla', price: 10000, desc: 'Depilación con cuchilla y diseño de cejas.' },

    // — Limpieza facial —
    { id: 'ritual-facial', group: 'facial', name: 'Ritual Facial', price: 56000, desc: 'Vapor ozono, mascarillas, parches y masaje ocular.', destacado: true },
    { id: 'masc-negros', group: 'facial', name: 'Mascarilla de puntos negros', price: 16000, desc: 'Retira impurezas y exceso de grasa.' },
    { id: 'masc-hialuronico', group: 'facial', name: 'Mascarilla de hialurónico', price: 20000, desc: 'Piel hidratada y de aspecto más joven.' },
    { id: 'masajeador', group: 'facial', name: 'Masajeador ocular', price: 20000, desc: 'Reduce líneas de expresión y ojeras.' },
    { id: 'parches-ojeras', group: 'facial', name: 'Parches para ojeras', price: 10000, desc: 'Hidrata y mejora el contorno de ojos.' },

    // — Uñas —
    { id: 'manos-pies', group: 'unas', name: 'Manos y pies', price: null, nota: 'Consultar', desc: 'Manicura y pedicura en una sola cita.', destacado: true, sinBarbero: true },
    { id: 'manos-tradicional', group: 'unas', name: 'Manos Tradicionales', price: 30000, desc: 'Limado, cutícula y esmalte tradicional.', sinBarbero: true },
    { id: 'pies-tradicional', group: 'unas', name: 'Pies Tradicional', price: 35000, desc: 'Limado, cutícula y esmalte en los pies.', sinBarbero: true },
    { id: 'manos-semi', group: 'unas', name: 'Manos Semipermanentes', price: 40000, desc: 'Esmalte semipermanente, con brillo que dura semanas.', sinBarbero: true },
    { id: 'pies-semi', group: 'unas', name: 'Pies Semipermanente', price: 45000, desc: 'Semipermanente en pies, de larga duración.', sinBarbero: true },
    { id: 'rubber', group: 'unas', name: 'Manicura con Base Rubber', price: 65000, desc: 'Base rubber: uñas más fuertes y parejas.', destacado: true, sinBarbero: true },
    { id: 'press-on', group: 'unas', name: 'Extensión Press-on', price: 100000, desc: 'Extensiones aplicadas al momento, largo a elección.', sinBarbero: true },
    { id: 'decoracion', group: 'unas', name: 'Decoración y diseño de uñas', price: null, nota: 'Consultar', desc: 'Diseño a mano, del detalle simple al completo.', sinBarbero: true },
    { id: 'stiker', group: 'unas', name: 'Stiker y pedrería', price: 3000, desc: 'Apliques y pedrería para rematar el diseño.', sinBarbero: true },
    { id: 'velo', group: 'unas', name: 'Velo Terapia', price: 6000, desc: 'Refuerzo con velo para uñas quebradizas.', sinBarbero: true },
    { id: 'retiro-presson', group: 'unas', name: 'Retiro de Press-on', price: 15000, desc: 'Retiro cuidado, sin dañar la uña natural.', sinBarbero: true },
    { id: 'retiro-semi', group: 'unas', name: 'Retiro de Semipermanente', price: 5000, desc: 'Retiro del esmalte sin desgastar la uña.', sinBarbero: true },
  ];

  const byId = id => SERVICES.find(s => s.id === id);

  /* Barberos reales del local. `spec` va vacío a propósito: los tres nombres y
     especialidades anteriores (Mateo/Samuel/Tomás) eran relleno del diseño, y no
     sé cuál es la especialidad real de Ema y Simon — inventarla sería atribuirle
     una destreza a una persona real. Al llenarla, la línea aparece sola. */
  const BARBERS = [
    { name: 'Ema',   spec: '', photo: 'assets/barbero-ema.jpg',
      alt: 'Ema, barbero de The Imperial Clasic, apoyado en la silla de barbería' },
    { name: 'Simon', spec: '', photo: 'assets/barbero-simon.jpg',
      alt: 'Simon, barbero de The Imperial Clasic, de brazos cruzados en el local' }
  ];

  /* REVIEWS se eliminó: los tres testimonios eran inventados por el diseño.
     La sección ahora muestra la calificación real de Google, que es HTML
     estático y no necesita render. Al conseguir reseñas reales, volver a
     declarar el arreglo aquí y reponer renderReviews(). */

  const TIMES = ['09:00', '09:45', '10:30', '11:15', '12:00', '12:45',
                 '14:00', '14:45', '15:30', '16:15', '17:00', '17:45'];

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

  const money = n => '$' + n.toLocaleString('es-CO');
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const $  = sel => document.querySelector(sel);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  /* Sábado cierra a las 18:00, domingo cerrado. */
  const isClosed = d => d.getDay() === 0;
  const lastSlotFor = d => (d.getDay() === 6 ? '17:00' : '23:59');

  /* Ocupación simulada, estable para una misma fecha + barbero.
     Sustituir por la disponibilidad real del backend. */
  function bookedSlots(dateKey, barberIndex) {
    let h = 0;
    const seed = dateKey + '#' + barberIndex;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return TIMES.filter((_, i) => ((h >> i) & 1) === 1 && i % 3 !== 0);
  }

  function availableTimes(date, barberIndex) {
    if (!date || isClosed(date)) return [];
    const limit = lastSlotFor(date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isToday = date.getTime() === today.getTime();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const taken = bookedSlots(ymd(date), barberIndex);

    return TIMES.filter(t => t <= limit).map(t => {
      const [hh, mm] = t.split(':').map(Number);
      const past = isToday && hh * 60 + mm <= nowMin + 30;
      return { label: t, free: !past && taken.indexOf(t) === -1 };
    });
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
    card.addEventListener('click', () => onPick(index));
    return card;
  }

  function renderBarbers() {
    const wrap = $('#barbers-list');
    wrap.textContent = ''; // reemplaza el contenido estático (SEO/no-JS) por la versión con handlers
    BARBERS.forEach((b, i) => {
      wrap.appendChild(barberCard(b, i, index => {
        state.barber = index;
        /* Atajo desde la portada: deja el barbero marcado y pide abrir en el
           paso 2. openBooking() lo baja al paso 1 si todavía no hay servicio.
           No pasa por los botones [data-book], así que booking_started se
           emite aquí o el embudo pierde estas sesiones por completo. */
        track('booking_started', { trigger_location: 'barber_card' });
        track('barber_selected', { barber_name: BARBERS[index].name });
        syncBarberCards(wrap);
        openBooking(3); // paso del barbero; openBooking lo baja si falta el servicio
      }));
    });
  }

  function syncBarberCards(scope) {
    scope.querySelectorAll('.barber').forEach(card => {
      const on = Number(card.dataset.barber) === state.barber;
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
    barber: null,
    date: null,
    slot: null,
    month: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
    customer: { name: '', phone: '', email: '' }
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
    const b = state.barber !== null ? BARBERS[state.barber] : null;
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

    if (step === 3) { renderCalendar(); renderSlots(); }
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
  function renderPickBarbers() {
    const wrap = $('#pick-barbers');
    BARBERS.forEach((b, i) => {
      wrap.appendChild(barberCard(b, i, index => {
        state.barber = index;
        state.slot = null;
        track('barber_selected', { barber_name: BARBERS[index].name });
        syncBarberCards(wrap);
        syncBarberCards($('#barbers-list'));
        render();
      }));
    });
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

      const past = date < today;
      const free = availableTimes(date, agendaDe()).some(s => s.free);
      btn.disabled = past || isClosed(date) || !free;
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

    const slots = availableTimes(state.date, agendaDe());
    const free  = slots.filter(s => s.free).length;
    dayEl.textContent = WEEKDAYS[state.date.getDay()] + ' ' + state.date.getDate();
    count.textContent = free === 0 ? 'Sin horas' : 'Quedan ' + free + (free === 1 ? ' hora' : ' horas');

    slots.forEach(s => {
      const btn = el('button', 'slot');
      btn.type = 'button';
      btn.textContent = s.label;
      btn.disabled = !s.free;
      btn.setAttribute('aria-pressed', String(state.slot === s.label));
      btn.setAttribute('aria-label', s.label + (s.free ? '' : ' — ocupada'));
      btn.addEventListener('click', () => {
        state.slot = s.label;
        track('datetime_selected', { booking_date: ymd(state.date), booking_time: s.label });
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
      ? ['Barbero', BARBERS[state.barber].name]
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
  function submitBooking() {
    const t = totales();
    const payload = {
      service: byId(state.service),
      extras:  state.extras.map(byId),
      total:   t.fijo,
      requiereCotizacion: t.variables.map(s => s.name),
      barber:  state.barber !== null ? BARBERS[state.barber] : null,
      date:    ymd(state.date),
      time:    state.slot,
      customer: state.customer
    };
    console.info('[reserva] pendiente de enviar al backend:', payload);
    return Promise.resolve(payload);
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
      'DESCRIPTION:' + (state.barber !== null ? 'Barbero: ' + BARBERS[state.barber].name : 'Atiende nuestra especialista en manicura') + '. Llega cinco minutos antes.',
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
  const PASO_DATOS = PASOS - 1; // 5: el último con formulario

  function goNext() {
    if (state.step === PASO_DATOS) {
      if (!validateForm()) {
        const bad = form.querySelector('.field--invalid input');
        if (bad) bad.focus();
        return;
      }
      track('booking_step_completed', { step_number: PASO_DATOS, step_name: STEP_NAMES[PASO_DATOS - 1] });
      submitBooking().then(() => {
        const t = totales();
        const conversionParams = {
          value: t.fijo,
          currency: 'COP',
          service_name: byId(state.service).name,
          extras_count: state.extras.length,
          barber_name: state.barber !== null ? BARBERS[state.barber].name : '(especialista manicura)',
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
  setupReviewsMarquee();
  setupInlineVideos();
  renderBarbers();
  renderSegs();
  renderPickServices();
  renderPickBarbers();
  render();
})();

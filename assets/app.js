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

     `group` define en qué bloque aparece en la página:
       cortes    → los principales, en cuadrícula Sencillo vs VIP
       rituales  → servicios completos que se agendan solos
       detalles  → complementos cortos
       color     → trabajos de precio variable
     `sub` subagrupa los detalles para que no queden en una lista plana. */
  const SERVICES = [
    // — Cortes —
    { id: 'corte-vip',        group: 'cortes', name: 'Corte VIP',               price: 45000, tier: 'VIP',      desc: 'Bebida de cortesía, limpieza facial, tratamiento de vapor ozono, lavado de cabello y peinado.' },
    { id: 'corte-barba-vip',  group: 'cortes', name: 'Corte y Barba VIP',       price: 60000, tier: 'VIP',      desc: 'Bebida de cortesía, limpieza facial, tratamiento de vapor ozono, lavado de cabello y peinado.' },
    { id: 'corte-sencillo',   group: 'cortes', name: 'Corte Sencillo',          price: 35000, tier: 'Sencillo', desc: 'Lavado de cabello y peinado.' },
    { id: 'corte-barba-senc', group: 'cortes', name: 'Corte y Barba Sencillo',  price: 48000, tier: 'Sencillo', desc: 'Lavado de cabello y peinado.' },

    // — Rituales —
    { id: 'ritual-facial',    group: 'rituales', name: 'Ritual Facial',   price: 56000, desc: 'Limpieza facial superficial: vapor ozono, mascarilla hidratante, mascarilla de puntos negros, mascarilla de colágeno, parches para ojeras y masajeador ocular.' },
    { id: 'ritual-barba',     group: 'rituales', name: 'Ritual de Barba',  price: 26000, desc: 'Bebida de cortesía, limpieza facial, afeitado con vapor y diseño de barba.' },
    { id: 'barba-sencilla',   group: 'rituales', name: 'Barba Sencilla',   price: 15000, desc: 'Diseño de barba y afeitado.' },

    // — Detalles —
    { id: 'pigmentacion',     group: 'detalles', sub: 'Barba y cejas', name: 'Pigmentación',              price: 14000, desc: 'De barba o cuero cabelludo. Perfecciona el corte y cubre las zonas de poca densidad.' },
    { id: 'cejas-cuchilla',   group: 'detalles', sub: 'Barba y cejas', name: 'Cejas con cuchilla',        price: 10000, desc: 'Depilación con cuchilla y diseño de cejas.' },
    { id: 'cejas-hilo',       group: 'detalles', sub: 'Barba y cejas', name: 'Cejas con hilo',            price: 20000, desc: 'Depilación con hilo y diseño de cejas.' },
    { id: 'dep-oidos',        group: 'detalles', sub: 'Barba y cejas', name: 'Depilación de oídos',       price: 15000, desc: 'Depilación con cera.' },
    { id: 'dep-nasales',      group: 'detalles', sub: 'Barba y cejas', name: 'Depilación de fosas nasales', price: 15000, desc: 'Depilación con cera.' },
    { id: 'masc-negros',      group: 'detalles', sub: 'Piel',   name: 'Mascarilla de puntos negros', price: 16000, desc: 'Retira impurezas y exceso de grasa.' },
    { id: 'masc-hialuronico', group: 'detalles', sub: 'Piel',   name: 'Mascarilla de hialurónico',   price: 20000, desc: 'Mascarilla de velo con ácido hialurónico. Piel hidratada y de aspecto más joven.' },
    { id: 'masajeador',       group: 'detalles', sub: 'Mirada', name: 'Masajeador ocular',           price: 20000, desc: 'Con calefacción y música relajante. Reduce líneas de expresión y ojeras.' },
    { id: 'parches-ojeras',   group: 'detalles', sub: 'Mirada', name: 'Parches para ojeras',         price: 10000, desc: 'Hidrata y mejora el aspecto del contorno de ojos.' },

    /* Manicura: aparece en la carta de la portada y dos de las tres reseñas
       destacadas la mencionan, así que tiene que ser reservable. Va como
       servicio principal —hay clientas que vienen solo por esto— con precio
       pendiente: nunca llegó en la lista de precios. */
    { id: 'manicura',         group: 'rituales', name: 'Manicura', price: null, nota: 'Consultar',
      desc: 'Manos cuidadas, con diseño y masaje incluido.',
      /* Se puede pedir sola o sumada a un corte, así que aparece en el paso 1 y
         también en el 2. Y la atiende una sola especialista: no hay barbero que
         elegir, por eso ese paso se salta cuando es el servicio principal. */
      tambienAdicional: true, sinBarbero: true },

    // — Color y tratamiento (precio variable) —
    { id: 'colorimetria',     group: 'color', name: 'Colorimetría',              price: null, nota: 'Según diseño, color y cabello', desc: 'Platinados, rayos, plumillas y otros trabajos de color.' },
    { id: 'freestyle',        group: 'color', name: 'Freestyle',                 price: null, nota: 'Según diseño',                 desc: 'Dibujo en el cuero cabelludo, para quien lleva la personalidad por delante.' },
    { id: 'hidrocauterizacion', group: 'color', name: 'Hidrocauterización capilar', price: null, nota: 'Según largo y densidad',    desc: 'Humectación intensa y sellado de cutícula: protege del frizz y las puntas abiertas. Ideal tras un proceso de color o en cabellos secos.' }
  ];

  /* Servicios que pueden ser el principal de una cita (paso 1). Los rituales
     entran aquí porque son servicios completos: alguien puede venir solo por el
     Ritual Facial de $56.000, que es el segundo más caro de la carta. */
  const PRIMARIOS   = SERVICES.filter(s => s.group === 'cortes' || s.group === 'rituales');
  /* Complementos del paso 2, selección múltiple. */
  const ADICIONALES = SERVICES.filter(s => s.group === 'detalles' || s.group === 'color' || s.tambienAdicional);

  const byId = id => SERVICES.find(s => s.id === id);

  /* Barberos reales del local. `spec` va vacío a propósito: los tres nombres y
     especialidades anteriores (Mateo/Samuel/Tomás) eran relleno del diseño, y no
     sé cuál es la especialidad real de Ema y Simon — inventarla sería atribuirle
     una destreza a una persona real. Al llenarla, la línea aparece sola. */
  const BARBERS = [
    { name: 'Ema',   spec: '', photo: 'assets/barbero-ema.jpg' },
    { name: 'Simon', spec: '', photo: 'assets/barbero-simon.jpg' }
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
      '<img class="barber__photo" alt="" loading="lazy" decoding="async">' +
      '<span class="barber__body">' +
        '<span class="barber__name"></span>' +
        '<span class="barber__spec"></span>' +
        '<span class="barber__tag">Elegir</span>' +
      '</span>';
    const img = card.querySelector('.barber__photo');
    img.src = b.photo;
    /* alt vacío: el nombre va en texto justo debajo, así que describir el
       retrato solo haría que el lector de pantalla repita la misma info. */
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

  const PASOS = 6;
  const PASO_BARBERO = 3;

  /* El paso de barbero no siempre aplica: la manicura la atiende una sola
     especialista, así que no hay nada que elegir. Se calcula la secuencia real
     para que la numeración diga "Paso 3 de 5" y no salte del 2 al 4. */
  function pasosActivos() {
    const s = state.service ? byId(state.service) : null;
    const salta = !!(s && s.sinBarbero);
    return [1, 2, 3, 4, 5, 6].filter(n => !(salta && n === PASO_BARBERO));
  }
  const saltaBarbero = () => !pasosActivos().includes(PASO_BARBERO);
  const TITLES = [
    'Elige un <em>servicio</em>',
    '¿Algo <em>más</em>?',
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
    if (step === 2) return s ? s.name : '⚜ Reserva';
    if (step === 3) return [s && s.name, extras].filter(Boolean).join(' ');
    if (step === 4) return [s && s.name, (b && b.name) || especialista].filter(Boolean).join(' · ');
    if (step === 5) return state.date && state.slot ? shortDate(state.date) + ' · ' + state.slot : '';
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
    if (!state.date || !state.slot) return 4;
    return 5;
  }

  /* Los requisitos son acumulativos, no solo los del paso actual. Antes cada
     paso miraba únicamente su propio campo, así que se podía llegar al final
     sin servicio y la confirmación reventaba al leer su precio. */
  function canAdvance() {
    if (!state.service) return false;
    if (!saltaBarbero() && state.step >= PASO_BARBERO && state.barber === null) return false;
    if (state.step >= 4 && !(state.date && state.slot)) return false;
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

    /* El paso 2 es opcional: si no eligió nada, el botón lo dice para que
       nadie sienta que le falta llenar algo. */
    const esConfirmacion = step === PASOS - 1;
    nextBtn.textContent = esConfirmacion ? 'Confirmar reserva'
                        : (step === 2 && !state.extras.length) ? 'Continuar sin adicionales'
                        : 'Continuar';
    nextBtn.className = 'btn ' + (esConfirmacion ? 'btn--gold' : 'btn--wine');
    nextBtn.disabled = !canAdvance();

    /* Reflejar el estado en los selectores cada vez que se pinta, no solo al
       hacer clic. Si no, una selección hecha fuera del modal (el atajo del
       barbero en la portada) llega al paso 2 sin marcar y parece perdida. */
    syncPickServices();
    syncPickExtras();
    syncBarberCards($('#pick-barbers'));

    if (step === 4) { renderCalendar(); renderSlots(); }
  }

  const precioTexto = s => (s.price === null ? (s.nota || 'Según diseño') : money(s.price));

  /* ---- paso 1: servicio principal ---- */
  function renderPickServices() {
    const list = $('#pick-services');
    list.textContent = '';
    let grupoActual = null;
    PRIMARIOS.forEach(s => {
      if (s.group !== grupoActual) {
        grupoActual = s.group;
        const cab = el('li', 'pick-group');
        cab.textContent = grupoActual === 'cortes' ? 'Cortes' : 'Rituales';
        list.appendChild(cab);
      }
      const li = el('li');
      const btn = el('button', 'pick');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');
      btn.dataset.id = s.id;
      btn.innerHTML =
        '<span class="pick__name"></span>' +
        '<span class="pick__desc"></span>' +
        '<span class="pick__price"></span>' +
        '<span class="pick__check" aria-hidden="true"></span>';
      btn.querySelector('.pick__name').textContent = s.name;
      btn.querySelector('.pick__desc').textContent = s.desc;
      btn.querySelector('.pick__price').textContent = precioTexto(s);
      btn.addEventListener('click', () => {
        state.service = s.id;
        /* Manicura vive en las dos listas; si ya estaba como adicional se quita
           para no cobrarla ni mostrarla dos veces. */
        const dup = state.extras.indexOf(s.id);
        if (dup !== -1) state.extras.splice(dup, 1);
        /* Cambiar de servicio puede activar o desactivar el paso de barbero. */
        if (saltaBarbero()) state.barber = null;
        track('service_selected', { service_name: s.name, service_price: s.price });
        render();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function syncPickServices() {
    $('#pick-services').querySelectorAll('.pick').forEach(btn => {
      const on = btn.dataset.id === state.service;
      btn.setAttribute('aria-pressed', String(on));
      btn.querySelector('.pick__check').textContent = on ? '⚜' : '';
    });
  }

  /* ---- paso 2: adicionales (selección múltiple, opcional) ---- */
  function renderPickExtras() {
    const list = $('#pick-extras');
    list.textContent = '';
    let subActual = null;
    ADICIONALES.forEach(s => {
      const sub = s.sub || (s.group === 'color' ? 'Color y tratamiento' : 'Otros');
      if (sub !== subActual) {
        subActual = sub;
        const cab = el('li', 'pick-group');
        cab.textContent = sub;
        list.appendChild(cab);
      }
      const li = el('li');
      const btn = el('button', 'pick pick--multi');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');
      btn.dataset.id = s.id;
      btn.innerHTML =
        '<span class="pick__name"></span>' +
        '<span class="pick__desc"></span>' +
        '<span class="pick__price"></span>' +
        '<span class="pick__check" aria-hidden="true"></span>';
      btn.querySelector('.pick__name').textContent = s.name;
      btn.querySelector('.pick__desc').textContent = s.desc;
      btn.querySelector('.pick__price').textContent = precioTexto(s);
      btn.addEventListener('click', () => {
        const i = state.extras.indexOf(s.id);
        if (i === -1) { state.extras.push(s.id); track('extra_added', { service_name: s.name, service_price: s.price }); }
        else { state.extras.splice(i, 1); track('extra_removed', { service_name: s.name }); }
        render();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function syncPickExtras() {
    const list = $('#pick-extras');
    if (!list) return;
    list.querySelectorAll('.pick').forEach(btn => {
      /* Si ya es el servicio principal, no tiene sentido ofrecerlo de nuevo. */
      const esPrincipal = btn.dataset.id === state.service;
      btn.closest('li').hidden = esPrincipal;
      const on = state.extras.indexOf(btn.dataset.id) !== -1;
      btn.setAttribute('aria-pressed', String(on));
      btn.querySelector('.pick__check').textContent = on ? '⚜' : '';
    });
    const t = totales();
    const resumen = $('#extras-total');
    if (resumen) {
      resumen.textContent = totalTexto();
    }
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

    const rows = [['Servicio', byId(state.service).name]];
    if (state.extras.length) {
      rows.push(['Adicionales', state.extras.map(id => byId(id).name).join(', ')]);
    }
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
     Init
     ------------------------------------------------------ */
  setupHeroVideo();
  setupServiceMenu();
  setupReviewsMarquee();
  setupInlineVideos();
  renderBarbers();
  renderPickServices();
  renderPickExtras();
  renderPickBarbers();
  render();
})();

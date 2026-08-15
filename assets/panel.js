/* =========================================================
   Panel de El Imperio
   Dos paneles con una sola entrada: la clave decide cuál se abre.
     · Administrador → agenda, facturas, servicios, disponibilidad
     · Profesional   → «Mi día», solo lo suyo
   ========================================================= */
(function () {
  'use strict';

  const $  = s => document.querySelector(s);
  const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const money = n => '$' + Number(n || 0).toLocaleString('es-CO');
  const inicial = n => String(n || '?').trim().charAt(0).toUpperCase();

  const DIAS  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DIAS3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const SEGMENTOS = { cortes: 'Cortes', color: 'Color y tratamiento', depilacion: 'Depilación facial',
                      cejas: 'Cejas', facial: 'Limpieza facial', unas: 'Uñas',
                      adicionales: 'Adicionales' };
  /* Duraciones que se ofrecen al crear un servicio. Los adicionales suelen ser
     remates de un cuarto de hora, y sin estas opciones cortas habría que
     escribir el número a mano cada vez. */
  const DURACIONES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180];
  const PERIODOS = [['dia', 'Día'], ['semana', 'Semana'], ['quincena', 'Quincena'],
                    ['mes', 'Mes'], ['ano', 'Año']];
  const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };

  /* PASO son los minutos con los que la API ofrece cupos y con los que se
     coloca todo. FILA es lo que mide una fila de la rejilla: al doblarla a 30
     minutos la jornada entera cabe en una pantalla sin desplazarse, que es
     como se mira una agenda de verdad. */
  const PASO = 15;
  const FILA = 30;
  const META_LOCAL = 300000;  // meta diaria; se edita aquí hasta que el local la fije

  /* Quién entró. Manda el servidor: el panel solo lo usa para no enseñar
     botones que la API va a rechazar de todos modos. La seguridad está allá. */
  let ROL = 'dueno', YO = { nombre: '—', profId: null };
  let dia = new Date();
  let vista = 'agenda';
  let profFiltro = 'todos';
  let periodo = 'dia';
  let revisando = null;    // el dueño mirando «Mi día» de alguien, en solo lectura
  let datos = { citas: [], bloqueos: [], profesionales: [],
                horario: { abre: '09:00', cierra: '20:00', abierto: true },
                resumen: { total: 0, cuantas: 0 }, comision: null };

  /* =========================================================
     Modo demostración — SOLO en localhost
     El servidor de desarrollo entrega archivos y nada más: no ejecuta /api. Sin
     esto no habría forma de revisar el panel sin publicarlo. La condición es el
     nombre de host, que el navegador no deja falsear: en cualquier dirección
     publicada queda muerto y el panel exige clave y habla con la base.
     ========================================================= */
  const DEMO = ['localhost', '127.0.0.1', '::1'].indexOf(location.hostname) !== -1 ||
               new URLSearchParams(location.search).has('demo');

  /* El ?demo=1 también funciona en el sitio publicado, y es seguro: en este
     modo NADA sale de este archivo. No se llama a la API, no se abre sesión y
     no se toca la base, así que no hay dato real que se pueda filtrar ni cita
     inventada que ocupe un cupo de verdad.

     Se hace así y no sembrando filas de mentira en producción porque el sitio
     ya recibe reservas: una cita falsa bloquearía esa hora para un cliente real
     y ensuciaría la caja y las comisiones. */

  const MUESTRA = (() => {
    const h = ymd(new Date());
    const t = (hh, mm) => new Date(h + 'T' + pad(hh + 5) + ':' + pad(mm) + ':00Z').toISOString();
    return {
      profesionales: [{ id: 1, nombre: 'Emanuel Gómez' }, { id: 2, nombre: 'Jeronimo Garcia' },
                      { id: 3, nombre: 'Valentina Romero' }],
      citas: [
        { id: 1, codigo: 'AB3K7P', inicio: t(9, 0),   fin: t(10, 0),  estado: 'cumplida',   total: 45000, cobrado: 45000, metodo_pago: 'efectivo',      cliente: 'Andrés Mejía',   telefono: '+573001112233', profesional_id: 1, profesional: 'Emanuel Gómez',    servicios: 'Corte VIP' },
        { id: 2, codigo: 'CD8M2Q', inicio: t(10, 30), fin: t(12, 0),  estado: 'confirmada', total: 60000, cliente: 'Santiago Ruiz',  telefono: '+573004445566', profesional_id: 1, profesional: 'Emanuel Gómez',    servicios: 'Corte y Barba VIP' },
        { id: 3, codigo: 'EF4N9R', inicio: t(9, 30),  fin: t(10, 15), estado: 'cumplida',   total: 35000, cobrado: 35000, metodo_pago: 'efectivo',      cliente: 'Camilo Ospina',  telefono: '+573007778899', profesional_id: 2, profesional: 'Jeronimo Garcia',  servicios: 'Corte Sencillo' },
        { id: 4, codigo: 'GH5P1S', inicio: t(11, 0),  fin: t(11, 30), estado: 'no_asistio', total: 26000, cliente: 'Diego Franco',   telefono: '+573001234567', profesional_id: 2, profesional: 'Jeronimo Garcia',  servicios: 'Ritual de Barba' },
        { id: 5, codigo: 'IJ6Q3T', inicio: t(14, 0),  fin: t(16, 0),  estado: 'confirmada', total: 0,     cliente: 'Laura Restrepo', telefono: '+573009998877', profesional_id: 3, profesional: 'Valentina Romero', servicios: 'Manos y pies' },
        { id: 6, codigo: 'KL7R5U', inicio: t(11, 30), fin: t(12, 30), estado: 'cumplida',   total: 65000, cobrado: 65000, metodo_pago: 'transferencia', cliente: 'Mariana Gil',    telefono: '+573002223344', profesional_id: 3, profesional: 'Valentina Romero', servicios: 'Manicura con Base Rubber',
          comprobante: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="%23E4DFD5"/><text x="60" y="58" font-size="13" text-anchor="middle" fill="%239B3040" font-family="sans-serif">Comprobante</text><text x="60" y="76" font-size="11" text-anchor="middle" fill="%230D0D0D" font-family="sans-serif">$65.000</text></svg>'.replace(/%23/g, '#')) }
      ],
      bloqueos: [{ id: 1, profesional_id: null, inicio: t(13, 0), fin: t(14, 0), motivo: 'Almuerzo' }],
      horario: { abre: '09:00', cierra: '20:00', abierto: true },
      servicios: [
        { id: 'corte-sencillo', nombre: 'Corte Sencillo', segmento: 'cortes', precio: 35000, minutos: 45, activo: true, profesionales: [1, 2] },
        { id: 'corte-vip',      nombre: 'Corte VIP',      segmento: 'cortes', precio: 45000, minutos: 60, activo: true, profesionales: [1, 2] },
        { id: 'ritual-barba',   nombre: 'Ritual de Barba', segmento: 'cortes', precio: 26000, minutos: 30, activo: true, profesionales: [1, 2] },
        { id: 'cejas-hilo',     nombre: 'Cejas con hilo', segmento: 'cejas', precio: 20000, minutos: 20, activo: true, profesionales: [1, 2] },
        { id: 'manos-pies',     nombre: 'Manos y pies',   segmento: 'unas', precio: null, minutos: 120, activo: true, profesionales: [3] },
        { id: 'rubber',         nombre: 'Manicura con Base Rubber', segmento: 'unas', precio: 65000, minutos: 60, activo: true, profesionales: [1, 2, 3], descripcion: 'Base rubber: uñas más fuertes y parejas.' },
        { id: 'stiker',       nombre: 'Stiker y pedrería', segmento: 'adicionales', precio: 3000, minutos: 15, activo: true, profesionales: [3], descripcion: 'Apliques para rematar el diseño.', solo_adicional: true }
      ],
      equipo: [
        { id: 1, nombre: 'Emanuel Gómez',    comision: .5, entra: '09:00', sale: '20:00', activo: true,  tiene_clave: true },
        { id: 2, nombre: 'Jeronimo Garcia',  comision: .5, entra: '11:00', sale: '20:00', activo: true,  tiene_clave: false },
        { id: 3, nombre: 'Valentina Romero', comision: .5, entra: '09:00', sale: '18:00', activo: true,  tiene_clave: true }
      ],
      horarioSemana: [0, 1, 2, 3, 4, 5, 6].map(dow => ({
        dow, abre: '09:00', cierra: dow === 6 ? '18:00' : '20:00', abierto: dow !== 0 })),
      clientes: [{ id: 1, nombre: 'Andrés Mejía', telefono: '+573001112233' },
                 { id: 2, nombre: 'Santiago Ruiz', telefono: '+573004445566' }]
    };
  })();

  function demoAgenda() {
    const yo = 1;
    const base = { horario: MUESTRA.horario, bloqueos: MUESTRA.bloqueos };
    if (ROL !== 'profesional') {
      const cob = MUESTRA.citas.filter(c => c.cobrado).reduce((t, c) => t + c.cobrado, 0);
      return Object.assign({ rol: 'dueno', profesionales: MUESTRA.profesionales,
        citas: MUESTRA.citas, resumen: { total: cob, cuantas: MUESTRA.citas.length } }, base);
    }
    /* El profesional ve solo lo suyo: se filtra igual que en el servidor para
       que la demostración no prometa algo que la API no hace. */
    const mias = MUESTRA.citas.filter(c => c.profesional_id === yo);
    const cob = mias.filter(c => c.cobrado).reduce((t, c) => t + c.cobrado, 0);
    return Object.assign({ rol: 'profesional', nombre: 'Emanuel Gómez',
      profesionales: MUESTRA.profesionales.filter(p => p.id === yo), citas: mias,
      resumen: { total: cob, cuantas: mias.length },
      comision: { pct: .5, cobrado: cob, gana: Math.round(cob * .5) } }, base);
  }

  function demoCaja() {
    const cobradas = MUESTRA.citas.filter(c => c.cobrado);
    const total = cobradas.reduce((t, c) => t + c.cobrado, 0);
    const porMetodo = {};
    cobradas.forEach(c => { porMetodo[c.metodo_pago] = (porMetodo[c.metodo_pago] || 0) + c.cobrado; });
    const porProf = {};
    cobradas.forEach(c => {
      const k = c.profesional;
      if (!porProf[k]) porProf[k] = { nombre: k, bruto: 0, comision: .5, pagar: 0, cuantas: 0 };
      porProf[k].bruto += c.cobrado; porProf[k].cuantas += 1;
      porProf[k].pagar = Math.round(porProf[k].bruto * .5);
    });
    return { total, porMetodo, porProfesional: Object.values(porProf),
             cobros: cobradas.map(c => ({ id: c.id, cobrado_en: c.fin, cliente: c.cliente,
               telefono: c.telefono, servicios: c.servicios, profesional: c.profesional,
               metodo_pago: c.metodo_pago, cobrado: c.cobrado, comprobante: c.comprobante || null })) };
  }

  function respuestaDemo(ruta) {
    if (ruta.startsWith('/panel/agenda'))    return demoAgenda();
    if (ruta.startsWith('/panel/caja'))      return demoCaja();
    if (ruta.startsWith('/panel/servicios')) return { servicios: MUESTRA.servicios };
    if (ruta.startsWith('/panel/clientes'))  return { clientes: MUESTRA.clientes };
    if (ruta.startsWith('/panel/ajustes'))   return { servicios: MUESTRA.servicios,
                                                      horario: MUESTRA.horarioSemana, equipo: MUESTRA.equipo };
    if (ruta.startsWith('/panel/entrar'))    return { rol: ROL, nombre: 'Emanuel Gómez' };
    return { ok: true };   // crear, cobrar, mover, bloquear: se aceptan sin guardar
  }

  const SIN_API = 'El panel necesita el sitio publicado. En local no se ejecutan las funciones del servidor.';

  async function api(ruta, opciones) {
    if (DEMO) { await new Promise(r => setTimeout(r, 90)); return respuestaDemo(ruta); }
    let r;
    try { r = await fetch('/api' + ruta, opciones); }
    catch (e) { throw Object.assign(new Error('Sin conexión.'), { estado: 0 }); }
    let cuerpo = null;
    try { cuerpo = await r.json(); } catch (e) { /* no era JSON */ }
    if (!r.ok) {
      /* Un 404 sin cuerpo JSON no es «no encontrado»: es que la ruta ni
         siquiera se está ejecutando. */
      const msg = (cuerpo && cuerpo.error) || (r.status === 404 ? SIN_API : 'Error ' + r.status);
      throw Object.assign(new Error(msg), { estado: r.status });
    }
    return cuerpo;
  }

  /* ---------- avisos ---------- */
  let tAviso = null;
  /* `deshacer` es la función que revierte lo hecho. Se ofrece durante unos
     segundos en vez de preguntar «¿seguro?» antes: confirmar cada acción
     estorba cincuenta veces al día para evitar un error que pasa una vez, y
     deshacer arregla ese error sin molestar en los otros cuarenta y nueve. */
  function avisar(texto, deshacer) {
    const n = $('#aviso');
    n.textContent = '';
    n.appendChild(document.createTextNode(texto));
    if (deshacer) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Deshacer';
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { await deshacer(); n.hidden = true; }
        catch (e) { avisar(e.message || 'No se pudo deshacer'); }
      });
      n.appendChild(b);
    }
    n.hidden = false;
    clearTimeout(tAviso);
    tAviso = setTimeout(() => { n.hidden = true; }, deshacer ? 8000 : 4200);
  }

  /* =========================================================
     Entrada
     ========================================================= */
  $('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#login-error');
    err.hidden = true;
    try {
      const r = await api('/panel/entrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: $('#clave').value })
      });
      ROL = r.rol || 'dueno';
      YO = { nombre: r.nombre || 'Administrador', profId: r.profId || null };
      $('#clave').value = '';
      abrir();
    } catch (e2) {
      err.textContent = e2.message || 'No se pudo entrar';
      err.hidden = false;
    }
  });

  function abrir() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#yo-nombre').textContent = YO.nombre;
    $('#yo-rol').textContent = ROL === 'dueno' ? 'Administrador' : 'Profesional';
    $('#yo-inicial').textContent = inicial(YO.nombre);
    $('#conmutador').hidden = ROL !== 'dueno';
    pintarNav();
    irA(ROL === 'dueno' ? 'agenda' : 'midia');
  }

  $('#salir').addEventListener('click', async () => {
    await api('/panel/entrar', { method: 'DELETE' }).catch(() => {});
    location.reload();
  });

  /* =========================================================
     Navegación
     ========================================================= */
  const TABS_DUENO = [['agenda', 'Agenda'], ['facturas', 'Facturas'],
                      ['servicios', 'Servicios'], ['dispo', 'Disponibilidad']];
  const TABS_PROF  = [['midia', 'Mi día']];

  function pintarNav() {
    const nav = $('#nav');
    nav.textContent = '';
    (ROL === 'dueno' ? TABS_DUENO : TABS_PROF).forEach(([id, nombre]) => {
      const b = el('button', 'barra__tab');
      b.type = 'button'; b.dataset.ir = id; b.textContent = nombre;
      b.addEventListener('click', () => irA(id));
      nav.appendChild(b);
    });
  }

  function irA(cual) {
    vista = cual;
    ['agenda', 'midia', 'facturas', 'servicios', 'dispo'].forEach(v => {
      const n = $('#v-' + v); if (n) n.hidden = v !== cual;
    });
    $$('.barra__tab').forEach(b => b.classList.toggle('is-on', b.dataset.ir === cual));
    /* El contexto —periodo, día y equipo— se comparte entre agenda y facturas
       porque hablan del mismo día: duplicarlo obligaba a recordar en cuál de
       las dos se había cambiado la fecha. */
    const conContexto = cual === 'agenda' || cual === 'facturas';
    $('#contexto').hidden = !conContexto;
    $('#periodos').hidden = cual !== 'facturas';   // la agenda es siempre de un día
    $('#abrir-crear').hidden = cual !== 'agenda';
    $('#fichas').hidden = cual !== 'agenda';
    cerrarFicha();
    if (cual === 'agenda' || cual === 'midia') cargarDia();
    if (cual === 'facturas')  cargarFacturas();
    if (cual === 'servicios' || cual === 'dispo') cargarAjustes();
  }

  /* Rango que cubre el periodo elegido, terminando en el día que se mira. */
  function rango() {
    const fin = new Date(dia), ini = new Date(dia);
    if (periodo === 'semana')        ini.setDate(ini.getDate() - 6);
    else if (periodo === 'quincena') ini.setDate(ini.getDate() - 14);
    else if (periodo === 'mes')      ini.setMonth(ini.getMonth() - 1);
    else if (periodo === 'ano')      ini.setFullYear(ini.getFullYear() - 1);
    return { desde: ymd(ini), hasta: ymd(fin) };
  }
  const NOMBRE_PERIODO = { dia: 'hoy', semana: 'últimos 7 días', quincena: 'últimos 15 días',
                           mes: 'último mes', ano: 'último año' };

  function pintarPeriodos() {
    const c = $('#periodos');
    c.textContent = '';
    PERIODOS.forEach(([id, nombre]) => {
      const b = el('button', 'periodo' + (id === periodo ? ' is-on' : ''));
      b.type = 'button'; b.textContent = nombre;
      b.addEventListener('click', () => { periodo = id; pintarPeriodos(); cargarFacturas(); });
      c.appendChild(b);
    });
  }

  /* =========================================================
     Día
     ========================================================= */
  const hora = iso => new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(iso));

  /* Minutos desde medianoche en hora de Bogotá. La aritmética de la rejilla va
     en hora del local, no del navegador: si el dueño abre el panel desde otro
     país, las citas se siguen dibujando donde corresponde. */
  const minLocal = iso => { const [h, m] = hora(iso).split(':').map(Number); return h * 60 + m; };
  const aMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const aHHMM = m => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);

  /* Estado que se muestra, que no es el mismo que el guardado: una cita
     confirmada cuya hora ya pasó es «falta cobrar», y eso es justo lo que el
     local necesita ver de un vistazo al cerrar el día. */
  function estadoVisual(c) {
    if (c.estado === 'cumplida')   return 'cobrada';
    if (c.estado === 'no_asistio') return 'no_asistio';
    if (c.estado === 'cancelada')  return 'cancelada';
    return new Date(c.fin) < new Date() ? 'porcobrar' : 'confirmada';
  }
  const ETIQUETA = { cobrada: 'Cobrada', porcobrar: 'Falta cobrar', confirmada: 'Confirmada',
                     no_asistio: 'No vino', cancelada: 'Cancelada' };

  function pintarTira(contenedor, cuantos) {
    const c = $(contenedor);
    if (!c) return;
    c.textContent = '';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    for (let i = -Math.floor(cuantos / 3); i < cuantos - Math.floor(cuantos / 3); i++) {
      const d = new Date(hoy); d.setDate(d.getDate() + i);
      const b = el('button', 'dia' + (ymd(d) === ymd(dia) ? ' is-on' : ''));
      b.type = 'button';
      const s = el('strong'); s.textContent = d.getDate() + ' ' + MESES3[d.getMonth()];
      const p = el('span');
      p.textContent = i === 0 ? 'Hoy' : DIAS3[d.getDay()];
      b.append(s, p);
      b.addEventListener('click', () => { dia = new Date(d); cargarDia(); });
      c.appendChild(b);
    }
  }

  $('#dia-ant').addEventListener('click', () => { dia.setDate(dia.getDate() - 1); cargarDia(); });
  $('#dia-sig').addEventListener('click', () => { dia.setDate(dia.getDate() + 1); cargarDia(); });
  $('#ir-hoy').addEventListener('click', () => { dia = new Date(); cargarDia(); });
  $('#dia-picker').addEventListener('change', e => {
    if (!e.target.value) return;
    /* Se construye con partes y no con new Date(cadena): interpretar
       «2026-08-14» como UTC adelanta un día en Colombia. */
    const [y, m, d2] = e.target.value.split('-').map(Number);
    dia = new Date(y, m - 1, d2);
    cargarDia();
  });

  function esqueletos() {
    const g = $('#rejilla');
    if (!g || !g.children.length) return;
    g.textContent = '';
    g.style.setProperty('--cols', 3);
    for (let f = 0; f < 12; f++) for (let c = 0; c < 3; c++) {
      const e = el('div', 'esqueleto');
      e.style.gridRow = String(f + 1); e.style.gridColumn = String(c + 2);
      g.appendChild(e);
    }
  }

  async function cargarDia() {
    $('#dia-picker').value = ymd(dia);
    pintarTira('#tira', 9);
    pintarTira('#tira-corta', 5);
    esqueletos();
    try {
      datos = await api('/panel/agenda?fecha=' + ymd(dia));
      if (datos.rol) ROL = datos.rol;
      if (datos.nombre) { YO.nombre = datos.nombre; $('#yo-nombre').textContent = datos.nombre;
                          $('#yo-inicial').textContent = inicial(datos.nombre); }
      if (ROL === 'profesional') pintarMiDia();
      else if (revisando) { avisoRevision(); pintarMiDia(); }
      else pintarAgenda();
    } catch (e) {
      if (e.estado === 401) { $('#app').hidden = true; $('#login').hidden = false; return; }
      avisar(e.message || 'No se pudo cargar la agenda.');
    }
  }

  /* =========================================================
     Agenda (administrador)
     ========================================================= */
  function pintarAgenda() {
    pintarFichas();
    pintarResumen();
    pintarRejilla();
    pintarLista();
  }

  function columnas() {
    const p = datos.profesionales || [];
    return profFiltro === 'todos' ? p : p.filter(x => String(x.id) === String(profFiltro));
  }

  function pintarFichas() {
    const c = $('#fichas');
    c.textContent = '';
    const mk = (id, nombre, detalle) => {
      const b = el('button', 'ficha-prof' + (String(profFiltro) === String(id) ? ' is-on' : ''));
      b.type = 'button';
      const i = el('span', 'ficha-prof__ini'); i.textContent = id === 'todos' ? '★' : inicial(nombre);
      const t = el('span');
      const n = el('span', 'ficha-prof__n'); n.textContent = nombre;
      const d = el('span', 'ficha-prof__d'); d.textContent = detalle;
      t.append(n, d);
      b.append(i, t);
      b.addEventListener('click', () => { profFiltro = id; pintarAgenda(); });
      return b;
    };
    const total = (datos.citas || []).filter(x => x.estado !== 'cancelada').length;
    c.appendChild(mk('todos', 'Todo el equipo', total + (total === 1 ? ' cita' : ' citas')));
    (datos.profesionales || []).forEach(p => {
      const n = (datos.citas || []).filter(x => x.profesional_id === p.id && x.estado !== 'cancelada').length;
      c.appendChild(mk(p.id, p.nombre, n ? n + (n === 1 ? ' cita' : ' citas') : 'libre'));
    });
  }

  function pintarResumen() {
    const cols = columnas();
    const citas = (datos.citas || []).filter(c => c.estado !== 'cancelada' &&
      (profFiltro === 'todos' || String(c.profesional_id) === String(profFiltro)));

    const abre = aMin(datos.horario.abre);
    let cierra = aMin(datos.horario.cierra);
    if (cierra <= abre) cierra += 1440;
    /* Ocupación sobre la jornada abierta y por el número de columnas visibles:
       medir contra veinticuatro horas o contra un solo profesional daría cifras
       que no significan nada. */
    const capacidad = Math.max(1, (cierra - abre) * Math.max(1, cols.length));
    const ocupado = citas.reduce((t, c) => t + (minLocal(c.fin) - minLocal(c.inicio)), 0);
    const pct = Math.min(100, Math.round(ocupado / capacidad * 100));
    $('#ocupacion-pct').textContent = pct + '%';
    $('#anillo').setAttribute('stroke-dashoffset', String(339 - 339 * pct / 100));

    const ahora = new Date();
    const prox = citas.filter(c => new Date(c.fin) > ahora && c.estado === 'confirmada')
                      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0];
    $('#prox-nombre').textContent = prox ? prox.cliente : 'Nada pendiente';
    if (prox) {
      /* Los minutos que faltan responden la pregunta real —«¿me da tiempo de
         salir?»— que una hora suelta obliga a calcular de cabeza. */
      const faltan = Math.round((new Date(prox.inicio) - ahora) / 60000);
      const cuando = faltan <= 0 ? 'ahora mismo'
                   : faltan < 60 ? 'en ' + faltan + ' min'
                   : 'en ' + Math.floor(faltan / 60) + ' h ' + (faltan % 60) + ' min';
      $('#prox-detalle').textContent = hora(prox.inicio) + ' · ' + cuando + ' · ' +
                                       (prox.servicios || '—') + ' · ' + prox.profesional;
    } else {
      $('#prox-detalle').textContent = 'No quedan citas por atender hoy.';
    }

    const caja = citas.reduce((t, c) => t + (c.cobrado || 0), 0);
    $('#caja-texto').textContent = money(caja);
    $('#caja-barra').style.width = Math.min(100, caja / META_LOCAL * 100) + '%';

    /* Cuántos huecos de media hora quedan libres hoy. Junto a lo que falta para
       la meta dice si es alcanzable o si ya no dan las horas. */
    let huecos = 0;
    cols.forEach(p => {
      const suyas = citas.filter(c => c.profesional_id === p.id)
                         .map(c => [minLocal(c.inicio), minLocal(c.fin)]).sort((a, b) => a[0] - b[0]);
      let cur = Math.max(abre, minLocal(new Date().toISOString()));
      if (ymd(new Date()) !== ymd(dia)) cur = abre;
      suyas.forEach(([a, b]) => { if (a - cur >= 30) huecos += Math.floor((a - cur) / 30); cur = Math.max(cur, b); });
      if (cierra - cur >= 30) huecos += Math.floor((cierra - cur) / 30);
    });
    const sufijo = huecos ? ' · ' + huecos + (huecos === 1 ? ' hueco libre' : ' huecos libres') : ' · sin huecos';
    $('#meta-texto').textContent = (caja >= META_LOCAL
      ? 'Meta cumplida' : 'Faltan ' + money(META_LOCAL - caja) + ' para la meta') + sufijo;
  }

  let arrastrando = null;

  function pintarRejilla() {
    const g = $('#rejilla');
    g.textContent = '';
    const profs = columnas();
    if (!profs.length) return;

    const abre = aMin(datos.horario.abre);
    let cierra = aMin(datos.horario.cierra);
    if (cierra <= abre) cierra += 1440;        // cierre pasada la medianoche
    const filas = Math.ceil((cierra - abre) / FILA);
    g.style.setProperty('--cols', profs.length);

    /* La rejilla se coloca en pasos de FILA, pero los bloques pueden empezar en
       cualquier cuarto de hora. Se convierte a fracción de fila para que una
       cita de 09:15 no se dibuje pegada a las 09:00. */
    const aFila = min => (min - abre) / FILA;

    g.appendChild(el('div', 'rej__cab rej__cab--esq'));
    profs.forEach(p => {
      const c = el('div', 'rej__cab');
      c.textContent = p.nombre.split(' ')[0];
      const s2 = el('small');
      const suyas = (datos.citas || []).filter(x => x.profesional_id === p.id && x.estado !== 'cancelada');
      const min = suyas.reduce((t, x) => t + (minLocal(x.fin) - minLocal(x.inicio)), 0);
      const pct = Math.min(100, Math.round(min / Math.max(1, cierra - abre) * 100));
      s2.textContent = suyas.length
        ? suyas.length + (suyas.length === 1 ? ' cita · ' : ' citas · ') + pct + '%'
        : 'libre';
      c.appendChild(s2);
      /* Barra de ocupación bajo cada nombre: de un vistazo se ve quién está
         cargado y quién tiene la mañana muerta. */
      const barra = el('div', 'rej__ocup'); const dentro = el('div');
      dentro.style.width = pct + '%';
      barra.appendChild(dentro);
      c.appendChild(barra);
      g.appendChild(c);
    });

    const ocupadas = {};
    for (let f = 0; f < filas; f++) {
      const min = abre + f * FILA, pt = min % 60 === 0;
      const h = el('div', 'rej__hora' + (pt ? ' rej__hora--pt' : ''));
      h.style.gridRow = String(f + 2);
      const sp = el('span'); sp.textContent = aHHMM(min);
      h.appendChild(sp);
      g.appendChild(h);

      profs.forEach((p, i) => {
        const c = el('div', 'rej__celda' + (pt ? ' rej__celda--pt' : ''));
        c.style.gridRow = String(f + 2);
        c.style.gridColumn = String(i + 2);
        const hhmm = aHHMM(min);
        c.addEventListener('click', () => abrirCrear(p.id, hhmm));
        c.addEventListener('dragover', ev => { if (arrastrando) { ev.preventDefault(); c.classList.add('destino'); } });
        c.addEventListener('dragleave', () => c.classList.remove('destino'));
        c.addEventListener('drop', ev => {
          ev.preventDefault(); c.classList.remove('destino');
          if (arrastrando) mover(arrastrando.id, hhmm, p.id);
        });
        g.appendChild(c);
      });
    }

    /* Franja de lo que ya pasó, por debajo de todo. */
    const esHoy = ymd(new Date()) === ymd(dia);
    if (esHoy) {
      const m = minLocal(new Date().toISOString());
      if (m > abre) {
        const p = el('div', 'pasado');
        p.style.gridRow = '2 / span ' + Math.max(1, Math.round(aFila(Math.min(m, cierra))));
        g.appendChild(p);
      }
    }

    const ahora = new Date();
    (datos.citas || []).forEach(c => {
      const col = profs.findIndex(p => p.id === c.profesional_id);
      if (col === -1) return;
      const ini = minLocal(c.inicio), fin = minLocal(c.fin);
      const desde = Math.round(aFila(ini) * 2) / 2;            // media fila de resolución
      const span = Math.max(1, Math.round((fin - ini) / FILA));
      (ocupadas[col] = ocupadas[col] || []).push([Math.floor(desde), Math.floor(desde) + span]);

      const ev = estadoVisual(c);
      const compacto = span <= 1;
      const b = el('button', 'bloque bloque--' + ev + (compacto ? ' bloque--compacto' : '') +
                             (new Date(c.fin) < ahora ? ' bloque--pasada' : ''));
      b.type = 'button';
      b.style.gridColumn = String(col + 2);
      b.style.gridRow = (Math.floor(desde) + 2) + ' / span ' + span;

      const top = el('div', 'bloque__top');
      /* El punto va pegado al nombre, no suelto en la fila: con space-between
         entre tres hijos el nombre acababa flotando en el centro. */
      const izq = el('span', 'bloque__quien');
      if (ev === 'porcobrar') izq.appendChild(el('i', 'punto-cobrar'));
      const n = el('strong'); n.textContent = c.cliente;
      izq.appendChild(n);
      const v = el('span'); v.textContent = money(c.cobrado || c.total);
      top.append(izq, v);
      b.appendChild(top);
      /* Un bloque de media hora no da para tres líneas: queda el cliente y el
         valor, y el resto se lee en la ficha al tocarlo. */
      if (!compacto) {
        const s2 = el('em'); s2.textContent = c.servicios || '—';
        b.appendChild(s2);
        if (span >= 3) {
          const pie = el('span', 'bloque__pie');
          pie.textContent = ETIQUETA[ev];
          pie.style.fontSize = '10px'; pie.style.color = 'var(--tenue)';
          b.appendChild(pie);
        }
      }
      b.title = hora(c.inicio) + '–' + hora(c.fin) + ' · ' + c.cliente + ' · ' +
                (c.servicios || '—') + ' · ' + ETIQUETA[ev];
      b.addEventListener('click', () => abrirFicha(c));
      if (c.estado === 'confirmada') {
        b.draggable = true;
        b.addEventListener('dragstart', e2 => {
          arrastrando = c; b.classList.add('arrastrando');
          e2.dataTransfer.effectAllowed = 'move';
          e2.dataTransfer.setData('text/plain', String(c.id));
        });
        b.addEventListener('dragend', () => { arrastrando = null; b.classList.remove('arrastrando'); });
      }
      g.appendChild(b);
    });

    (datos.bloqueos || []).forEach(bq => {
      const ini = minLocal(bq.inicio), fin = minLocal(bq.fin);
      const cols = bq.profesional_id === null
        ? profs.map((_, i) => i)
        : [profs.findIndex(p => p.id === bq.profesional_id)].filter(i => i !== -1);
      cols.forEach(i => {
        const desde = Math.floor(aFila(ini)), span = Math.max(1, Math.round((fin - ini) / FILA));
        (ocupadas[i] = ocupadas[i] || []).push([desde, desde + span]);
        const b = el('div', 'bloque bloque--bloqueo');
        b.style.gridColumn = String(i + 2);
        b.style.gridRow = (desde + 2) + ' / span ' + span;
        b.textContent = bq.motivo || 'Bloqueado';
        g.appendChild(b);
      });
    });

    /* Huecos de media hora o más: son los que de verdad se pueden vender. */
    profs.forEach((p, i) => {
      const rangos = (ocupadas[i] || []).sort((a, b) => a[0] - b[0]);
      let cursor = 0;
      const marcar = (a, b) => {
        if (b - a < 1) return;
        const hueco = el('div', 'hueco');
        hueco.style.gridColumn = String(i + 2);
        hueco.style.gridRow = (a + 2) + ' / span ' + (b - a);
        hueco.textContent = '＋ ' + aHHMM(abre + a * FILA);
        hueco.addEventListener('click', () => abrirCrear(p.id, aHHMM(abre + a * FILA)));
        g.appendChild(hueco);
      };
      rangos.forEach(([a, b]) => { marcar(cursor, a); cursor = Math.max(cursor, b); });
      marcar(cursor, filas);
    });

    if (esHoy) {
      const m = minLocal(new Date().toISOString());
      if (m >= abre && m <= cierra) {
        const l = el('div', 'ahora');
        l.style.gridRow = String(Math.round(aFila(m)) + 2);
        g.appendChild(l);
      }
    }
  }

  function pintarLista() {
    const lista = $('#lista');
    lista.textContent = '';
    const citas = (datos.citas || []).filter(c =>
      profFiltro === 'todos' || String(c.profesional_id) === String(profFiltro));
    const filas = [
      ...citas.map(c => ({ t: new Date(c.inicio).getTime(), tipo: 'cita', d: c })),
      ...(datos.bloqueos || []).map(b => ({ t: new Date(b.inicio).getTime(), tipo: 'bq', d: b }))
    ].sort((a, b) => a.t - b.t);

    if (!filas.length) {
      const v = el('div', 'vacio');
      const s = el('strong'); s.textContent = datos.horario.abierto ? 'Sin citas' : 'Día cerrado';
      const p = el('span'); p.textContent = datos.horario.abierto
        ? 'Ninguna cita este día.' : 'El local no abre este día.';
      v.append(s, p);
      lista.appendChild(v);
      return;
    }
    filas.forEach(f => lista.appendChild(f.tipo === 'cita' ? tarjeta(f.d) : filaBloqueo(f.d)));
  }

  function tarjeta(c) {
    const ev = estadoVisual(c);
    const n = el('article', 'cita cita--' + ev);
    const cab = el('div', 'cita__cab');
    const h = el('span', 'cita__hora'); h.textContent = hora(c.inicio) + '–' + hora(c.fin);
    const pr = el('span', 'cita__prof'); pr.textContent = c.profesional;
    cab.append(h, pr);
    const cli = el('div', 'cita__cliente'); cli.textContent = c.cliente;
    const sv = el('div', 'cita__serv'); sv.textContent = c.servicios || '—';
    const pie = el('div', 'cita__pie');
    const to = el('span', 'cita__total'); to.textContent = money(c.cobrado || c.total);
    const es = el('span', 'cita__estado'); es.textContent = ETIQUETA[ev];
    pie.append(to, es, acciones(c));
    n.append(cab, cli, sv, pie);
    return n;
  }

  function filaBloqueo(b) {
    const n = el('div', 'bloqueo-fila');
    const t = el('span');
    t.textContent = hora(b.inicio) + '–' + hora(b.fin) + ' · ' + (b.motivo || 'Bloqueado');
    n.appendChild(t);
    const q = el('button', 'bt bt--mini');
    q.type = 'button'; q.textContent = 'Quitar'; q.style.marginLeft = 'auto';
    q.addEventListener('click', async () => {
      await api('/panel/bloqueo?id=' + b.id, { method: 'DELETE' }).catch(() => {});
      avisar('Bloqueo quitado'); cargarDia();
    });
    n.appendChild(q);
    return n;
  }

  /* =========================================================
     Acciones sobre una cita
     ========================================================= */
  function acciones(c) {
    const cont = el('div', 'actual__btns');
    const ev = estadoVisual(c);

    const wa = el('a', 'bt');
    wa.href = 'https://wa.me/' + String(c.telefono || '').replace(/\D/g, '') +
              '?text=' + encodeURIComponent(mensaje(c));
    wa.target = '_blank'; wa.rel = 'noopener noreferrer'; wa.textContent = 'WhatsApp';
    cont.appendChild(wa);

    if (ev === 'confirmada' || ev === 'porcobrar') {
      cont.appendChild(boton('Cobrar', () => abrirCobro(c), true));
      cont.appendChild(boton('No vino', () =>
        cambiar(c.id, 'no_asistio', c.cliente + ' marcado como que no vino', c.estado)));
      cont.appendChild(boton('Cancelar', () =>
        cambiar(c.id, 'cancelada', 'Cita de ' + c.cliente + ' cancelada · la hora queda libre', c.estado)));
    } else {
      cont.appendChild(boton('Reabrir', () => cambiar(c.id, 'confirmada', 'Cita reabierta', c.estado)));
    }
    return cont;
  }

  function mensaje(c) {
    return '¡Hola ' + c.cliente + '! Te recordamos tu cita en El Imperio el ' +
           DIAS[new Date(c.inicio).getDay()].toLowerCase() + ' a las ' + hora(c.inicio) +
           ' con ' + c.profesional + '. Código: ' + c.codigo + '. ¿Nos confirmas?';
  }

  function boton(texto, fn, destacado) {
    const b = el('button', 'bt' + (destacado ? ' bt--vino' : ''));
    b.type = 'button'; b.textContent = texto;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await fn(); } finally { b.disabled = false; }
    });
    return b;
  }

  async function cambiar(id, estado, textoAviso, estadoPrevio) {
    try {
      await api('/panel/cita', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({ id, estado }) });
      cerrarFicha();
      /* Se guarda el estado anterior para poder volver con la llamada inversa,
         que es el mismo endpoint con el valor de antes. */
      avisar(textoAviso || 'Cita actualizada', estadoPrevio ? async () => {
        await api('/panel/cita', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify({ id, estado: estadoPrevio }) });
        avisar('Deshecho'); cargarDia();
      } : null);
      cargarDia();
    } catch (e) { avisar(e.message || 'No se pudo actualizar'); }
  }

  async function mover(id, hhmm, profId) {
    try {
      await api('/panel/mover', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id, fecha: ymd(dia), hora: hhmm, profesional: profId }) });
      avisar('Cita movida a las ' + hhmm); cargarDia();
    } catch (e) { avisar(e.message || 'No se pudo mover'); cargarDia(); }
  }

  /* ---------- ficha ---------- */
  function abrirFicha(c) {
    $('#ficha-cliente').textContent = c.cliente;
    $('#ficha-cuando').textContent = hora(c.inicio) + '–' + hora(c.fin) + ' · ' +
      c.profesional + ' · ' + ETIQUETA[estadoVisual(c)];
    $('#ficha-tel').textContent = c.telefono || 'Sin celular';
    $('#ficha-serv').textContent = c.servicios || '—';
    $('#ficha-total').textContent = money(c.cobrado || c.total);
    const b = $('#ficha-btns'); b.textContent = ''; b.appendChild(acciones(c));
    $('#ficha').hidden = false;
  }
  function cerrarFicha() { $('#ficha').hidden = true; }
  $('#ficha-cerrar').addEventListener('click', cerrarFicha);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarFicha(); });

  /* =========================================================
     Mi día
     ========================================================= */
  function pintarMiDia() {
    /* Cuando es el dueño revisando, se filtra aquí lo del profesional elegido.
       Puede hacerlo porque la API ya le entrega todo el equipo: no se está
       saltando ningún permiso, solo mirando un subconjunto de lo suyo. */
    const dePersona = revisando
      ? (datos.profesionales || []).find(p => p.id === revisando)
      : null;
    $('#mi-titulo').textContent = 'Mi día · ' + DIAS[dia.getDay()] + ' ' + dia.getDate();
    $('#mi-nombre').textContent = dePersona ? dePersona.nombre : YO.nombre;

    const citas = (datos.citas || [])
      .filter(c => c.estado !== 'cancelada')
      .filter(c => !revisando || c.profesional_id === revisando);

    const cobrado = citas.reduce((t, c) => t + (c.cobrado || 0), 0);
    $('#mi-comision').textContent = money(revisando ? Math.round(cobrado * 0.5)
      : (datos.comision ? datos.comision.gana : 0));
    $('#mi-atendidas').textContent = citas.filter(c => c.estado === 'cumplida').length;

    const abre = aMin(datos.horario.abre);
    let cierra = aMin(datos.horario.cierra);
    if (cierra <= abre) cierra += 1440;
    const jornada = Math.max(1, cierra - abre);
    const ocupado = citas.reduce((t, c) => t + (minLocal(c.fin) - minLocal(c.inicio)), 0);
    $('#mi-ocupado').textContent = Math.round(ocupado / jornada * 100) + '%';

    /* Huecos aprovechables: media hora libre entre citas. Contar cada rendija
       de quince minutos daría un número grande y falso. */
    const rangos = citas.map(c => [minLocal(c.inicio), minLocal(c.fin)]).sort((a, b) => a[0] - b[0]);
    let cursor = abre, huecos = 0;
    rangos.forEach(([a, b]) => { if (a - cursor >= 30) huecos++; cursor = Math.max(cursor, b); });
    if (cierra - cursor >= 30) huecos++;
    $('#mi-huecos').textContent = huecos;

    const ahora = new Date();
    const pend = citas.filter(c => c.estado === 'confirmada' && new Date(c.fin) > ahora)
                      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    const act = pend[0];
    $('#actual').hidden = !act;
    $('#sin-actual').hidden = !!act;
    if (act) {
      $('#actual-estado').textContent = new Date(act.inicio) <= ahora ? 'En curso' : 'Sigue · ' + hora(act.inicio);
      $('#actual-cliente').textContent = act.cliente;
      $('#actual-serv').textContent = act.servicios || '—';
      $('#actual-valor').textContent = money(act.total);
      $('#actual-tel').textContent = act.telefono || 'Sin celular';
      const b = $('#actual-btns'); b.textContent = ''; b.appendChild(acciones(act));
    }

    const sig = $('#despues-lista');
    sig.textContent = '';
    pend.slice(1).forEach(c => {
      const f = el('div', 'sig');
      const h = el('span', 'sig__h'); h.textContent = hora(c.inicio);
      const q = el('span', 'sig__q');
      const n = el('strong'); n.textContent = c.cliente;
      const s = el('span'); s.textContent = c.servicios || '—';
      q.append(n, s);
      const v = el('span', 'sig__v'); v.textContent = money(c.total);
      f.append(h, q, v);
      f.addEventListener('click', () => abrirFicha(c));
      sig.appendChild(f);
    });
    if (!pend.slice(1).length) {
      const p = el('p', 'nota'); p.textContent = 'No hay más citas después de esta.';
      sig.appendChild(p);
    }
  }

  $('#mi-crear').addEventListener('click', () => {
    const m = Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / PASO) * PASO;
    abrirCrear(YO.profId, aHHMM(m));
  });
  $('#mi-bloquear').addEventListener('click', () => abrirBloqueo());

  /* ---------- el dueño mirando «Mi día» ----------
     Es una ayuda de revisión: sirve para ver lo que ve un profesional en su
     celular antes de darle la clave. Va en solo lectura porque las acciones de
     esa pantalla las rechazaría la API para el dueño de todos modos, y ofrecer
     botones que van a fallar es peor que no ofrecerlos. */
  $$('.conmutador__b').forEach(b => b.addEventListener('click', () => {
    $$('.conmutador__b').forEach(x => x.classList.toggle('is-on', x === b));
    if (b.dataset.ver === 'dueno') {
      revisando = null;
      document.body.classList.remove('solo-lectura');
      irA('agenda');
    } else {
      const primero = (datos.profesionales || [])[0];
      revisando = primero ? primero.id : null;
      document.body.classList.add('solo-lectura');
      irA('midia');
    }
  }));

  function avisoRevision() {
    const midia = $('#v-midia');
    let n = midia.querySelector('.revision');
    if (!n) {
      n = el('div', 'revision');
      midia.insertBefore(n, midia.firstChild);
    }
    n.textContent = 'Estás viendo el panel de ';
    const sel = document.createElement('select');
    (datos.profesionales || []).forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.nombre;
      sel.appendChild(o);
    });
    sel.value = String(revisando);
    sel.addEventListener('change', () => { revisando = Number(sel.value); cargarDia(); });
    n.appendChild(sel);
    n.appendChild(document.createTextNode(' · solo lectura'));
  }

  /* =========================================================
     Facturas
     ========================================================= */
  let fFiltro = 'todas', fOrden = 'reciente', fBusca = '';
  const FILTROS = [['todas', 'Sin filtro'], ['efectivo', 'Efectivo'],
                   ['transferencia', 'Transferencia'], ['tarjeta', 'Tarjeta']];
  const ORDENES = [['reciente', 'Más reciente'], ['antiguo', 'Más antiguo'],
                   ['mayor', 'Mayor valor'], ['menor', 'Menor valor']];
  let caja = null;

  function opciones(cont, lista, actual, alElegir) {
    const c = $(cont);
    c.textContent = '';
    lista.forEach(([id, nombre]) => {
      const b = el('button', 'opcion' + (id === actual ? ' is-on' : ''));
      b.type = 'button';
      b.appendChild(el('i'));
      b.appendChild(document.createTextNode(nombre));
      b.addEventListener('click', () => { alElegir(id); });
      c.appendChild(b);
    });
  }

  async function cargarFacturas() {
    pintarPeriodos();
    opciones('#f-filtros', FILTROS, fFiltro, id => { fFiltro = id; cargarFacturas(); });
    opciones('#f-ordenes', ORDENES, fOrden, id => { fOrden = id; cargarFacturas(); });
    try {
      const r = rango();
      caja = await api('/panel/caja?desde=' + r.desde + '&hasta=' + r.hasta);
      pintarFacturas();
    } catch (e) {
      $('#f-lista').textContent = e.message || 'No se pudo cargar.';
    }
  }

  function pintarFacturas() {
    if (!caja) return;
    let filas = (caja.cobros || []).slice();
    if (fFiltro !== 'todas') filas = filas.filter(f => f.metodo_pago === fFiltro);
    if (fBusca) {
      const q = fBusca.replace(/\D/g, '');
      filas = filas.filter(f => String(f.telefono || '').replace(/\D/g, '').includes(q) ||
                                String(f.cliente || '').toLowerCase().includes(fBusca.toLowerCase()));
    }
    filas.sort((a, b) => fOrden === 'reciente' ? new Date(b.cobrado_en) - new Date(a.cobrado_en)
                       : fOrden === 'antiguo'  ? new Date(a.cobrado_en) - new Date(b.cobrado_en)
                       : fOrden === 'mayor'    ? b.cobrado - a.cobrado
                                               : a.cobrado - b.cobrado);

    const suma = filas.reduce((t, f) => t + (f.cobrado || 0), 0);
    $('#f-resumen').textContent = filas.length
      ? filas.length + (filas.length === 1 ? ' factura · ' : ' facturas · ') + money(suma)
      : 'Sin resultados';
    $('#f-limpiar').hidden = !fBusca;
    const cn = $('#f-conteo');
    cn.hidden = !fBusca;
    cn.textContent = filas.length + (filas.length === 1 ? ' resultado' : ' resultados');

    /* Sugerencias: los clientes distintos que coinciden. Tocar uno rellena el
       campo con su teléfono exacto, que es lo que de verdad se buscaba cuando
       se teclean tres dígitos sueltos. */
    const sug = $('#f-sugerencias');
    sug.textContent = '';
    if (fBusca) {
      const vistos = {};
      (caja.cobros || []).forEach(f => {
        const tel = String(f.telefono || '').replace(/\D/g, '');
        const q = fBusca.replace(/\D/g, '');
        const coincide = (q && tel.includes(q)) ||
                         String(f.cliente || '').toLowerCase().includes(fBusca.toLowerCase());
        if (coincide && f.telefono && !vistos[f.telefono]) vistos[f.telefono] = f.cliente;
      });
      const claves = Object.keys(vistos);
      sug.hidden = !claves.length;
      claves.slice(0, 6).forEach(tel => {
        const b = el('button', 'sugerencia');
        b.type = 'button';
        const n = el('strong'); n.textContent = vistos[tel];
        const t = el('span');   t.textContent = tel;
        b.append(n, t);
        b.addEventListener('click', () => {
          fBusca = tel; $('#f-buscar').value = tel; pintarFacturas();
        });
        sug.appendChild(b);
      });
    } else { sug.hidden = true; }

    const cont = $('#f-lista');
    cont.textContent = '';
    if (!filas.length) {
      const v = el('div', 'vacio');
      const s = el('strong'); s.textContent = 'Sin facturas';
      const p = el('span'); p.textContent = 'Ningún cobro coincide con el filtro.';
      v.append(s, p); cont.appendChild(v);
    }
    filas.forEach((f, i) => {
      const n = el('div', 'factura');
      const izq = el('div');
      const num = el('div', 'factura__num');
      num.textContent = 'Factura ' + String(i + 1).padStart(4, '0') + ' · ' + hora(f.cobrado_en);
      const cli = el('div', 'factura__cli'); cli.textContent = f.cliente;
      const li = el('div', 'factura__l'); li.textContent = f.servicios || '—';
      const pr = el('div', 'factura__l'); pr.textContent = f.profesional;
      izq.append(num, cli, li, pr);

      const der = el('div', 'factura__der');
      const ch = el('span', 'chip chip--cobrada'); ch.textContent = 'Cobrada';
      const va = el('span', 'factura__val'); va.textContent = money(f.cobrado);
      const me = el('span', 'factura__l'); me.textContent = MEDIOS[f.metodo_pago] || f.metodo_pago;
      der.append(ch, va, me);
      if (f.comprobante) {
        const a = document.createElement('a');
        a.href = f.comprobante; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.title = 'Ver el comprobante';
        const im = document.createElement('img');
        im.className = 'factura__comp'; im.src = f.comprobante;
        im.alt = 'Comprobante de la transferencia de ' + f.cliente;
        a.appendChild(im);
        der.appendChild(a);
      }

      n.append(izq, der);
      cont.appendChild(n);
    });

    /* La meta es diaria, así que en periodos largos se multiplica por los días
       que abarca: comparar un mes contra la meta de un día no dice nada. */
    const dias = { dia: 1, semana: 7, quincena: 15, mes: 30, ano: 365 }[periodo] || 1;
    const meta = META_LOCAL * dias;
    $$('.facturas__rot')[0].textContent = 'Total ventas · ' + NOMBRE_PERIODO[periodo];
    $('#t-caja').textContent = money(caja.total);
    $('#t-barra').style.width = Math.min(100, caja.total / meta * 100) + '%';
    $('#t-meta').textContent = caja.total >= meta
      ? 'Meta cumplida · ' + NOMBRE_PERIODO[periodo]
      : 'Meta ' + money(meta) + ' · ' + NOMBRE_PERIODO[periodo];
    const com = (caja.porProfesional || []).reduce((t, p) => t + (p.pagar || 0), 0);
    $('#t-comisiones').textContent = money(com);

    const pagos = $('#t-pagos'); pagos.textContent = '';
    Object.keys(caja.porMetodo || {}).forEach(k => {
      const d = el('div', 'medida');
      const f = el('div', 'medida__f');
      const a = el('span'); a.textContent = MEDIOS[k] || k;
      const b = el('span'); b.textContent = money(caja.porMetodo[k]);
      f.append(a, b);
      const barra = el('div', 'barrita'); const in2 = el('div');
      in2.style.width = (caja.total ? caja.porMetodo[k] / caja.total * 100 : 0) + '%';
      barra.appendChild(in2);
      d.append(f, barra); pagos.appendChild(d);
    });

    const pf = $('#t-profs'); pf.textContent = '';
    (caja.porProfesional || []).forEach(p => {
      const d = el('div', 'medida');
      const f = el('div', 'medida__f');
      const a = el('span'); a.textContent = p.nombre;
      const b = el('span'); b.textContent = money(p.pagar);
      f.append(a, b);
      const l = el('div', 'factura__l');
      l.textContent = p.cuantas + (p.cuantas === 1 ? ' cita · ' : ' citas · ') + money(p.bruto) +
                      ' · ' + Math.round(p.comision * 100) + '%';
      const barra = el('div', 'barrita'); const in2 = el('div');
      in2.style.width = (caja.total ? p.bruto / caja.total * 100 : 0) + '%';
      barra.appendChild(in2);
      d.append(f, l, barra); pf.appendChild(d);
    });
  }

  let tBusca = null;
  $('#f-buscar').addEventListener('input', e => {
    clearTimeout(tBusca);
    const v = e.target.value;
    tBusca = setTimeout(() => { fBusca = v; pintarFacturas(); }, 200);
  });
  $('#f-limpiar').addEventListener('click', () => {
    fBusca = ''; $('#f-buscar').value = ''; pintarFacturas();
  });

  /* =========================================================
     Servicios y disponibilidad
     ========================================================= */
  let ajustes = null, pestanaServ = 'activos', CATALOGO = [];

  async function cargarAjustes() {
    try {
      ajustes = await api('/panel/ajustes');
      CATALOGO = ajustes.servicios || [];
      pintarServicios();
      pintarDispo();
    } catch (e) {
      $('#s-lista').textContent = e.message || 'No se pudo cargar.';
    }
  }

  $$('.pestana').forEach(b => b.addEventListener('click', () => {
    pestanaServ = b.dataset.serv;
    $$('.pestana').forEach(x => x.classList.toggle('is-on', x === b));
    pintarServicios();
  }));

  function pintarServicios() {
    if (!ajustes) return;
    const cont = $('#s-lista');
    cont.textContent = '';
    const activos = pestanaServ === 'activos';
    const lista = (ajustes.servicios || []).filter(s => !!s.activo === activos);
    $('#s-resumen').textContent = lista.length + (lista.length === 1 ? ' servicio' : ' servicios');

    if (!lista.length) {
      const v = el('div', 'vacio');
      const s = el('strong'); s.textContent = activos ? 'Sin servicios' : 'Nada archivado';
      const p = el('span'); p.textContent = activos
        ? 'Añade el primero para que el cliente pueda reservar.'
        : 'Los servicios que archives aparecen aquí.';
      v.append(s, p); cont.appendChild(v);
      return;
    }

    const porCat = {};
    lista.forEach(s => { (porCat[s.segmento] = porCat[s.segmento] || []).push(s); });
    Object.keys(porCat).forEach(cat => {
      const t = el('div', 'cat__tit');
      const a = el('span'); a.textContent = SEGMENTOS[cat] || cat;
      const b = el('span'); b.textContent = porCat[cat].length;
      t.append(a, b); cont.appendChild(t);

      porCat[cat].forEach(s => {
        const n = el('div', 'serv');
        const nm = el('div', 'serv__n'); nm.textContent = s.nombre;
        const pr = el('div', 'serv__p'); pr.textContent = s.precio === null ? 'A convenir' : money(s.precio);
        const de = el('div', 'serv__d'); de.textContent = s.descripcion || 'Sin descripción.';
        const me = el('div', 'serv__m');
        me.textContent = 'Duración: ' + s.minutos + ' min';
        const bs = el('div', 'serv__b');
        bs.appendChild(boton('Editar', () => abrirServicio(s)));
        bs.appendChild(boton(activos ? 'Archivar' : 'Reactivar', () => guardarServicio(
          { id: s.id, precio: s.precio, minutos: s.minutos, activo: !activos },
          activos ? 'Servicio archivado' : 'Servicio reactivado')));
        n.append(nm, pr, de, me, bs);
        cont.appendChild(n);
      });
    });
  }

  function pintarDispo() {
    if (!ajustes) return;
    const h = $('#d-horario');
    h.textContent = '';
    (ajustes.horario || []).forEach(d => {
      const f = el('div', 'hfila');
      const b = el('button', 'hdia' + (d.abierto ? ' is-on' : ''));
      b.type = 'button';
      b.appendChild(el('i'));
      b.appendChild(document.createTextNode(DIAS[d.dow]));
      const abre = el('input'); abre.type = 'time'; abre.value = d.abre;
      const cierra = el('input'); cierra.type = 'time'; cierra.value = d.cierra;
      const guardar = abierto => api('/panel/ajustes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario: { dow: d.dow, abre: abre.value, cierra: cierra.value, abierto } })
      }).then(() => avisar('Horario guardado')).catch(e => avisar(e.message));
      b.addEventListener('click', () => {
        const on = !b.classList.contains('is-on');
        b.classList.toggle('is-on', on); d.abierto = on; guardar(on);
      });
      [abre, cierra].forEach(i => i.addEventListener('change', () => guardar(d.abierto)));
      f.append(b, abre, cierra);
      h.appendChild(f);
    });

    const e = $('#d-equipo');
    e.textContent = '';
    (ajustes.equipo || []).forEach(p => {
      const f = el('div', 'prof-fila');
      const cab = el('div', 'prof-fila__cab');
      const ini = el('span', 'ficha-prof__ini'); ini.textContent = inicial(p.nombre);
      const nm = el('span', 'prof-fila__n'); nm.textContent = p.nombre;
      cab.append(ini, nm);

      /* Quitar del equipo es desactivar, no borrar: las citas pasadas siguen
         apuntando a esa persona y perderlas descuadraría el histórico. */
      const quitar = el('button', 'bt bt--mini');
      quitar.type = 'button';
      quitar.textContent = p.activo ? 'Quitar del equipo' : 'Reactivar';
      quitar.addEventListener('click', async () => {
        const antes = p.activo;
        const enviar = activo => api('/panel/ajustes', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profesional: { id: p.id, comision: p.comision,
            entra: p.entra, sale: p.sale, activo } })
        });
        try {
          await enviar(!antes);
          avisar(antes ? p.nombre + ' quitado del equipo' : p.nombre + ' reactivado',
                 async () => { await enviar(antes); avisar('Deshecho'); cargarAjustes(); });
          cargarAjustes();
        } catch (e) { avisar(e.message || 'No se pudo guardar'); }
      });
      cab.appendChild(quitar);

      const campos = el('div', 'prof-fila__campos');
      const mk = (rot, input) => { const l = el('label'); l.appendChild(document.createTextNode(rot));
                                   l.appendChild(input); campos.appendChild(l); return input; };
      const com = el('input'); com.type = 'number'; com.min = '0'; com.max = '100'; com.step = '5';
      com.value = Math.round(p.comision * 100); mk('Comisión %', com);
      const entra = el('input'); entra.type = 'time'; entra.value = p.entra; mk('Entra', entra);
      const sale = el('input'); sale.type = 'time'; sale.value = p.sale; mk('Sale', sale);
      const clave = el('input'); clave.type = 'password'; clave.autocomplete = 'new-password';
      clave.placeholder = p.tiene_clave ? '•••••• (ya tiene)' : 'sin clave aún';
      mk('Clave nueva', clave);

      const guardar = () => api('/panel/ajustes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesional: { id: p.id, comision: Number(com.value) / 100,
          entra: entra.value, sale: sale.value, activo: p.activo,
          clave: clave.value || undefined } })
      }).then(() => {
        if (clave.value) { clave.value = ''; clave.placeholder = '•••••• (ya tiene)'; }
        avisar('Guardado');
      }).catch(er => avisar(er.message));
      [com, entra, sale, clave].forEach(i => i.addEventListener('change', guardar));

      f.append(cab, campos);
      e.appendChild(f);
    });
  }

  /* ---------- alta y edición de servicio ---------- */
  let servEditando = null;

  function abrirServicio(s) {
    servEditando = s || null;
    $('#sv-titulo').textContent = s ? 'Editar servicio' : 'Nuevo servicio';
    $('#sv-nombre').value = s ? s.nombre : '';
    /* Al crear, nombre y categoría se editan: son lo que define el servicio.
       Al editar quedan fijos porque de ellos sale el identificador, y cambiarlo
       rompería las citas ya guardadas que lo referencian. */
    $('#sv-nombre').disabled = !!s;
    $('#sv-precio').value = s && s.precio !== null ? s.precio : '';
    const selMin = $('#sv-min');
    selMin.textContent = '';
    DURACIONES.forEach(m => {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m < 60 ? m + ' min'
                    : (m / 60 % 1 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min'
                                  : (m / 60) + (m === 60 ? ' hora' : ' horas'));
      selMin.appendChild(o);
    });
    selMin.value = String(s ? s.minutos : 45);
    const cat = $('#sv-cat'); cat.textContent = '';
    Object.keys(SEGMENTOS).forEach(k => {
      const o = document.createElement('option'); o.value = k; o.textContent = SEGMENTOS[k];
      cat.appendChild(o);
    });
    if (s) cat.value = s.segmento;
    cat.disabled = !!s;
    $('#sv-nombre').placeholder = 'ej. Corte y Barba VIP';
    $('#sv-desc').value = s ? (s.descripcion || '') : '';
    $('#sv-error').hidden = true;
    vistaPrevia();
    $('#dlg-servicio').showModal();
  }

  function vistaPrevia() {
    $('#vp-nombre').textContent = $('#sv-nombre').value || 'Nombre del servicio';
    const p = $('#sv-precio').value;
    $('#vp-precio').textContent = p ? money(p) : 'A convenir';
    $('#vp-desc').textContent = $('#sv-desc').value || 'La descripción que verá el cliente.';
  }
  ['#sv-nombre', '#sv-precio', '#sv-desc'].forEach(s => $(s).addEventListener('input', vistaPrevia));
  $('#abrir-servicio').addEventListener('click', () => abrirServicio(null));

  async function guardarServicio(datosServ, texto) {
    try {
      await api('/panel/ajustes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ servicio: datosServ }) });
      avisar(texto || 'Guardado');
      cargarAjustes();
    } catch (e) { avisar(e.message || 'No se pudo guardar'); }
  }

  /* Identificador a partir del nombre: minúsculas, sin tildes, con guiones. El
     servidor lo vuelve a calcular igual; esto es solo para avisar del choque
     antes de enviar. */
  function idDesde(nombre) {
    return String(nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }

  $('#sv-guardar').addEventListener('click', async () => {
    const err = $('#sv-error');
    err.hidden = true;
    const btn = $('#sv-guardar');
    const precio = $('#sv-precio').value;

    if (servEditando) {
      btn.disabled = true;
      try {
        await guardarServicio({ id: servEditando.id, precio: precio === '' ? null : Number(precio),
          minutos: Number($('#sv-min').value), descripcion: $('#sv-desc').value,
          activo: true }, 'Servicio actualizado');
        $('#dlg-servicio').close();
      } finally { btn.disabled = false; }
      return;
    }

    const nombre = $('#sv-nombre').value.trim();
    if (!nombre) { err.textContent = 'Ponle un nombre al servicio.'; err.hidden = false; return; }
    const id = idDesde(nombre);
    if (!id) { err.textContent = 'Ese nombre no deja construir un identificador.'; err.hidden = false; return; }
    if ((ajustes && ajustes.servicios || []).some(x => x.id === id)) {
      err.textContent = 'Ya existe un servicio con ese nombre.'; err.hidden = false; return;
    }

    btn.disabled = true;
    const antes = btn.textContent;
    btn.textContent = ''; btn.appendChild(el('span', 'girando'));
    btn.appendChild(document.createTextNode(' Publicando'));
    try {
      await api('/panel/ajustes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicio: { nombre, segmento: $('#sv-cat').value,
          precio: precio === '' ? null : Number(precio), minutos: Number($('#sv-min').value),
          descripcion: $('#sv-desc').value, activo: true } }) });
      $('#dlg-servicio').close();
      avisar('Servicio publicado · ' + nombre);
      CATALOGO = [];
      cargarAjustes();
    } catch (e) {
      err.textContent = e.message || 'No se pudo publicar'; err.hidden = false;
    } finally { btn.disabled = false; btn.textContent = antes; }
  });

  /* =========================================================
     Cobro
     ========================================================= */
  let citaCobrando = null, medioElegido = 'efectivo', comprobante = null;

  /* La foto se encoge en el navegador antes de subirla. Una foto de celular
     pesa tres o cuatro megas y aquí solo hace falta poder leer el monto y la
     fecha del recibo: a 900 px de ancho se lee perfectamente y baja a unos
     100 KB, que es lo que hace viable guardarla junto a la cita. */
  function encoger(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onerror = () => reject(new Error('No se pudo leer la foto'));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Ese archivo no es una imagen'));
        img.onload = () => {
          const max = 900;
          const escala = Math.min(1, max / Math.max(img.width, img.height));
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.round(img.width * escala);
          lienzo.height = Math.round(img.height * escala);
          lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
          resolve(lienzo.toDataURL('image/jpeg', 0.72));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  function sincronizarComprobante() {
    const pide = medioElegido === 'transferencia';
    $('#co-comprobante').hidden = !pide;
    $('#co-hecho').hidden = !comprobante;
    $('#co-soltar').hidden = !!comprobante;
    if (comprobante) $('#co-mini').src = comprobante;
    const falta = pide && !comprobante;
    const b = $('#co-guardar');
    b.disabled = falta;
    b.title = falta ? 'Adjunta la foto del comprobante para registrar una transferencia' : '';
    const err = $('#co-error');
    if (falta) {
      err.textContent = 'Adjunta la foto del comprobante para registrar una transferencia';
      err.hidden = false;
    } else if (err.textContent.startsWith('Adjunta la foto')) {
      err.hidden = true;
    }
  }

  $('#co-archivo').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      comprobante = await encoger(f);
      $('#co-nombre').textContent = f.name;
      sincronizarComprobante();
    } catch (err) {
      $('#co-error').textContent = err.message; $('#co-error').hidden = false;
    }
  });
  $('#co-cambiar').addEventListener('click', () => {
    comprobante = null; $('#co-archivo').value = '';
    sincronizarComprobante();
  });

  function abrirCobro(c) {
    citaCobrando = c;
    $('#co-quien').textContent = c.cliente + ' · ' + (c.servicios || '—');
    /* Se propone lo que valía al reservar, pero se puede cambiar: un descuento
       o un servicio que se alargó hacen que lo cobrado difiera. */
    $('#co-valor').value = c.total || 0;
    medioElegido = 'efectivo';
    comprobante = null; $('#co-archivo').value = ''; $('#co-nombre').textContent = '';
    const m = $('#co-medios'); m.textContent = '';
    Object.keys(MEDIOS).forEach(k => {
      const b = el('button', 'medio' + (k === medioElegido ? ' is-on' : ''));
      b.type = 'button'; b.textContent = MEDIOS[k];
      b.addEventListener('click', () => {
        medioElegido = k;
        m.querySelectorAll('.medio').forEach(x => x.classList.toggle('is-on', x === b));
        sincronizarComprobante();
      });
      m.appendChild(b);
    });
    $('#co-error').hidden = true;
    sincronizarComprobante();
    $('#dlg-cobro').showModal();
  }

  $('#co-guardar').addEventListener('click', async () => {
    const err = $('#co-error');
    err.hidden = true;
    try {
      await api('/panel/cobrar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cita_id: citaCobrando.id, cobrado: Number($('#co-valor').value),
                               metodo_pago: medioElegido, comprobante }) });
      $('#dlg-cobro').close();
      cerrarFicha();
      const id = citaCobrando.id, antes = citaCobrando.estado;
      avisar('Cobro registrado · ' + money($('#co-valor').value), async () => {
        await api('/panel/cita', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify({ id, estado: antes }) });
        avisar('Cobro deshecho'); cargarDia();
      });
      cargarDia();
    } catch (e) {
      err.textContent = e.message || 'No se pudo registrar';
      err.hidden = false;
    }
  });

  /* =========================================================
     Crear cita
     ========================================================= */
  let clienteElegido = null;

  async function catalogo() {
    if (CATALOGO.length) return CATALOGO;
    const r = await api('/panel/servicios');
    CATALOGO = r.servicios || [];
    return CATALOGO;
  }

  async function abrirCrear(profId, hhmm) {
    $('#cr-error').hidden = true;
    limpiarCliente();
    const sel = $('#cr-prof');
    sel.textContent = '';
    (datos.profesionales || []).forEach(p => {
      const o = document.createElement('option'); o.value = p.id; o.textContent = p.nombre;
      sel.appendChild(o);
    });
    if (profId) sel.value = String(profId);
    $('#cr-hora').value = hhmm || '';
    await catalogo();
    pintarServiciosCrear();
    buscarClientes('');
    $('#dlg-crear').showModal();
  }

  /* Solo se ofrecen los servicios que ese profesional presta: elegir uno que no
     hace y descubrirlo al guardar es hacerle perder el tiempo a quien está con
     el cliente delante. */
  function pintarServiciosCrear() {
    const prof = Number($('#cr-prof').value);
    const sel = $('#cr-serv');
    const antes = sel.value;
    sel.textContent = '';
    let grupo = null, og = null;
    CATALOGO.filter(s => s.activo !== false && (s.profesionales || []).map(Number).includes(prof))
      .forEach(s => {
        if (s.segmento !== grupo) {
          grupo = s.segmento;
          og = document.createElement('optgroup');
          og.label = SEGMENTOS[grupo] || grupo;
          sel.appendChild(og);
        }
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.nombre + (s.precio ? ' · ' + money(s.precio) : '');
        o.dataset.min = s.minutos;
        og.appendChild(o);
      });
    if (antes && sel.querySelector('option[value="' + antes + '"]')) sel.value = antes;
    sincronizarDuracion();
  }

  /* La duración del catálogo es una propuesta, no una imposición: quien atiende
     sabe si ese cliente se demora más. */
  function sincronizarDuracion() {
    const o = $('#cr-serv').selectedOptions[0];
    const min = o ? Number(o.dataset.min) : 0;
    $('#cr-min').value = min || 30;
    $('#cr-dur-nota').textContent = min ? 'minutos · el servicio propone ' + min : 'minutos';
  }
  $('#cr-prof').addEventListener('change', pintarServiciosCrear);
  $('#cr-serv').addEventListener('change', sincronizarDuracion);
  $('#abrir-crear').addEventListener('click', () => {
    const m = Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / PASO) * PASO;
    abrirCrear(null, aHHMM(m));
  });

  let tCli = null;
  $('#cr-buscar').addEventListener('input', e => {
    clearTimeout(tCli);
    const q = e.target.value;
    tCli = setTimeout(() => buscarClientes(q), 220);
  });

  async function buscarClientes(q) {
    const ul = $('#cr-lista');
    try {
      const r = await api('/panel/clientes?q=' + encodeURIComponent(q));
      ul.textContent = '';
      (r.clientes || []).forEach(c => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = c.nombre;
        const s = document.createElement('small'); s.textContent = c.telefono || 'sin celular';
        b.appendChild(s);
        b.addEventListener('click', () => elegirCliente(c));
        li.appendChild(b); ul.appendChild(li);
      });
    } catch (e) { ul.textContent = ''; }
  }

  function elegirCliente(c) {
    clienteElegido = c;
    const p = $('#cr-elegido');
    p.textContent = c.nombre + (c.telefono ? ' · ' + c.telefono : '');
    const q = document.createElement('button');
    q.type = 'button'; q.textContent = 'cambiar';
    q.addEventListener('click', limpiarCliente);
    p.appendChild(q);
    p.hidden = false;
    $('#cr-buscar').hidden = true; $('#cr-lista').hidden = true; $('#cr-nuevo').hidden = true;
  }

  function limpiarCliente() {
    clienteElegido = null;
    $('#cr-elegido').hidden = true;
    $('#cr-buscar').hidden = false; $('#cr-buscar').value = '';
    $('#cr-lista').hidden = false; $('#cr-nuevo').hidden = false;
    $('#cr-nombre').value = ''; $('#cr-tel').value = '';
  }

  $('#cr-guardar').addEventListener('click', async () => {
    const err = $('#cr-error');
    err.hidden = true;
    const btn = $('#cr-guardar');
    btn.disabled = true;
    try {
      const cuerpo = {
        fecha: ymd(dia), hora: $('#cr-hora').value, minutos: Number($('#cr-min').value),
        servicios: [$('#cr-serv').value].filter(Boolean), profesional: Number($('#cr-prof').value)
      };
      if (clienteElegido) cuerpo.cliente_id = clienteElegido.id;
      else { cuerpo.nombre = $('#cr-nombre').value; cuerpo.telefono = $('#cr-tel').value; }
      await api('/panel/crear', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(cuerpo) });
      $('#dlg-crear').close();
      avisar('Cita creada');
      cargarDia();
    } catch (e) {
      err.textContent = e.message || 'No se pudo crear la cita';
      err.hidden = false;
    } finally { btn.disabled = false; }
  });

  /* =========================================================
     Bloquear horas
     ========================================================= */
  function abrirBloqueo() {
    const sel = $('#bq-prof');
    sel.textContent = '';
    if (ROL === 'dueno') {
      const t = document.createElement('option'); t.value = ''; t.textContent = 'Todo el local';
      sel.appendChild(t);
    }
    (datos.profesionales || []).forEach(p => {
      const o = document.createElement('option'); o.value = p.id; o.textContent = p.nombre;
      sel.appendChild(o);
    });
    if (ROL === 'profesional' && YO.profId) sel.value = String(YO.profId);
    sel.disabled = ROL === 'profesional';   // no puede cerrarle la agenda a otro
    $('#bq-error').hidden = true;
    $('#dlg-bloqueo').showModal();
  }
  $('#abrir-bloqueo').addEventListener('click', abrirBloqueo);

  $('#bq-guardar').addEventListener('click', async () => {
    const err = $('#bq-error');
    err.hidden = true;
    try {
      await api('/panel/bloqueo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesional_id: $('#bq-prof').value || null, fecha: ymd(dia),
                               desde: $('#bq-desde').value, hasta: $('#bq-hasta').value,
                               motivo: $('#bq-motivo').value }) });
      $('#dlg-bloqueo').close();
      avisar('Horas bloqueadas');
      cargarDia();
    } catch (e) {
      err.textContent = e.message || 'No se pudo bloquear';
      err.hidden = false;
    }
  });

  /* =========================================================
     Arranque
     ========================================================= */
  if (DEMO) {
    /* Aviso permanente en pantalla: nada de lo que se ve aquí es real, y quien
       lo mire tiene que saberlo antes de sacar conclusiones. */
    const aviso = el('div', 'demo-aviso');
    aviso.textContent = 'Modo demostración · datos inventados · nada de esto es real · ';
    const cambiar = el('button', 'demo-rol');
    cambiar.type = 'button';
    const pinta = () => { cambiar.textContent = 'viendo como ' +
      (ROL === 'dueno' ? 'ADMINISTRADOR' : 'PROFESIONAL') + ' · cambiar'; };
    cambiar.addEventListener('click', () => {
      ROL = ROL === 'dueno' ? 'profesional' : 'dueno';
      YO = { nombre: ROL === 'dueno' ? 'Administrador' : 'Emanuel Gómez',
             profId: ROL === 'dueno' ? null : 1 };
      pinta(); abrir();
    });
    pinta();
    aviso.appendChild(cambiar);
    document.body.insertBefore(aviso, document.body.firstChild);
    document.body.classList.add('con-aviso');
    YO = { nombre: 'Administrador', profId: null };
    abrir();
  } else {
    /* Si la cookie sigue viva se entra directo, sin volver a teclear la clave. */
    api('/panel/entrar').then(r => {
      ROL = r.rol || 'dueno';
      YO = { nombre: r.nombre || 'Administrador', profId: r.profId || null };
      abrir();
    }).catch(() => {});
  }
})();

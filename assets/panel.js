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
  /* La dirección pública. Escrita una vez: en tres mensajes distintos, una
     copia es la que se queda vieja el día que se ponga un dominio propio. */
  const SITIO = 'el-imperio-lime.vercel.app';

  const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };

  /* PASO son los minutos con los que la API ofrece cupos y con los que se
     coloca todo. FILA es lo que mide una fila de la rejilla: al doblarla a 30
     minutos la jornada entera cabe en una pantalla sin desplazarse, que es
     como se mira una agenda de verdad. */
  const PASO = 15;
  const FILA = 30;
  /* Meta diaria de caja. El valor de verdad vive en la base y llega con los
     ajustes; este solo sirve mientras la primera carga está en camino. */
  let META_LOCAL = 300000;

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
    /* Una cita anclada a la hora real: empezo hace veinticinco minutos y sigue
       sin cobrar. Es la unica forma de que en la demostracion se vea el estado
       «falta cobrar» y el mensaje de demora a cualquier hora del dia. */
    const hace = m => new Date(Date.now() - m * 60000).toISOString();
    return {
      profesionales: [{ id: 1, nombre: 'Emanuel Gómez' }, { id: 2, nombre: 'Jeronimo Garcia' },
                      { id: 3, nombre: 'Valentina Romero' }],
      citas: [
        { id: 1, codigo: 'AB3K7P', inicio: t(9, 0),   fin: t(10, 0),  estado: 'cumplida',   total: 45000, cobrado: 45000, metodo_pago: 'efectivo',      cliente: 'Andrés Mejía',   telefono: '+573001112233', profesional_id: 1, profesional: 'Emanuel Gómez',    servicios: 'Corte VIP' },
        { id: 2, codigo: 'CD8M2Q', inicio: t(10, 30), fin: t(12, 0),  estado: 'confirmada', total: 60000, cliente: 'Santiago Ruiz',  telefono: '+573004445566', profesional_id: 1, profesional: 'Emanuel Gómez',    servicios: 'Corte y Barba VIP' },
        { id: 3, codigo: 'EF4N9R', inicio: t(9, 30),  fin: t(10, 15), estado: 'cumplida',   total: 35000, cobrado: 35000, metodo_pago: 'efectivo',      cliente: 'Camilo Ospina',  telefono: '+573007778899', profesional_id: 2, profesional: 'Jeronimo Garcia',  servicios: 'Corte Sencillo' },
        { id: 4, codigo: 'GH5P1S', inicio: t(11, 0),  fin: t(11, 30), estado: 'no_asistio', total: 26000, cliente: 'Diego Franco',   telefono: '+573001234567', profesional_id: 2, profesional: 'Jeronimo Garcia',  servicios: 'Ritual de Barba' },
        { id: 5, codigo: 'IJ6Q3T', inicio: t(14, 0),  fin: t(16, 0),  estado: 'confirmada', total: 0,     cliente: 'Laura Restrepo', telefono: '+573009998877', profesional_id: 3, profesional: 'Valentina Romero', servicios: 'Manos y pies' },
        { id: 7, codigo: 'MN9T4V', inicio: hace(25), fin: hace(-20), estado: 'confirmada', total: 48000,
          cliente: 'Julian Ortega', telefono: '+573015556677', profesional_id: 2, profesional: 'Jeronimo Garcia', servicios: 'Corte y Barba Sencillo' },
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
        { id: 3, nombre: 'Valentina Romero', comision: .5, entra: '09:00', sale: '18:00', activo: true,  tiene_clave: true },
        { id: 4, nombre: 'Simon',            comision: .5, entra: '09:00', sale: '20:00', activo: true,  tiene_clave: false, foto: 'assets/barbero-simon.jpg' }
      ],
      horarioSemana: [0, 1, 2, 3, 4, 5, 6].map(dow => ({
        dow, abre: '09:00', cierra: dow === 6 ? '18:00' : '20:00', abierto: dow !== 0 })),
      clientes: [{ id: 1, nombre: 'Andrés Mejía', telefono: '+573001112233' },
                 { id: 2, nombre: 'Santiago Ruiz', telefono: '+573004445566' }],
      productos: [
        { id: 'cera-mate', nombre: 'Cera mate', marca: 'Reuzel', descripcion: 'Fijación fuerte, acabado sin brillo.', precio: 48000, costo: 27000, existencias: 9, minimo: 3, activo: true },
        { id: 'aceite-barba', nombre: 'Aceite de barba', marca: 'Barba Negra', descripcion: 'Suaviza y quita la comezón de la barba nueva.', precio: 38000, costo: 21000, existencias: 2, minimo: 3, activo: true },
        { id: 'shampoo-anticaida', nombre: 'Shampoo anticaída', marca: 'Nioxin', descripcion: null, precio: 62000, costo: 40000, existencias: 5, minimo: 2, activo: true },
        { id: 'talco-cuello', nombre: 'Talco para cuello', marca: null, descripcion: 'El que usamos en la silla.', precio: 15000, costo: 8000, existencias: 0, minimo: 2, activo: true },
        { id: 'gel-fijador', nombre: 'Gel fijador', marca: 'Ébano', descripcion: 'Descontinuado por el proveedor.', precio: 22000, costo: 12000, existencias: 0, minimo: 0, activo: false }
      ],
      finanzas: {
        rango: { desde: '2026-08-01', hasta: '2026-08-17', dias: 17 },
        ingresos: { total: 4820000, servicios: 4310000, productos: 385000, otros: 125000,
                    citas: 96, ventas: 14 },
        egresos: { total: 2140000,
                   porCategoria: { 'Arriendo': 1200000, 'Insumos': 540000,
                                   'Servicios públicos': 260000, 'Mantenimiento': 140000 } },
        neto: 2680000,
        meta: { diaria: 300000, periodo: 5100000 },
        movimientos: [
          { id: 1, tipo: 'egreso', concepto: 'Arriendo del local', monto: 1200000,
            fecha: '2026-08-01', categoria: 'Arriendo', profesional: null },
          { id: 2, tipo: 'egreso', concepto: 'Caja de guantes y cuchillas', monto: 340000,
            fecha: '2026-08-06', categoria: 'Insumos', profesional: 'Emanuel Gómez' },
          { id: 3, tipo: 'ingreso', concepto: 'Alquiler de silla a barbero invitado', monto: 125000,
            fecha: '2026-08-09', categoria: null, profesional: null },
          { id: 4, tipo: 'egreso', concepto: 'Recibo de energía', monto: 260000,
            fecha: '2026-08-12', categoria: 'Servicios públicos', profesional: null }
        ]
      },
      galeria: [
        { id: 1, alt: 'Afeitado tradicional con toalla caliente', orden: 10, activo: true, kb: 180, url: 'assets/trabajo-1.jpg' },
        { id: 2, alt: 'Corte con máquina perfilando un fade', orden: 20, activo: true, kb: 210, url: 'assets/trabajo-2.jpg' },
        { id: 3, alt: 'Perfilado de barba a navaja', orden: 30, activo: true, kb: 165, url: 'assets/trabajo-3.jpg' }
      ],
      movimientos: [
        { id: 5, producto_id: 'cera-mate', producto: 'Cera mate', tipo: 'venta', cantidad: -1, total: 48000, metodo_pago: 'efectivo', profesional: 'Emanuel Gómez', nota: null, creado: hace(95) },
        { id: 4, producto_id: 'aceite-barba', producto: 'Aceite de barba', tipo: 'venta', cantidad: -2, total: 76000, metodo_pago: 'transferencia', profesional: 'Jeronimo Garcia', nota: null, creado: hace(210) },
        { id: 3, producto_id: 'talco-cuello', producto: 'Talco para cuello', tipo: 'ajuste', cantidad: -1, total: null, metodo_pago: null, profesional: null, nota: 'Conteo del lunes', creado: hace(1500) },
        { id: 2, producto_id: 'shampoo-anticaida', producto: 'Shampoo anticaída', tipo: 'entrada', cantidad: 6, total: null, metodo_pago: null, profesional: null, nota: 'Factura 4471 del proveedor', creado: hace(2900) },
        { id: 1, producto_id: 'cera-mate', producto: 'Cera mate', tipo: 'entrada', cantidad: 10, total: null, metodo_pago: null, profesional: null, nota: 'Existencias iniciales', creado: hace(4400) }
      ]
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
    const ventas = MUESTRA.movimientos.filter(m => m.tipo === 'venta');
    const totalProductos = ventas.reduce((t, v) => t + v.total, 0);
    const total = cobradas.reduce((t, c) => t + c.cobrado, 0) + totalProductos;
    const porMetodo = {};
    cobradas.forEach(c => { porMetodo[c.metodo_pago] = (porMetodo[c.metodo_pago] || 0) + c.cobrado; });
    ventas.forEach(v => { porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] || 0) + v.total; });
    const porProf = {};
    cobradas.forEach(c => {
      const k = c.profesional;
      if (!porProf[k]) porProf[k] = { nombre: k, bruto: 0, comision: .5, pagar: 0, cuantas: 0 };
      porProf[k].bruto += c.cobrado; porProf[k].cuantas += 1;
      porProf[k].pagar = Math.round(porProf[k].bruto * .5);
    });
    return { total, totalProductos, totalServicios: total - totalProductos, ventas,
             porMetodo, porProfesional: Object.values(porProf),
             cobros: cobradas.map(c => ({ id: c.id, cobrado_en: c.fin, cliente: c.cliente,
               telefono: c.telefono, servicios: c.servicios, profesional: c.profesional,
               metodo_pago: c.metodo_pago, cobrado: c.cobrado, comprobante: c.comprobante || null })) };
  }

  function respuestaDemo(ruta, opciones) {
    const metodo = (opciones && opciones.method) || 'GET';

    /* El borrado sí se ejecuta de verdad sobre los datos de muestra —y con la
       misma regla que el servidor— porque una demostración que dice «eliminado»
       y deja el producto ahí enseña algo que no es. Se pierde al recargar, que
       es lo que corresponde: nada de esto sale de este archivo. */
    if (metodo === 'DELETE' && ruta.startsWith('/panel/inventario')) {
      const id = decodeURIComponent((ruta.split('id=')[1] || ''));
      const p2 = MUESTRA.productos.find(x => x.id === id);
      if (!p2) throw Object.assign(new Error('Ese producto no existe'), { estado: 404 });
      const n = MUESTRA.movimientos.filter(m => m.producto_id === id && m.tipo === 'venta').length;
      if (n) {
        throw Object.assign(new Error(p2.nombre + ' ya se vendió ' + n +
          (n === 1 ? ' vez' : ' veces') + ', así que borrarlo cambiaría cajas ya cerradas. Archívalo.'),
          { estado: 409 });
      }
      MUESTRA.productos.splice(MUESTRA.productos.indexOf(p2), 1);
      MUESTRA.movimientos = MUESTRA.movimientos.filter(m => m.producto_id !== id);
      return { id, nombre: p2.nombre };
    }

    if (ruta.startsWith('/panel/agenda'))    return demoAgenda();
    if (ruta.startsWith('/panel/caja'))      return demoCaja();
    if (ruta.startsWith('/panel/servicios')) return { servicios: MUESTRA.servicios };
    if (ruta.startsWith('/panel/clientes'))  return { clientes: MUESTRA.clientes };
    if (ruta.startsWith('/panel/finanzas'))  return MUESTRA.finanzas;
    if (ruta.startsWith('/panel/galeria'))   return { fotos: MUESTRA.galeria };
    if (ruta.startsWith('/panel/inventario')) return { productos: MUESTRA.productos,
                                                       movimientos: MUESTRA.movimientos,
                                                       profesionales: MUESTRA.profesionales };
    if (ruta.startsWith('/panel/ajustes'))   return { servicios: MUESTRA.servicios,
                                                      horario: MUESTRA.horarioSemana,
                                                      equipo: MUESTRA.equipo, meta: 300000 };
    if (ruta.startsWith('/panel/entrar'))    return { rol: ROL, nombre: 'Emanuel Gómez' };
    return { ok: true };   // crear, cobrar, mover, bloquear: se aceptan sin guardar
  }

  const SIN_API = 'El panel necesita el sitio publicado. En local no se ejecutan las funciones del servidor.';

  async function api(ruta, opciones) {
    if (DEMO) { await new Promise(r => setTimeout(r, 90)); return respuestaDemo(ruta, opciones); }

    /* Mismo reintento que en la página, y por lo mismo: la base se suspende
       sola tras un rato sin uso y la primera consulta después paga el
       despertar, a veces con un 500. Aquí duele más que en la web —el panel se
       abre a primera hora, justo cuando la base lleva toda la noche dormida—.

       Solo lecturas. Reintentar un cobro o una cita los duplicaría. */
    const metodo = (opciones && opciones.method) || 'GET';
    if (metodo === 'GET') {
      try { return await unaVez(ruta, opciones); }
      catch (e) {
        if (!(e.estado === 0 || (e.estado >= 500 && e.estado < 600))) throw e;
        await new Promise(r => setTimeout(r, 900));
      }
    }
    return unaVez(ruta, opciones);
  }

  async function unaVez(ruta, opciones) {
    let r;
    try { r = await fetch('/api' + ruta, opciones); }
    catch (e) { throw Object.assign(new Error('Sin conexión.'), { estado: 0 }); }
    let cuerpo = null;
    try { cuerpo = await r.json(); } catch (e) { /* no era JSON */ }
    if (!r.ok) {
      /* Un 404 sin cuerpo JSON no es «no encontrado»: es que la ruta ni
         siquiera se está ejecutando. */
      const msg = (cuerpo && cuerpo.error) ||
                  (r.status === 404 ? SIN_API :
                   r.status >= 500 ? 'El servidor tardó en responder. Vuelve a intentarlo.' :
                   'Error ' + r.status);
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
                      ['finanzas', 'Finanzas'], ['servicios', 'Servicios'], ['galeria', 'Galería'],
                      ['inventario', 'Inventario'], ['dispo', 'Disponibilidad']];
  /* El barbero también entra al inventario, pero solo para vender: la vitrina
     está junto a la silla y mandarlo a buscar al administrador para cobrar una
     cera es lo que hace que la venta no se registre. */
  const TABS_PROF  = [['midia', 'Mi día'], ['inventario', 'Productos']];

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
    ['agenda', 'midia', 'facturas', 'finanzas', 'servicios', 'galeria', 'inventario', 'dispo'].forEach(v => {
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
    if (cual === 'inventario') { $('#abrir-producto').hidden = ROL !== 'dueno'; cargarInventario(); }
    if (cual === 'galeria') cargarGaleria();
    if (cual === 'finanzas') cargarFinanzas();
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

    cont.appendChild(botonWhatsapp(c));

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

  /* Mensajes listos para enviar. Se redactan aquí y no los escribe cada barbero
     porque a las siete de la tarde, con el cliente en la silla, nadie compone
     un texto amable: manda un «?» seco o no manda nada.

     El de la demora es el delicado. Va sin reproche y sin dar por hecho que el
     cliente falló —puede estar en un trancón, puede haberse confundido de
     hora—, y ofrece salida en vez de pedir explicaciones: quien se siente
     regañado no responde, y encima no vuelve. */
  /* SIN EMOJI, a propósito y después de intentarlo dos veces.
     Primero iba la flor de lis de la marca (U+269C), que no es un emoji sino
     un símbolo tipográfico y casi ninguna fuente de teléfono trae. Se cambió
     por ☺️💈, que son emoji de verdad, y siguieron saliendo como rombo con
     interrogante en el dispositivo del local.

     Ese rombo es el glifo de «no tengo con qué dibujar esto»: el texto viaja
     intacto —comprobado, salen los bytes correctos y el enlace se arma con
     encodeURIComponent— y quien falla es la fuente del aparato que lo pinta.
     Desde aquí no hay forma de arreglarlo: la fuente la pone el teléfono.

     Un mensaje que le llega al cliente con dos rombos se lee como un mensaje
     roto, y eso es peor que uno sin adornos. Texto plano no puede fallar en
     ningún dispositivo, así que el remate se hace con palabras. Si algún día
     se confirma que los emoji se ven bien en los teléfonos del local, se
     vuelven a poner aquí y en ningún otro sitio. */
  function mensajes(c) {
    const h = hora(c.inicio);
    const dd = DIAS[new Date(c.inicio).getDay()].toLowerCase();
    const nom = String(c.cliente || '').split(' ')[0];
    const prof = String(c.profesional || '').split(' ')[0];
    const esHoy = ymd(new Date(c.inicio)) === ymd(new Date());
    const cuando = esHoy ? 'hoy' : 'el ' + dd;

    /* El código y por dónde cambiar la cita.

       Va en los mensajes que se mandan ANTES de la cita, no en los de después.
       El cliente lo ve al reservar, pero si cerró la página lo perdió, y sin él
       no puede entrar a modificarla: reservaría otra vez y acabaría con dos
       citas, que es justo lo que la pantalla de cambios viene a evitar.

       Solo si la cita sigue en pie y no ha pasado: mandarle a alguien cómo
       cambiar una cita que ya se atendió no ayuda a nadie. */
    /* La llave es su propio celular, no un código. El código existía y el
       cliente lo perdía: lo veía una vez en pantalla, cerraba, y cuando quería
       mover la cita reservaba otra y acababa con dos. */
    const puedeCambiar = c.estado === 'confirmada' && new Date(c.inicio) > new Date();
    const comoCambiar = puedeCambiar
      ? ' Si necesitas moverla, entra a ' + SITIO + ', toca «Modifícala aquí» y ' +
        'busca tu cita con este mismo número.'
      : '';

    const lista = [];

    lista.push({ id: 'recordar', rotulo: 'Recordar la cita',
      texto: '¡Hola ' + nom + '! Te recordamos tu cita en El Imperio ' + cuando +
             ' a las ' + h + ' con ' + prof + '. Aquí te esperamos.' + comoCambiar });

    lista.push({ id: 'confirmar', rotulo: 'Pedir confirmación',
      texto: '¡Hola ' + nom + '! ¿Nos confirmas tu cita de ' + cuando + ' a las ' + h +
             ' con ' + prof + '? Con un sí nos basta y te guardamos el turno.' + comoCambiar });

    /* Solo cuando la hora ya pasó y la cita sigue en pie: ofrecerlo antes sería
       preguntarle a alguien por qué se demora cuando todavía no se demora. */
    const empezo = new Date(c.inicio) < new Date();
    if (empezo && c.estado === 'confirmada') {
      lista.push({ id: 'demora', rotulo: '¿Viene en camino?', destacado: true,
        texto: '¡Hola ' + nom + '! Aquí en El Imperio te tenemos el turno de las ' + h +
               ' con ' + prof + '. ¿Vas en camino o prefieres que te lo movamos para más tarde? ' +
               'Cualquiera de las dos nos sirve, es solo para organizarnos.' });
    }

    if (c.estado === 'cumplida') {
      lista.push({ id: 'gracias', rotulo: 'Agradecer la visita',
        texto: '¡Gracias por venir, ' + nom + '! Fue un gusto atenderte. ' +
               'Si quedaste contento, una reseña en Google nos ayuda muchísimo.' });
    }

    if (puedeCambiar) {
      lista.push({ id: 'cambiar', rotulo: 'Pedirle que la cambie él mismo',
        texto: '¡Hola ' + nom + '! Necesitamos mover tu cita de ' + cuando + ' a las ' + h +
               '. Puedes elegir tú la nueva hora en ' + SITIO + ': toca «Modifícala aquí» y ' +
               'busca tu cita con este mismo número. La anterior se cancela sola al ' +
               'confirmar. Si prefieres, dinos qué día te sirve y la movemos nosotros.' });
    }

    lista.push({ id: 'libre', rotulo: 'Abrir el chat en blanco', texto: '' });
    return lista;
  }

  function enlaceWa(c, texto) {
    return 'https://wa.me/' + String(c.telefono || '').replace(/\D/g, '') +
           (texto ? '?text=' + encodeURIComponent(texto) : '');
  }

  /* Un botón que despliega los mensajes. Antes era un enlace único con el
     recordatorio: servía para avisar y para nada más. */
  function botonWhatsapp(c) {
    const caja = el('div', 'wa');
    const b = el('button', 'bt bt--wa');
    b.type = 'button';
    b.textContent = 'WhatsApp';
    const menu = el('div', 'wa__menu');
    menu.hidden = true;

    mensajes(c).forEach(m => {
      const a = document.createElement('a');
      a.className = 'wa__op' + (m.destacado ? ' wa__op--destacado' : '');
      a.href = enlaceWa(c, m.texto);
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      const r = el('strong'); r.textContent = m.rotulo;
      a.appendChild(r);
      if (m.texto) {
        const p = el('span');
        p.textContent = m.texto.length > 92 ? m.texto.slice(0, 92) + '…' : m.texto;
        a.appendChild(p);
      }
      a.addEventListener('click', () => { menu.hidden = true; });
      menu.appendChild(a);
    });

    b.addEventListener('click', e => {
      e.stopPropagation();
      /* Sin teléfono no hay a quién escribir. Se dice en vez de abrir un chat
         vacío con un número inventado. */
      if (!String(c.telefono || '').replace(/\D/g, '')) {
        avisar('Esta cita no tiene celular guardado.');
        return;
      }
      menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', () => { menu.hidden = true; });

    caja.append(b, menu);
    return caja;
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

    /* El pago y su comprobante, si ya se cobró. Antes había que irse a Facturas
       a comprobar si una transferencia tenía foto; ahora está donde se mira la
       cita. */
    const pago = $('#ficha-pago');
    pago.textContent = '';
    if (c.metodo_pago) {
      const fila = el('div', 'ficha__pagof');
      const r = el('span'); r.textContent = 'Cobrado · ' + (MEDIOS[c.metodo_pago] || c.metodo_pago);
      fila.appendChild(r);
      if (c.cobrado != null && c.cobrado !== c.total) {
        const d = el('em');
        d.textContent = c.cobrado > c.total ? '+' + money(c.cobrado - c.total)
                                            : '−' + money(c.total - c.cobrado);
        fila.appendChild(d);
      }
      pago.appendChild(fila);
      if (c.comprobante) {
        /* Mismo caso que en Facturas: era un <a> a una data: URL, que el
           navegador no abre. Va por el visor. */
        const b = el('button', 'ficha__vercomp');
        b.type = 'button';
        b.title = 'Ver el comprobante completo';
        const im = document.createElement('img');
        im.className = 'ficha__comp'; im.src = c.comprobante;
        im.alt = 'Comprobante de la transferencia de ' + c.cliente;
        b.appendChild(im);
        b.addEventListener('click', () => verComprobante(c.comprobante, c.cliente));
        pago.appendChild(b);
      } else if (c.metodo_pago === 'transferencia') {
        /* Una transferencia sin foto es un cobro que no se puede verificar.
           Se marca en vez de callarlo. */
        const f = el('div', 'ficha__falta');
        f.textContent = 'Sin comprobante adjunto';
        pago.appendChild(f);
      }
      pago.hidden = false;
    } else { pago.hidden = true; }

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
        const b = el('button', 'factura__vercomp');
        b.type = 'button';
        b.title = 'Ver el comprobante';
        const im = document.createElement('img');
        im.className = 'factura__comp'; im.src = f.comprobante;
        im.alt = 'Comprobante de la transferencia de ' + f.cliente;
        const lupa = el('span', 'factura__lupa'); lupa.textContent = 'Ver';
        b.append(im, lupa);
        b.addEventListener('click', () => verComprobante(f.comprobante, f.cliente));
        der.appendChild(b);
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
    /* El total junta servicios y productos porque es el dinero del día, pero
       el desglose importa: si la vitrina está aportando un tercio de la caja,
       eso cambia qué se repone y qué se deja de traer. */
    const desglose = $('#t-desglose');
    desglose.textContent = '';
    if (caja.totalProductos) {
      [['Servicios', caja.totalServicios], ['Productos', caja.totalProductos]].forEach(([rot, v]) => {
        const d = el('div', 'medida__f');
        const a2 = el('span'); a2.textContent = rot;
        const b2 = el('span'); b2.textContent = money(v);
        d.append(a2, b2); desglose.appendChild(d);
      });
    }

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
      if (Number.isFinite(Number(ajustes.meta))) META_LOCAL = Number(ajustes.meta);
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
    $('#aj-meta').value = META_LOCAL;
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
      /* El nombre es lo que ve el cliente en la web y en la reserva, así que
         se corrige aquí y no pidiendo que se toque la base. */
      const nom = el('input'); nom.type = 'text'; nom.value = p.nombre; mk('Nombre', nom);
      /* La foto no va con los demás campos porque no se escribe: se elige. */
      let fotoNueva;
      const lf = el('label', 'prof-fila__foto');
      lf.appendChild(document.createTextNode('Foto'));
      lf.appendChild(campoFoto(p.foto, dato => { fotoNueva = dato; guardar(); }));
      campos.appendChild(lf);

      const guardar = () => api('/panel/ajustes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesional: { id: p.id, comision: Number(com.value) / 100,
          entra: entra.value, sale: sale.value, activo: p.activo,
          nombre: nom.value.trim() || undefined,
          foto: fotoNueva || undefined,
          clave: clave.value || undefined } })
      }).then(() => {
        if (clave.value) { clave.value = ''; clave.placeholder = '•••••• (ya tiene)'; }
        p.nombre = nom.value.trim() || p.nombre;
        avisar('Guardado');
      }).catch(er => avisar(er.message));
      [com, entra, sale, clave, nom].forEach(i => i.addEventListener('change', guardar));

      f.append(cab, campos);
      e.appendChild(f);
    });
  }

  /* Selector de foto: miniatura + botón que abre la galería del aparato.

     Antes esto era una caja de texto donde había que escribir «assets/algo.jpg»,
     que es pedirle al local que sepa dónde viven los archivos del sitio y que
     además tenga acceso para subirlos. Con el selector, la foto se toma con el
     celular o se busca en el computador y ya está.

     Se encoge a 800 px antes de subirla. La tarjeta la enseña a 400 px de alto
     como mucho, así que 800 cubre las pantallas de doble densidad y de ahí para
     arriba solo se está pagando peso: la foto viaja en el catálogo que carga
     todo visitante de la página. */
  function campoFoto(valorActual, alCambiar) {
    const caja = el('div', 'fotocampo');

    const mini = el('div', 'fotocampo__mini');
    const pintar = v => {
      mini.textContent = '';
      if (v) {
        const img = document.createElement('img');
        img.src = v; img.alt = '';
        mini.appendChild(img);
      } else {
        mini.textContent = 'sin foto';
      }
    };
    pintar(valorActual);

    const boton = el('label', 'bt bt--mini fotocampo__bt');
    boton.textContent = valorActual ? 'Cambiar' : 'Poner foto';
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = 'image/*';
    entrada.className = 'sr-only';
    boton.appendChild(entrada);

    entrada.addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      boton.textContent = 'Subiendo…';
      try {
        const dato = await encoger(f, 800, 0.72);
        pintar(dato);
        boton.textContent = 'Cambiar';
        alCambiar(dato);
      } catch (err) {
        boton.textContent = 'Poner foto';
        avisar(err.message || 'No se pudo leer la foto');
      }
      entrada.value = '';
    });

    caja.append(mini, boton);
    return caja;
  }

  /* ---------- alta de profesional ---------- */
  let fotoNueva = null;

  $('#abrir-prof').addEventListener('click', () => {
    ['#pf-nombre', '#pf-clave'].forEach(x => { $(x).value = ''; });
    fotoNueva = null;
    const hueco = $('#pf-foto');
    hueco.textContent = '';
    hueco.appendChild(campoFoto(null, dato => { fotoNueva = dato; }));
    $('#pf-entra').value = '09:00';
    $('#pf-sale').value = '20:00';
    $('#pf-comision').value = 50;
    $('#pf-error').hidden = true;
    $('#dlg-prof').showModal();
  });

  $('#pf-guardar').addEventListener('click', async () => {
    const err = $('#pf-error');
    err.hidden = true;
    const nombre = $('#pf-nombre').value.trim();
    if (!nombre) { err.textContent = 'Ponle un nombre.'; err.hidden = false; return; }
    const clave = $('#pf-clave').value;
    if (clave && clave.length < 8) {
      err.textContent = 'La clave debe tener al menos 8 caracteres.'; err.hidden = false; return;
    }
    const btn = $('#pf-guardar');
    btn.disabled = true;
    try {
      await api('/panel/ajustes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesional: { nombre,
          comision: Number($('#pf-comision').value) / 100,
          entra: $('#pf-entra').value, sale: $('#pf-sale').value,
          foto: fotoNueva || null,
          clave: clave || undefined } }) });
      $('#dlg-prof').close();
      avisar(nombre + ' entró al equipo');
      cargarAjustes();
    } catch (e) {
      err.textContent = e.message || 'No se pudo añadir'; err.hidden = false;
    } finally { btn.disabled = false; }
  });

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

  $('#aj-meta-guardar').addEventListener('click', async () => {
    const v = Number($('#aj-meta').value);
    if (!Number.isFinite(v) || v < 0) { avisar('Esa meta no es válida'); return; }
    const antes = META_LOCAL;
    try {
      await api('/panel/ajustes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ meta: v }) });
      META_LOCAL = v;
      avisar('Meta guardada · ' + money(v), async () => {
        await api('/panel/ajustes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ meta: antes }) });
        META_LOCAL = antes; $('#aj-meta').value = antes; avisar('Meta anterior restaurada');
      });
    } catch (e) { avisar(e.message || 'No se pudo guardar'); }
  });


  /* Abre el comprobante dentro del panel.

     No se abre en pestaña nueva porque no se puede: el comprobante es una
     `data:` URL y los navegadores bloquean navegar a esas en el nivel
     superior —defensa contra phishing—. El enlace estaba puesto desde hace
     tiempo y al pulsarlo no ocurría nada.

     La descarga sí funciona con `download`, que es una ruta distinta y no está
     bloqueada. */
  function verComprobante(src, quien) {
    const cuerpo = $('#comp-cuerpo');
    cuerpo.textContent = '';
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Comprobante de la transferencia' + (quien ? ' de ' + quien : '');
    cuerpo.appendChild(img);
    $('#comp-tit').textContent = quien ? 'Comprobante · ' + quien : 'Comprobante';
    $('#comp-descargar').onclick = () => {
      const a = document.createElement('a');
      a.href = src;
      a.download = 'comprobante-' + (quien || 'transferencia').replace(/\s+/g, '-').toLowerCase() + '.jpg';
      a.click();
    };
    $('#dlg-comp').showModal();
  }


  /* =========================================================
     Finanzas
     =========================================================
     Junta las tres fuentes de dinero que vivían por separado —cobros de citas,
     ventas de inventario y lo anotado a mano— y las resta. Hasta ahora el panel
     sabía lo que entra pero no lo que sale, y con media ecuación la caja del
     día dice cuánto se facturó, no cuánto se ganó. */
  let finanzas = null;

  async function cargarFinanzas() {
    const r = rango();
    try {
      finanzas = await api('/panel/finanzas?desde=' + r.desde + '&hasta=' + r.hasta);
      pintarFinanzas();
    } catch (e) {
      $('#fin-desglose').textContent = e.message || 'No se pudo cargar.';
    }
  }

  function pintarFinanzas() {
    if (!finanzas) return;
    const f = finanzas;

    if (f.sinTablas) {
      $('#fin-desglose').textContent = 'Falta correr la migración 13 en la base.';
      return;
    }

    $('#fin-ingresos').textContent = money(f.ingresos.total);
    $('#fin-ingresos-det').textContent =
      f.ingresos.citas + (f.ingresos.citas === 1 ? ' cita' : ' citas') +
      (f.ingresos.ventas ? ' · ' + f.ingresos.ventas + ' ventas' : '');
    $('#fin-egresos').textContent = money(f.egresos.total);
    const cuantosEg = f.movimientos.filter(m => m.tipo === 'egreso').length;
    $('#fin-egresos-det').textContent = cuantosEg
      ? cuantosEg + (cuantosEg === 1 ? ' movimiento' : ' movimientos')
      : 'nada anotado';

    /* El neto puede ser negativo y hay que verlo: esconder un mes en rojo
       detrás de un cero no ayuda a nadie a decidir nada. */
    const neto = $('#fin-neto');
    neto.textContent = money(f.neto);
    neto.classList.toggle('es-rojo', f.neto < 0);
    $('#fin-neto-pie').textContent = f.neto < 0
      ? 'se gastó más de lo que entró'
      : 'ingresos menos egresos';

    /* --- de dónde sale --- */
    const d = $('#fin-desglose');
    d.textContent = '';
    const fuentes = [
      ['Servicios', f.ingresos.servicios],
      ['Productos', f.ingresos.productos],
      ['Otros ingresos', f.ingresos.otros]
    ].filter(x => x[1] > 0);

    if (!fuentes.length) {
      const v = el('div', 'vacio');
      const s = el('strong'); s.textContent = 'Sin ingresos en el periodo';
      const p = el('span'); p.textContent = 'Cambia el rango arriba para ver otro.';
      v.append(s, p); d.appendChild(v);
    } else {
      fuentes.forEach(([nombre, valor]) => {
        const fila = el('div', 'finfila');
        const n = el('span', 'finfila__n'); n.textContent = nombre;
        const b = el('div', 'finfila__b');
        const dentro = el('div');
        dentro.style.width = Math.round(valor / f.ingresos.total * 100) + '%';
        b.appendChild(dentro);
        const v2 = el('span', 'finfila__v'); v2.textContent = money(valor);
        fila.append(n, b, v2);
        d.appendChild(fila);
      });
    }

    /* --- en qué se va --- */
    const cats = Object.keys(f.egresos.porCategoria);
    if (cats.length) {
      const t = el('div', 'finfila__tit'); t.textContent = 'En qué se va';
      d.appendChild(t);
      cats.sort((a, b) => f.egresos.porCategoria[b] - f.egresos.porCategoria[a])
        .forEach(k => {
          const fila = el('div', 'finfila');
          const n = el('span', 'finfila__n'); n.textContent = k;
          const b = el('div', 'finfila__b finfila__b--eg');
          const dentro = el('div');
          dentro.style.width = Math.round(f.egresos.porCategoria[k] / f.egresos.total * 100) + '%';
          b.appendChild(dentro);
          const v2 = el('span', 'finfila__v'); v2.textContent = money(f.egresos.porCategoria[k]);
          fila.append(n, b, v2);
          d.appendChild(fila);
        });
    }

    /* --- meta --- */
    $('#fin-meta').value = f.meta.diaria;
    const objetivo = f.meta.periodo;
    const pct = objetivo > 0 ? Math.min(100, f.ingresos.total / objetivo * 100) : 0;
    $('#fin-meta-barra').style.width = pct + '%';
    $('#fin-meta-txt').textContent = objetivo === 0
      ? 'Sin meta fijada. Pon una cifra para medir contra ella.'
      : f.ingresos.total >= objetivo
        ? 'Meta cumplida · ' + money(objetivo) + ' en ' + f.rango.dias +
          (f.rango.dias === 1 ? ' día' : ' días')
        : 'Faltan ' + money(objetivo - f.ingresos.total) + ' para la meta de ' + money(objetivo);

    /* --- lo anotado --- */
    const c = $('#fin-movs');
    c.textContent = '';
    $('#fin-mov-resumen').textContent = f.movimientos.length
      ? f.movimientos.length + (f.movimientos.length === 1 ? ' movimiento' : ' movimientos')
      : '';

    if (!f.movimientos.length) {
      const v = el('div', 'vacio');
      const s = el('strong'); s.textContent = 'Nada anotado';
      const p = el('span');
      p.textContent = 'Anota aquí el arriendo, los insumos y lo que no entra por una cita.';
      v.append(s, p); c.appendChild(v);
      return;
    }

    f.movimientos.forEach(m => {
      const fila = el('div', 'movfila');
      const izq = el('div');
      const con = el('div', 'movfila__c'); con.textContent = m.concepto;
      const pie = el('div', 'movfila__p');
      pie.textContent = [fechaCorta(m.fecha), m.categoria, m.profesional].filter(Boolean).join(' · ');
      izq.append(con, pie);

      const der = el('div', 'movfila__d');
      const v = el('span', 'movfila__v' + (m.tipo === 'egreso' ? ' es-rojo' : ''));
      v.textContent = (m.tipo === 'egreso' ? '−' : '+') + money(m.monto).slice(1);
      der.appendChild(v);
      const q = boton('Quitar', () => borrarMovimiento(m));
      q.classList.add('bt--borrar');
      der.appendChild(q);

      fila.append(izq, der);
      c.appendChild(fila);
    });
  }

  const fechaCorta = f => {
    const d = new Date(String(f).slice(0, 10) + 'T12:00:00Z');
    return d.getUTCDate() + ' ' + MESES3[d.getUTCMonth()].toLowerCase();
  };

  async function borrarMovimiento(m) {
    try {
      await api('/panel/finanzas?id=' + m.id, { method: 'DELETE' });
      avisar('Movimiento quitado');
      cargarFinanzas();
    } catch (e) { avisar(e.message || 'No se pudo quitar'); }
  }

  /* ---------- anotar ---------- */
  let movTipo = 'egreso';

  $('#abrir-mov').addEventListener('click', () => {
    movTipo = 'egreso';
    $$('#mov-tipo .conmutador__b').forEach(b =>
      b.classList.toggle('is-on', b.dataset.tipo === 'egreso'));
    ['#mov-concepto', '#mov-monto', '#mov-categoria'].forEach(x => { $(x).value = ''; });
    $('#mov-fecha').value = ymd(new Date());
    $('#mov-error').hidden = true;
    $('#dlg-mov').showModal();
  });

  $$('#mov-tipo .conmutador__b').forEach(b => b.addEventListener('click', () => {
    movTipo = b.dataset.tipo;
    $$('#mov-tipo .conmutador__b').forEach(x => x.classList.toggle('is-on', x === b));
    $('#mov-tit').textContent = movTipo === 'egreso' ? 'Anotar egreso' : 'Anotar ingreso';
  }));

  $('#mov-guardar').addEventListener('click', async () => {
    const err = $('#mov-error');
    err.hidden = true;
    const concepto = $('#mov-concepto').value.trim();
    if (!concepto) {
      err.textContent = 'Escribe qué fue. Una cifra sin nombre no dice nada dentro de tres meses.';
      err.hidden = false; return;
    }
    const monto = Number($('#mov-monto').value);
    if (!Number.isFinite(monto) || monto <= 0) {
      err.textContent = 'Pon el monto.'; err.hidden = false; return;
    }
    const btn = $('#mov-guardar');
    btn.disabled = true;
    try {
      await api('/panel/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movimiento: { tipo: movTipo, concepto, monto,
          fecha: $('#mov-fecha').value, categoria: $('#mov-categoria').value.trim() || null } }) });
      $('#dlg-mov').close();
      avisar(movTipo === 'egreso' ? 'Egreso anotado' : 'Ingreso anotado');
      cargarFinanzas();
    } catch (e) {
      err.textContent = e.message || 'No se pudo anotar'; err.hidden = false;
    } finally { btn.disabled = false; }
  });

  $('#fin-meta-guardar').addEventListener('click', async () => {
    const v = Number($('#fin-meta').value);
    if (!Number.isFinite(v) || v < 0) { avisar('Esa meta no es válida'); return; }
    try {
      await api('/panel/ajustes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ meta: v }) });
      META_LOCAL = v;
      avisar('Meta guardada · ' + money(v));
      cargarFinanzas();
    } catch (e) { avisar(e.message || 'No se pudo guardar'); }
  });

  /* =========================================================
     Galería
     ========================================================= */
  let galeria = [], colaFotos = [];

  async function cargarGaleria() {
    try {
      const r = await api('/panel/galeria');
      galeria = r.fotos || [];
      pintarGaleria(r.sinTablas);
    } catch (e) {
      $('#g-lista').textContent = e.message || 'No se pudo cargar.';
    }
  }

  function pintarGaleria(sinTablas) {
    const c = $('#g-lista');
    c.textContent = '';
    $('#g-resumen').textContent = galeria.length
      ? galeria.length + (galeria.length === 1 ? ' foto' : ' fotos')
      : '';

    if (!galeria.length) {
      const v = el('div', 'vacio');
      const s = el('strong');
      const p = el('span');
      if (sinTablas) {
        s.textContent = 'Galería sin crear';
        p.textContent = 'Falta correr la migración 10 en la base.';
      } else {
        s.textContent = 'Sin fotos';
        p.textContent = 'Mientras no subas ninguna, la página enseña las cuatro que trae de fábrica.';
      }
      v.append(s, p); c.appendChild(v);
      return;
    }

    galeria.forEach((f, i) => {
      const caja = el('figure', 'galfoto');

      /* Un video se pinta como video también aquí: si se enseñara su primer
         fotograma en un <img> no se vería nada —un <img> no sabe leer mp4— y la
         miniatura saldría rota. */
      if (f.video) {
        const v = document.createElement('video');
        v.src = f.url; v.muted = true; v.loop = true; v.playsInline = true;
        v.preload = 'metadata';
        v.setAttribute('aria-label', f.alt);
        caja.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = f.mini || f.url; img.alt = f.alt; img.loading = 'lazy';
        caja.appendChild(img);
      }

      const pie = el('figcaption', 'galfoto__pie');
      pie.textContent = f.alt;
      caja.appendChild(pie);

      const bs = el('div', 'galfoto__b');
      /* Mover con flechas y no arrastrando: esto se va a usar desde el celular
         del dueño, y arrastrar en una pantalla táctil pelea con el desplazamiento
         de la página. Dos botones no fallan nunca. */
      const antes = boton('↑', () => mover(f.id, 'antes'));
      antes.disabled = i === 0;
      antes.title = 'Subir en el orden';
      const desp = boton('↓', () => mover(f.id, 'despues'));
      desp.disabled = i === galeria.length - 1;
      desp.title = 'Bajar en el orden';
      bs.append(antes, desp);

      bs.appendChild(boton('Texto', () => {
        const nuevo = prompt('¿Qué se ve en la foto?', f.alt);
        if (nuevo === null) return;
        api('/panel/galeria', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: f.id, alt: nuevo }) })
          .then(() => { avisar('Descripción cambiada'); cargarGaleria(); })
          .catch(e => avisar(e.message));
      }));

      const quitar = boton('Quitar', () => borrarFoto(f));
      quitar.classList.add('bt--borrar');
      bs.appendChild(quitar);

      caja.appendChild(bs);
      const kb = el('span', 'galfoto__kb');
      kb.textContent = f.kb + ' KB';
      caja.appendChild(kb);
      c.appendChild(caja);
    });
  }

  function mover(id, hacia) {
    api('/panel/galeria', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, mover: hacia }) })
      .then(() => cargarGaleria())
      .catch(e => avisar(e.message));
  }

  async function borrarFoto(f) {
    try {
      await api('/panel/galeria?id=' + f.id, { method: 'DELETE' });
      avisar('Foto quitada de la galería');
      cargarGaleria();
    } catch (e) { avisar(e.message || 'No se pudo quitar'); }
  }

  /* ---------- subir ---------- */
  /* 1400 px: la galería se amplía a pantalla completa al tocarla, así que hace
     falta más resolución que en una foto de perfil. Por encima de eso ya no se
     nota en pantalla y solo se paga en peso y en espera. */
  $('#g-archivo').addEventListener('change', async e => {
    const archivos = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if (!archivos.length) return;
    colaFotos = [];
    for (const a of archivos) {
      const esVideo = String(a.type || '').indexOf('video/') === 0;
      try {
        /* Un video no pasa por `encoger`: eso dibuja un fotograma en un lienzo
           y devuelve un JPEG, o sea que convertiría el clip en una foto fija.
           Va tal cual, y por eso el aviso de peso de abajo. */
        if (esVideo) {
          if (a.size > 6 * 1024 * 1024) {
            avisar(a.name + ' pesa ' + Math.round(a.size / 1024 / 1024) +
                   ' MB. Recórtalo a diez o quince segundos.');
            continue;
          }
          colaFotos.push({ nombre: a.name, video: true, dato: await comoDataUrl(a) });
        } else {
          /* Dos versiones de la misma foto: la grande para cuando se amplía y
             una de 600 px para la rejilla, que la enseña a 232. Sin esto, cada
             visitante se descargaba la grande cuatro veces seguidas para ver
             unas miniaturas. */
          colaFotos.push({
            nombre: a.name, video: false,
            dato: await encoger(a, 1400, 0.78),
            mini: await encoger(a, 600, 0.7)
          });
        }
      } catch (err) { avisar(err.message || 'No se pudo leer ' + a.name); }
    }
    siguienteFoto();
  });

  function comoDataUrl(archivo) {
    return new Promise((res, rej) => {
      const l = new FileReader();
      l.onload = () => res(l.result);
      l.onerror = () => rej(new Error('No se pudo leer ' + archivo.name));
      l.readAsDataURL(archivo);
    });
  }

  /* Se piden una a una en vez de subir todas de golpe porque cada una necesita
     su descripción, y una sola caja para cinco fotos acabaría con las cinco
     descritas igual —o con ninguna—. */
  function siguienteFoto() {
    if (!colaFotos.length) { cargarGaleria(); return; }
    const f = colaFotos[0];
    const previa = $('#gf-previa');
    previa.textContent = '';
    if (f.video) {
      const v = document.createElement('video');
      v.src = f.dato; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      previa.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = f.dato; img.alt = '';
      previa.appendChild(img);
    }
    $('#gf-alt').value = '';
    $('#gf-error').hidden = true;
    $('#gf-guardar').textContent = colaFotos.length > 1
      ? 'Publicar (quedan ' + colaFotos.length + ')' : 'Publicar en la galería';
    $('#dlg-foto').showModal();
    setTimeout(() => $('#gf-alt').focus(), 60);
  }

  $('#dlg-foto').addEventListener('close', () => {
    /* Cerrar con Cancelar o con Escape descarta la que estaba y sigue con el
       resto: obliga a decidir foto por foto, que es lo que se quiere. */
    if (colaFotos.length && $('#dlg-foto').returnValue === 'cancel') {
      colaFotos.shift();
      if (colaFotos.length) setTimeout(siguienteFoto, 120); else cargarGaleria();
    }
  });

  $('#gf-guardar').addEventListener('click', async () => {
    const err = $('#gf-error');
    err.hidden = true;
    const alt = $('#gf-alt').value.trim();
    if (!alt) {
      err.textContent = 'Escribe qué se ve. Sin esto la foto no existe para quien navega sin ver.';
      err.hidden = false;
      return;
    }
    const btn = $('#gf-guardar');
    btn.disabled = true;
    try {
      await api('/panel/galeria', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto: colaFotos[0].dato, mini: colaFotos[0].mini || null, alt }) });
      colaFotos.shift();
      $('#dlg-foto').close('ok');
      avisar('Foto publicada');
      if (colaFotos.length) setTimeout(siguienteFoto, 150); else cargarGaleria();
    } catch (e) {
      err.textContent = e.message || 'No se pudo publicar'; err.hidden = false;
    } finally { btn.disabled = false; }
  });

  /* =========================================================
     Inventario y venta de productos
     ========================================================= */
  let inv = null, pestanaProd = 'activos', buscaProd = '', prodEditando = null,
      prodVendiendo = null, prodEntrando = null, tipoMov = 'entrada',
      medioVenta = 'efectivo', compVenta = null;

  async function cargarInventario() {
    try {
      inv = await api('/panel/inventario');
      pintarInventario();
    } catch (e) {
      $('#i-lista').textContent = e.message || 'No se pudo cargar.';
    }
  }

  $$('.pestana[data-prod]').forEach(b => b.addEventListener('click', () => {
    pestanaProd = b.dataset.prod;
    $$('.pestana[data-prod]').forEach(x => x.classList.toggle('is-on', x === b));
    pintarInventario();
  }));

  $('#i-buscar').addEventListener('input', e => {
    buscaProd = e.target.value.trim().toLowerCase();
    $('#i-limpiar').hidden = !buscaProd;
    pintarInventario();
  });
  $('#i-limpiar').addEventListener('click', () => {
    buscaProd = ''; $('#i-buscar').value = ''; $('#i-limpiar').hidden = true; pintarInventario();
  });

  /* Un producto está «por pedir» cuando le queda igual o menos que su mínimo.
     El mínimo en cero significa que al local no le preocupa quedarse sin él. */
  const porPedir = p => p.activo && p.minimo > 0 && p.existencias <= p.minimo;

  function pintarInventario() {
    if (!inv) return;
    const todos = inv.productos || [];
    const activos = pestanaProd === 'activos';

    /* El aviso de faltantes se calcula sobre TODO el catálogo, no sobre lo
       filtrado: si dependiera del buscador, escribir una palabra escondería
       justo lo que hay que reponer. */
    const faltan = todos.filter(porPedir);
    const av = $('#i-porpedir');
    av.textContent = '';
    av.hidden = !faltan.length;
    if (faltan.length) {
      const t = el('strong');
      t.textContent = faltan.length === 1 ? 'Se está acabando' : 'Se están acabando ' + faltan.length;
      av.appendChild(t);
      const ul = el('div', 'porpedir__lista');
      faltan.forEach(p => {
        const s = el('button', 'porpedir__x');
        s.type = 'button';
        s.textContent = p.nombre + ' · ' + (p.existencias === 0 ? 'agotado' : 'quedan ' + p.existencias);
        s.addEventListener('click', () => abrirEntrada(p));
        ul.appendChild(s);
      });
      av.appendChild(ul);
    }

    const lista = todos
      .filter(p => !!p.activo === activos)
      .filter(p => !buscaProd ||
        (p.nombre + ' ' + (p.marca || '')).toLowerCase().indexOf(buscaProd) !== -1);

    const enVenta = todos.filter(p => p.activo);
    const valor = enVenta.reduce((t, p) => t + p.precio * p.existencias, 0);
    $('#i-resumen').textContent = buscaProd
      ? lista.length + (lista.length === 1 ? ' resultado' : ' resultados')
      : enVenta.length + (enVenta.length === 1 ? ' producto · ' : ' productos · ') +
        enVenta.reduce((t, p) => t + p.existencias, 0) + ' en vitrina · ' + money(valor) + ' en mercancía';
    $('#i-conteo').hidden = !buscaProd;
    $('#i-conteo').textContent = lista.length;

    const cont = $('#i-lista');
    cont.textContent = '';
    if (!lista.length) {
      const v = el('div', 'vacio');
      const s = el('strong');
      const p = el('span');
      if (buscaProd) {
        s.textContent = 'Nada con «' + buscaProd + '»';
        p.textContent = 'Prueba con parte del nombre o con la marca.';
      } else {
        s.textContent = inv.sinTablas ? 'Inventario sin crear'
                      : activos ? 'Sin productos' : 'Nada archivado';
        p.textContent = inv.sinTablas
          ? 'Las tablas del inventario todavía no están en la base. Hay que correr la migración 05.'
          : activos
          ? (ROL === 'dueno' ? 'Añade el primero para poder venderlo desde aquí.'
                             : 'El administrador todavía no ha cargado productos.')
          : 'Los productos que archives aparecen aquí.';
      }
      v.append(s, p); cont.appendChild(v);
    }

    lista.forEach(p => {
      const n = el('div', 'prod' + (porPedir(p) ? ' prod--falta' : '') +
                             (p.existencias === 0 ? ' prod--cero' : ''));
      const nm = el('div', 'prod__n');
      nm.textContent = p.nombre;
      if (p.marca) { const m = el('em'); m.textContent = ' · ' + p.marca; nm.appendChild(m); }

      const pr = el('div', 'prod__p'); pr.textContent = money(p.precio);

      const ex = el('div', 'prod__e');
      const num = el('strong'); num.textContent = p.existencias;
      const rot = el('span');
      rot.textContent = p.existencias === 0 ? 'agotado'
                      : p.existencias === 1 ? 'queda' : 'quedan';
      ex.append(num, rot);

      const de = el('div', 'prod__d');
      de.textContent = p.descripcion || (p.costo !== null && ROL === 'dueno'
        ? 'Costo ' + money(p.costo) + ' · deja ' + money(p.precio - p.costo) + ' por unidad'
        : 'Sin descripción.');

      const bs = el('div', 'prod__b');
      if (p.activo) {
        const vender = boton('Vender', () => abrirVenta(p));
        vender.classList.add('bt--vino');
        vender.disabled = p.existencias === 0;
        if (p.existencias === 0) vender.title = 'No queda ninguno en vitrina';
        bs.appendChild(vender);
      }
      if (ROL === 'dueno') {
        bs.appendChild(boton('Entrada', () => abrirEntrada(p)));
        bs.appendChild(boton('Editar', () => abrirProducto(p)));
        bs.appendChild(boton(p.activo ? 'Archivar' : 'Reactivar',
          () => guardarProducto({ id: p.id, precio: p.precio, costo: p.costo, minimo: p.minimo,
                                  marca: p.marca, activo: !p.activo },
            p.activo ? 'Producto archivado' : 'Producto reactivado')));
      }
      n.append(nm, pr, ex, de, bs);
      cont.appendChild(n);
    });

    pintarMovimientos();
  }

  const ROTULO_MOV = { venta: 'Venta', entrada: 'Entrada', ajuste: 'Corrección' };

  function pintarMovimientos() {
    /* El historial es de administración: el barbero vende y ya, no tiene por
       qué ver los costos ni el conteo del local. */
    $('#i-tarjeta-mov').hidden = ROL !== 'dueno';
    if (ROL !== 'dueno') return;
    const c = $('#i-movs');
    c.textContent = '';
    const movs = inv.movimientos || [];
    if (!movs.length) {
      const v = el('div', 'vacio');
      const s = el('strong'); s.textContent = 'Sin movimientos';
      const p = el('span'); p.textContent = 'Aquí queda cada venta y cada entrada de mercancía.';
      v.append(s, p); c.appendChild(v);
      return;
    }
    movs.forEach(m => {
      const f = el('div', 'mov mov--' + m.tipo);
      const q = el('span', 'mov__q');
      q.textContent = (m.cantidad > 0 ? '+' : '') + m.cantidad;
      const n = el('span', 'mov__n'); n.textContent = m.producto;
      const d = el('span', 'mov__d');
      const partes = [ROTULO_MOV[m.tipo] || m.tipo];
      if (m.total) partes.push(money(m.total));
      if (m.metodo_pago) partes.push(MEDIOS[m.metodo_pago] || m.metodo_pago);
      if (m.profesional) partes.push(m.profesional);
      if (m.nota) partes.push(m.nota);
      d.textContent = partes.join(' · ');
      const w = el('span', 'mov__c');
      const cu = new Date(m.creado);
      w.textContent = cu.getDate() + ' ' + MESES3[cu.getMonth()] + ' · ' + hora(m.creado);
      f.append(q, n, d, w);
      c.appendChild(f);
    });
  }

  /* ---------- alta y edición de producto ---------- */
  function abrirProducto(p) {
    prodEditando = p || null;
    $('#pr-titulo').textContent = p ? 'Editar producto' : 'Nuevo producto';
    $('#pr-nombre').value = p ? p.nombre : '';
    $('#pr-nombre').disabled = !!p;   // el id sale del nombre y ya hay movimientos colgando
    $('#pr-marca').value = p ? (p.marca || '') : '';
    $('#pr-precio').value = p ? p.precio : '';
    $('#pr-costo').value = p && p.costo !== null ? p.costo : '';
    $('#pr-minimo').value = p ? p.minimo : '';
    $('#pr-existencias').value = '';
    $('#pr-desc').value = p ? (p.descripcion || '') : '';
    $('#pr-lexist').hidden = !!p;
    $('#pr-nota-exist').hidden = !p;
    $('#pr-guardar').textContent = p ? 'Guardar cambios' : 'Añadir producto';
    /* Solo tiene sentido al editar: lo que aún no existe no se borra. */
    const borrar = $('#pr-borrar');
    borrar.hidden = !p;
    borrar.textContent = 'Eliminar producto';
    borrar.classList.remove('bt--confirmar');
    confirmandoBorrado = false;
    $('#pr-error').hidden = true;
    verMargen();
    $('#dlg-producto').showModal();
  }

  /* Enseñar lo que deja cada unidad mientras se escribe el precio evita la
     cuenta mental que nadie hace y que es justo la que decide si vale la pena
     tener el producto en la vitrina. */
  function verMargen() {
    const v = Number($('#pr-precio').value), c = $('#pr-costo').value;
    const hay = c !== '' && Number.isFinite(v) && v > 0;
    $('#pr-margen').hidden = !hay;
    if (hay) {
      const m = v - Number(c);
      $('#pr-margenv').textContent = money(m) + (v ? '  ·  ' + Math.round(m / v * 100) + '%' : '');
    }
  }
  ['#pr-precio', '#pr-costo'].forEach(s => $(s).addEventListener('input', verMargen));
  $('#abrir-producto').addEventListener('click', () => abrirProducto(null));

  /* Borrar es la única acción del panel que no ofrece deshacer, porque no hay
     nada que devolver: la fila deja de existir. Por eso aquí sí se confirma
     antes, y se hace en el mismo botón —que cambia de texto— en vez de con un
     diálogo encima de otro diálogo, que es donde la gente pulsa «sí» sin leer. */
  let confirmandoBorrado = false;

  $('#pr-borrar').addEventListener('click', async () => {
    const b = $('#pr-borrar');
    const err = $('#pr-error');
    if (!confirmandoBorrado) {
      confirmandoBorrado = true;
      b.textContent = 'Sí, eliminar';
      b.classList.add('bt--confirmar');
      /* Si se arrepiente y no hace nada, vuelve solo a su sitio. */
      setTimeout(() => {
        if (!confirmandoBorrado) return;
        confirmandoBorrado = false;
        b.textContent = 'Eliminar producto';
        b.classList.remove('bt--confirmar');
      }, 5000);
      return;
    }
    b.disabled = true;
    err.hidden = true;
    try {
      const r = await api('/panel/inventario?id=' + encodeURIComponent(prodEditando.id),
                          { method: 'DELETE' });
      $('#dlg-producto').close();
      avisar('Producto eliminado · ' + (r.nombre || prodEditando.nombre));
      cargarInventario();
    } catch (e) {
      err.textContent = e.message || 'No se pudo eliminar';
      err.hidden = false;
      confirmandoBorrado = false;
      b.textContent = 'Eliminar producto';
      b.classList.remove('bt--confirmar');
    } finally { b.disabled = false; }
  });

  async function guardarProducto(datos, texto) {
    try {
      await api('/panel/inventario', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                       body: JSON.stringify({ producto: datos }) });
      avisar(texto || 'Guardado');
      cargarInventario();
    } catch (e) { avisar(e.message || 'No se pudo guardar'); }
  }

  $('#pr-guardar').addEventListener('click', async () => {
    const err = $('#pr-error');
    err.hidden = true;
    const btn = $('#pr-guardar');
    const precio = Number($('#pr-precio').value);
    if (!Number.isFinite(precio) || precio <= 0) {
      err.textContent = 'Ponle un precio de venta.'; err.hidden = false; return;
    }
    const base = {
      marca: $('#pr-marca').value.trim() || null,
      descripcion: $('#pr-desc').value.trim(),
      precio: precio,
      costo: $('#pr-costo').value === '' ? null : Number($('#pr-costo').value),
      minimo: Number($('#pr-minimo').value) || 0
    };

    if (prodEditando) {
      btn.disabled = true;
      try {
        await guardarProducto(Object.assign({ id: prodEditando.id, activo: prodEditando.activo }, base),
                              'Producto actualizado');
        $('#dlg-producto').close();
      } finally { btn.disabled = false; }
      return;
    }

    const nombre = $('#pr-nombre').value.trim();
    if (!nombre) { err.textContent = 'Ponle un nombre al producto.'; err.hidden = false; return; }
    if ((inv && inv.productos || []).some(x => x.id === idDesde(nombre))) {
      err.textContent = 'Ya existe un producto con ese nombre.'; err.hidden = false; return;
    }
    btn.disabled = true;
    try {
      await api('/panel/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto: Object.assign({ nombre,
          existencias: Number($('#pr-existencias').value) || 0 }, base) }) });
      $('#dlg-producto').close();
      avisar('Producto añadido · ' + nombre);
      cargarInventario();
    } catch (e) {
      err.textContent = e.message || 'No se pudo añadir'; err.hidden = false;
    } finally { btn.disabled = false; }
  });

  /* ---------- entrada de mercancía y corrección de conteo ---------- */
  function abrirEntrada(p) {
    prodEntrando = p;
    tipoMov = 'entrada';
    $$('.pestana[data-mov]').forEach(x => x.classList.toggle('is-on', x.dataset.mov === 'entrada'));
    $('#en-quien').textContent = p.nombre + ' · hay ' + p.existencias + ' en vitrina';
    $('#en-cantidad').value = 1;
    $('#en-nota').value = '';
    $('#en-error').hidden = true;
    sincronizarMov();
    $('#dlg-entrada').showModal();
  }

  function sincronizarMov() {
    const ajuste = tipoMov === 'ajuste';
    $('#en-titulo').textContent = ajuste ? 'Corregir el conteo' : 'Entrada de mercancía';
    $('#en-lcant').firstChild.textContent = ajuste ? 'Diferencia contra lo que dice el panel '
                                                   : '¿Cuántas llegaron? ';
    /* En una entrada la cantidad solo puede sumar. En una corrección puede ir
       en las dos direcciones, que es justo para lo que sirve. */
    $('#en-cantidad').min = ajuste ? '-9999' : '1';
    $('#en-pista').textContent = ajuste
      ? 'Cuenta lo que hay de verdad y escribe la diferencia: −2 si faltan dos, +2 si sobran.'
      : 'Se suman a lo que ya hay.';
  }

  $$('.pestana[data-mov]').forEach(b => b.addEventListener('click', () => {
    tipoMov = b.dataset.mov;
    $$('.pestana[data-mov]').forEach(x => x.classList.toggle('is-on', x === b));
    sincronizarMov();
  }));

  $('#en-guardar').addEventListener('click', async () => {
    const err = $('#en-error');
    err.hidden = true;
    const cant = Math.round(Number($('#en-cantidad').value));
    if (!Number.isFinite(cant) || cant === 0) {
      err.textContent = 'Escribe cuántas unidades.'; err.hidden = false; return;
    }
    if (tipoMov === 'entrada' && cant < 0) {
      err.textContent = 'Una entrada suma. Para restar usa «Corregir conteo».';
      err.hidden = false; return;
    }
    const btn = $('#en-guardar');
    btn.disabled = true;
    try {
      const r = await api('/panel/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrada: { producto_id: prodEntrando.id, cantidad: cant,
                                          tipo: tipoMov, nota: $('#en-nota').value.trim() || null } }) });
      $('#dlg-entrada').close();
      avisar(prodEntrando.nombre + ' · quedan ' + r.quedan);
      cargarInventario();
    } catch (e) {
      err.textContent = e.message || 'No se pudo registrar'; err.hidden = false;
    } finally { btn.disabled = false; }
  });

  /* ---------- venta ---------- */
  function abrirVenta(p) {
    prodVendiendo = p;
    medioVenta = 'efectivo';
    compVenta = null;
    $('#ve-archivo').value = ''; $('#ve-nombre').textContent = '';
    $('#ve-quien').textContent = p.nombre + (p.marca ? ' · ' + p.marca : '');
    $('#ve-cantidad').value = 1;
    $('#ve-cantidad').max = p.existencias;
    $('#ve-precio').value = p.precio;

    /* Solo el dueño elige a quién se le apunta: el profesional se la apunta a
       sí mismo y el servidor lo obliga, así que enseñarle el selector sería
       ofrecerle algo que no puede hacer. */
    const lp = $('#ve-lprof');
    lp.hidden = ROL !== 'dueno';
    const sel = $('#ve-prof');
    sel.textContent = '';
    const cero = document.createElement('option');
    cero.value = ''; cero.textContent = 'Sin asignar';
    sel.appendChild(cero);
    ((datos && datos.profesionales) || (inv && inv.profesionales) || []).forEach(x => {
      const o = document.createElement('option');
      o.value = x.id; o.textContent = x.nombre;
      sel.appendChild(o);
    });

    const m = $('#ve-medios');
    m.textContent = '';
    Object.keys(MEDIOS).forEach(k => {
      const b = el('button', 'medio' + (k === medioVenta ? ' is-on' : ''));
      b.type = 'button'; b.textContent = MEDIOS[k];
      b.addEventListener('click', () => {
        medioVenta = k;
        m.querySelectorAll('.medio').forEach(x => x.classList.toggle('is-on', x === b));
        sincronizarVenta();
      });
      m.appendChild(b);
    });
    $('#ve-error').hidden = true;
    sincronizarVenta();
    $('#dlg-venta').showModal();
  }

  function sincronizarVenta() {
    if (!prodVendiendo) return;
    const hay = prodVendiendo.existencias;
    let cant = Math.round(Number($('#ve-cantidad').value)) || 1;
    /* La cantidad se recorta aquí mismo contra lo que hay: dejar escribir 10
       cuando quedan 3 solo sirve para que el servidor lo rechace después de
       que el cliente ya está esperando. */
    if (cant < 1) cant = 1;
    if (cant > hay) cant = hay;
    $('#ve-cantidad').value = cant;

    const unit = Number($('#ve-precio').value) || 0;
    $('#ve-total').textContent = money(unit * cant);
    $('#ve-quedan').textContent = 'quedan ' + (hay - cant) + ' de ' + hay;
    $('#ve-menos').disabled = cant <= 1;
    $('#ve-mas').disabled = cant >= hay;

    const pide = medioVenta === 'transferencia';
    $('#ve-comprobante').hidden = !pide;
    $('#ve-hecho').hidden = !compVenta;
    $('#ve-soltar').hidden = !!compVenta;
    if (compVenta) $('#ve-mini').src = compVenta;
    const falta = pide && !compVenta;
    const b = $('#ve-guardar');
    b.disabled = falta;
    b.title = falta ? 'Adjunta la foto del comprobante para registrar una transferencia' : '';
    const err = $('#ve-error');
    if (falta) {
      err.textContent = 'Adjunta la foto del comprobante para registrar una transferencia';
      err.hidden = false;
    } else if (err.textContent.startsWith('Adjunta la foto')) {
      err.hidden = true;
    }
  }

  ['#ve-cantidad', '#ve-precio'].forEach(s => $(s).addEventListener('input', sincronizarVenta));
  $('#ve-menos').addEventListener('click', () => {
    $('#ve-cantidad').value = Number($('#ve-cantidad').value) - 1; sincronizarVenta();
  });
  $('#ve-mas').addEventListener('click', () => {
    $('#ve-cantidad').value = Number($('#ve-cantidad').value) + 1; sincronizarVenta();
  });
  $('#ve-archivo').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      compVenta = await encoger(f);
      $('#ve-nombre').textContent = f.name;
      sincronizarVenta();
    } catch (err) {
      $('#ve-error').textContent = err.message; $('#ve-error').hidden = false;
    }
  });
  $('#ve-cambiar').addEventListener('click', () => {
    compVenta = null; $('#ve-archivo').value = ''; sincronizarVenta();
  });

  $('#ve-guardar').addEventListener('click', async () => {
    const err = $('#ve-error');
    err.hidden = true;
    const btn = $('#ve-guardar');
    btn.disabled = true;
    const cant = Number($('#ve-cantidad').value);
    try {
      const r = await api('/panel/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venta: { producto_id: prodVendiendo.id, cantidad: cant,
          precio_unit: Number($('#ve-precio').value), metodo_pago: medioVenta,
          comprobante: compVenta,
          profesional_id: ROL === 'dueno' ? ($('#ve-prof').value || null) : null } }) });
      $('#dlg-venta').close();
      avisar('Venta registrada · ' + money(r.total) + ' · quedan ' + r.quedan);
      cargarInventario();
    } catch (e) {
      err.textContent = e.message || 'No se pudo registrar'; err.hidden = false;
      /* Si falló por stock, el número que enseñamos ya no es el bueno. */
      if (e.estado === 409) cargarInventario();
    } finally { btn.disabled = false; }
  });

  /* =========================================================
     Cobro
     ========================================================= */
  let citaCobrando = null, medioElegido = 'efectivo', comprobante = null;

  /* La foto se encoge en el navegador antes de subirla. Una foto de celular
     pesa tres o cuatro megas y aquí solo hace falta poder leer el monto y la
     fecha del recibo: a 900 px de ancho se lee perfectamente y baja a unos
     100 KB, que es lo que hace viable guardarla junto a la cita. */
  /* Tope de entrada. No es el tamaño final —eso lo decide el encogedor— sino
     lo que se admite abrir: una foto de 40 MB hay que leerla entera antes de
     poder encogerla, y en un celular de gama media eso tumba la pestaña antes
     de llegar a la primera línea útil. */
  const TOPE_ENTRADA = 25 * 1024 * 1024;

  /* Encoge una foto antes de subirla.

     Reescrito. La versión anterior leía el archivo entero como data: URL, se lo
     daba a un <img> y de ahí al lienzo. Eso son TRES copias de la misma foto en
     memoria a la vez —el texto en base64, que ya pesa un tercio más que el
     archivo; el mapa de bits decodificado; y el lienzo—, y con una foto de
     celular moderno son cientos de megas para acabar guardando treinta kilos.
     En un teléfono viejo eso es una pestaña que se cierra sola.

     `createImageBitmap` decodifica desde el archivo sin pasar por texto, y
     `toBlob` devuelve el resultado sin bloquear la página como hace
     `toDataURL`. La orientación se pide explícitamente: una foto vertical de
     celular lleva la rotación en sus metadatos, y dibujada sin más sale
     tumbada. */
  async function encoger(archivo, max, calidad) {
    if (archivo.size > TOPE_ENTRADA) {
      throw new Error('Esa imagen pesa ' + Math.round(archivo.size / 1024 / 1024) +
                      ' MB. Es demasiado grande para procesarla en el navegador.');
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch (e) {
      throw new Error('Ese archivo no es una imagen que podamos usar');
    }

    const tope = max || 900;
    const escala = Math.min(1, tope / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext('2d').drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    /* Se suelta en cuanto se ha dibujado: es el objeto más pesado de los tres y
       si no se cierra a mano espera al recolector, que en una subida múltiple
       llega tarde. */
    bitmap.close();

    const blob = await new Promise(r => lienzo.toBlob(r, 'image/jpeg', calidad || 0.72));
    if (!blob) throw new Error('No se pudo procesar la foto');

    return await new Promise((res, rej) => {
      const l = new FileReader();
      l.onload = () => res(l.result);
      l.onerror = () => rej(new Error('No se pudo procesar la foto'));
      l.readAsDataURL(blob);
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

    /* La lista sale de la agenda del día, pero la agenda puede no haber
       llegado todavía —o haber fallado—, y entonces el selector quedaba vacío:
       un desplegable sin opciones, en rojo porque es obligatorio, y sin forma
       de llenarlo. Si falta, se piden los ajustes, que traen el equipo. */
    let equipo = (datos.profesionales || []).slice();
    if (!equipo.length) {
      try {
        if (!ajustes) await cargarAjustes();
        equipo = (ajustes && ajustes.equipo || []).filter(p => p.activo)
          .map(p => ({ id: p.id, nombre: p.nombre }));
      } catch (e) { /* se avisa abajo */ }
    }

    sel.textContent = '';
    equipo.forEach(p => {
      const o = document.createElement('option'); o.value = p.id; o.textContent = p.nombre;
      sel.appendChild(o);
    });

    if (!equipo.length) {
      /* Sin nadie a quien asignarle la cita no hay cita que crear. Se dice por
         qué en vez de dejar un formulario que va a rebotar al guardar. */
      $('#cr-error').textContent = 'No se pudo cargar el equipo. Recarga el panel; ' +
        'si sigue igual, revisa que haya profesionales activos en Disponibilidad.';
      $('#cr-error').hidden = false;
    }

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

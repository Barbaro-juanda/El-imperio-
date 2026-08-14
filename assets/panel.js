/* =========================================================
   Panel del local — agenda del día
   Escritorio: rejilla con una columna por profesional.
   Móvil: la misma información en lista.
   ========================================================= */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const ESTADOS = { confirmada: 'Confirmada', cumplida: 'Cumplida',
                    no_asistio: 'No asistió', cancelada: 'Cancelada' };

  const PASO = 15;   // minutos por fila; el mismo con el que la API ofrece cupos
  const SEGMENTOS = {
    cortes: 'Cortes', color: 'Color y tratamiento', depilacion: 'Depilación facial',
    cejas: 'Cejas', facial: 'Limpieza facial', unas: 'Uñas'
  };

  let dia = new Date();
  let datos = { citas: [], bloqueos: [], profesionales: [],
                horario: { abre: '09:00', cierra: '20:00', abierto: true },
                resumen: { total: 0, cuantas: 0 } };

  /* En el servidor de desarrollo local no existe /api —solo entrega archivos—,
     así que toda llamada devuelve 404 con una página HTML. Decir «Error 404»
     manda a buscar un fallo que no existe: se explica qué pasa de verdad. */
  const SIN_API = 'El panel necesita el sitio publicado. En local no se ejecutan las funciones del servidor.';

  async function api(ruta, opciones) {
    let r;
    try {
      r = await fetch('/api' + ruta, opciones);
    } catch (e) {
      throw Object.assign(new Error('Sin conexión.'), { estado: 0 });
    }
    let cuerpo = null;
    try { cuerpo = await r.json(); } catch (e) { /* no era JSON */ }
    if (!r.ok) {
      const msg = (cuerpo && cuerpo.error) ||
                  (r.status === 404 ? SIN_API : 'Error ' + r.status);
      throw Object.assign(new Error(msg), { estado: r.status });
    }
    return cuerpo;
  }

  /* ---------- entrada ---------- */
  $('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#login-error');
    err.hidden = true;
    try {
      await api('/panel/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: $('#clave').value })
      });
      $('#clave').value = '';
      abrirPanel();
    } catch (e2) {
      err.textContent = e2.message || 'No se pudo entrar';
      err.hidden = false;
    }
  });

  function abrirPanel() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    cargar();
  }

  $('#salir').addEventListener('click', async () => {
    await api('/panel/entrar', { method: 'DELETE' }).catch(() => {});
    location.reload();
  });

  $('#dia-ant').addEventListener('click', () => { dia.setDate(dia.getDate() - 1); cargar(); });
  $('#dia-sig').addEventListener('click', () => { dia.setDate(dia.getDate() + 1); cargar(); });
  $('#ir-hoy').addEventListener('click', () => { dia = new Date(); cargar(); });
  $('#dia-picker').addEventListener('change', e => {
    if (!e.target.value) return;
    /* Se construye con partes y no con new Date(cadena): interpretar
       «2026-08-14» como UTC adelanta un día en Colombia. */
    const [y, m, d2] = e.target.value.split('-').map(Number);
    dia = new Date(y, m - 1, d2);
    cargar();
  });

  /* ---------- carga ---------- */
  async function cargar() {
    cerrarFicha();
    pintarCabecera();
    $('#lista').textContent = '';
    $('#rejilla').textContent = '';
    const cargando = el('p', 'panel__vacio');
    cargando.textContent = 'Cargando…';
    $('#lista').appendChild(cargando);
    try {
      datos = await api('/panel/agenda?fecha=' + ymd(dia));
      pintar();
    } catch (e) {
      /* 401 = la sesión caducó a mitad de jornada; se vuelve a pedir clave en
         vez de dejar la pantalla en blanco. */
      if (e.estado === 401) { $('#app').hidden = true; $('#login').hidden = false; return; }
      $('#lista').textContent = '';
      const p = el('p', 'panel__vacio');
      p.textContent = e.message || 'No se pudo cargar la agenda.';
      $('#lista').appendChild(p);
    }
  }

  function pintarCabecera() {
    const hoy = ymd(new Date()) === ymd(dia);
    $('#dia-picker').value = ymd(dia);
    $('#dia-titulo').textContent = (hoy ? 'Hoy · ' : '') +
      DIAS[dia.getDay()] + ' ' + dia.getDate() + ' de ' + MESES[dia.getMonth()];
  }

  function pintar() {
    pintarCabecera();
    const r = datos.resumen || { total: 0, cuantas: 0 };
    $('#dia-resumen').textContent = r.cuantas
      ? r.cuantas + (r.cuantas === 1 ? ' cita · ' : ' citas · ') + '$' + r.total.toLocaleString('es-CO')
      : (datos.horario && datos.horario.abierto ? 'Sin citas' : 'Cerrado');
    pintarRejilla();
    pintarLista();
  }

  const hora = iso => new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(iso));

  /* Minutos desde medianoche, en hora de Bogotá. La aritmética de la rejilla
     tiene que hacerse en hora local del local, no en la del navegador de quien
     mira: si el dueño abre el panel desde otro país, las citas seguirían
     dibujándose donde corresponde. */
  function minutosLocales(iso) {
    const [h, m] = hora(iso).split(':').map(Number);
    return h * 60 + m;
  }
  const aMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

  /* ---------- rejilla (escritorio) ---------- */
  function pintarRejilla() {
    const g = $('#rejilla');
    g.textContent = '';

    const profs = datos.profesionales || [];
    if (!profs.length) return;

    const abre = aMin(datos.horario.abre);
    let cierra = aMin(datos.horario.cierra);
    if (cierra <= abre) cierra += 24 * 60;      // cierre pasada la medianoche
    const filas = Math.ceil((cierra - abre) / PASO);

    g.style.setProperty('--cols', profs.length);

    // Cabecera
    const esquina = el('div', 'rejilla__cab rejilla__cab--esquina');
    g.appendChild(esquina);
    profs.forEach(p => {
      const c = el('div', 'rejilla__cab');
      c.textContent = p.nombre.split(' ')[0];
      const s = el('small');
      const n = datos.citas.filter(x => x.profesional_id === p.id &&
                  (x.estado === 'confirmada' || x.estado === 'cumplida')).length;
      s.textContent = n ? n + (n === 1 ? ' cita' : ' citas') : 'libre';
      c.appendChild(s);
      g.appendChild(c);
    });

    // Filas de horas y celdas vacías
    for (let f = 0; f < filas; f++) {
      const min = abre + f * PASO;
      const enPunto = min % 60 === 0;
      const h = el('div', 'rejilla__hora' + (enPunto ? ' rejilla__hora--enpunto' : ''));
      h.style.gridRow = String(f + 2);
      const sp = el('span');
      sp.textContent = pad(Math.floor(min / 60) % 24) + ':' + pad(min % 60);
      h.appendChild(sp);
      g.appendChild(h);

      profs.forEach((p, i) => {
        const c = el('div', 'rejilla__celda' + (enPunto ? ' rejilla__celda--enpunto' : ''));
        c.style.gridRow = String(f + 2);
        c.style.gridColumn = String(i + 2);
        /* Tocar el hueco es la forma natural de agendar: ya dice quién y a qué
           hora, así que el formulario abre con eso resuelto. */
        c.title = 'Crear cita · ' + p.nombre.split(' ')[0] + ' ' + pad(Math.floor(min / 60) % 24) + ':' + pad(min % 60);
        const hhmm = pad(Math.floor(min / 60) % 24) + ':' + pad(min % 60);
        c.addEventListener('click', () => abrirCrear(p.id, hhmm));
        c.addEventListener('dragover', ev => {
          if (!arrastrando) return;
          ev.preventDefault();
          c.classList.add('destino');
        });
        c.addEventListener('dragleave', () => c.classList.remove('destino'));
        c.addEventListener('drop', ev => {
          ev.preventDefault();
          c.classList.remove('destino');
          if (arrastrando) mover(arrastrando.id, hhmm, p.id);
        });
        g.appendChild(c);
      });
    }

    // Bloques de cita
    datos.citas.forEach(c => {
      const col = profs.findIndex(p => p.id === c.profesional_id);
      if (col === -1) return;
      const ini = minutosLocales(c.inicio);
      const fin = minutosLocales(c.fin);
      const b = el('button', 'bloque bloque--' + c.estado);
      b.type = 'button';
      b.style.gridColumn = String(col + 2);
      b.style.gridRow = (Math.round((ini - abre) / PASO) + 2) + ' / span ' +
                        Math.max(1, Math.round((fin - ini) / PASO));
      const n = el('strong'); n.textContent = c.cliente;
      const s = el('em');     s.textContent = c.servicios || '—';
      b.append(n, s);
      b.addEventListener('click', () => abrirFicha(c));
      /* Solo se arrastra lo que sigue en pie: mover una cita cumplida o
         cancelada no significa nada. */
      if (c.estado === 'confirmada') {
        b.draggable = true;
        b.addEventListener('dragstart', ev => {
          arrastrando = c;
          b.classList.add('arrastrando');
          ev.dataTransfer.effectAllowed = 'move';
          ev.dataTransfer.setData('text/plain', String(c.id));
        });
        b.addEventListener('dragend', () => { arrastrando = null; b.classList.remove('arrastrando'); });
      }
      g.appendChild(b);
    });

    // Bloqueos
    (datos.bloqueos || []).forEach(bq => {
      const ini = minutosLocales(bq.inicio);
      const fin = minutosLocales(bq.fin);
      const cols = bq.profesional_id === null
        ? profs.map((_, i) => i)
        : [profs.findIndex(p => p.id === bq.profesional_id)].filter(i => i !== -1);
      cols.forEach(i => {
        const b = el('div', 'bloque bloque--bloqueo');
        b.style.gridColumn = String(i + 2);
        b.style.gridRow = (Math.round((ini - abre) / PASO) + 2) + ' / span ' +
                          Math.max(1, Math.round((fin - ini) / PASO));
        b.textContent = bq.motivo || 'Bloqueado';
        g.appendChild(b);
      });
    });

    // Línea de «ahora», solo si el día que se mira es hoy
    if (ymd(new Date()) === ymd(dia)) {
      const ahoraMin = minutosLocales(new Date().toISOString());
      if (ahoraMin >= abre && ahoraMin <= cierra) {
        const linea = el('div', 'ahora');
        linea.style.gridRow = String(Math.round((ahoraMin - abre) / PASO) + 2);
        g.appendChild(linea);
      }
    }
  }

  /* ---------- lista (móvil) ---------- */
  function pintarLista() {
    const lista = $('#lista');
    lista.textContent = '';

    const filas = [
      ...datos.citas.map(c => ({ t: new Date(c.inicio).getTime(), tipo: 'cita', d: c })),
      ...(datos.bloqueos || []).map(b => ({ t: new Date(b.inicio).getTime(), tipo: 'bloqueo', d: b }))
    ].sort((a, b) => a.t - b.t);

    if (!filas.length) {
      const p = el('p', 'panel__vacio');
      p.textContent = datos.horario && datos.horario.abierto
        ? 'Ninguna cita este día.' : 'El local no abre este día.';
      lista.appendChild(p);
      return;
    }
    filas.forEach(f => lista.appendChild(f.tipo === 'cita' ? tarjetaCita(f.d) : tarjetaBloqueo(f.d)));
  }

  function tarjetaCita(c) {
    const n = el('article', 'cita cita--' + c.estado);

    const cab = el('div', 'cita__cab');
    const h = el('span', 'cita__hora');
    h.textContent = hora(c.inicio) + '–' + hora(c.fin);
    const prof = el('span', 'cita__prof');
    prof.textContent = c.profesional;
    cab.append(h, prof);

    const cli = el('div', 'cita__cliente');
    cli.textContent = c.cliente;
    const serv = el('div', 'cita__serv');
    serv.textContent = c.servicios || '—';

    const pie = el('div', 'cita__pie');
    const tot = el('span', 'cita__total');
    tot.textContent = '$' + (c.total || 0).toLocaleString('es-CO');
    const est = el('span', 'cita__estado');
    est.textContent = ESTADOS[c.estado] || c.estado;
    pie.append(tot, est, acciones(c));

    n.append(cab, cli, serv, pie);
    return n;
  }

  function tarjetaBloqueo(b) {
    const n = el('div', 'bloqueo');
    const t = el('span');
    t.textContent = hora(b.inicio) + '–' + hora(b.fin) + ' · ' + (b.motivo || 'Bloqueado');
    n.appendChild(t);
    const quitar = el('button', 'cita__btn');
    quitar.type = 'button';
    quitar.textContent = 'Quitar';
    quitar.style.marginLeft = 'auto';
    quitar.addEventListener('click', async () => {
      await api('/panel/bloqueo?id=' + b.id, { method: 'DELETE' }).catch(() => {});
      cargar();
    });
    n.appendChild(quitar);
    return n;
  }

  /* ---------- acciones compartidas por lista y ficha ---------- */
  function acciones(c) {
    const btns = el('div', 'cita__btns');

    /* WhatsApp por enlace directo: abre el chat con el mensaje escrito y sale
       del número real del local. Sin API de Meta y sin costo por mensaje. */
    const wa = el('a', 'cita__btn cita__btn--wa');
    wa.href = 'https://wa.me/' + String(c.telefono).replace(/\D/g, '') +
              '?text=' + encodeURIComponent(mensaje(c));
    wa.target = '_blank';
    wa.rel = 'noopener noreferrer';
    wa.textContent = 'WhatsApp';
    btns.appendChild(wa);

    if (c.estado === 'confirmada') {
      /* Marcar cumplida pasa por el cobro: si el estado se pudiera cerrar sin
         registrar cuánto entró, la caja del día quedaría siempre incompleta y
         el panel volvería a ser solo una lista. */
      btns.appendChild(boton('Cobrar', () => abrirCobro(c)));
      btns.appendChild(boton('No vino', () => cambiar(c.id, 'no_asistio')));
      btns.appendChild(boton('Cancelar', () => {
        if (confirm('¿Cancelar la cita de ' + c.cliente + '? La hora vuelve a quedar libre.')) {
          cambiar(c.id, 'cancelada');
        }
      }));
    } else {
      btns.appendChild(boton('Deshacer', () => cambiar(c.id, 'confirmada')));
    }
    return btns;
  }

  function mensaje(c) {
    return '¡Hola ' + c.cliente + '! Te recordamos tu cita en The Imperial Clasic ' +
           'el ' + DIAS[new Date(c.inicio).getDay()].toLowerCase() + ' a las ' + hora(c.inicio) +
           ' con ' + c.profesional + '. Código: ' + c.codigo + '. ¿Nos confirmas?';
  }

  function boton(texto, onClick) {
    const b = el('button', 'cita__btn');
    b.type = 'button';
    b.textContent = texto;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await onClick(); } finally { b.disabled = false; }
    });
    return b;
  }

  async function cambiar(id, estado) {
    try {
      await api('/panel/cita', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado })
      });
      await cargar();
    } catch (e) {
      alert(e.message || 'No se pudo actualizar');
    }
  }

  /* ---------- ficha ---------- */
  function abrirFicha(c) {
    $('#ficha-cliente').textContent = c.cliente;
    $('#ficha-cuando').textContent =
      hora(c.inicio) + '–' + hora(c.fin) + ' · ' + c.profesional + ' · ' + (ESTADOS[c.estado] || c.estado);
    const tel = $('#ficha-tel');
    tel.textContent = c.telefono;
    $('#ficha-serv').textContent = c.servicios || '—';
    $('#ficha-total').textContent = '$' + (c.total || 0).toLocaleString('es-CO');
    const cont = $('#ficha-btns');
    cont.textContent = '';
    cont.appendChild(acciones(c));
    $('#ficha').hidden = false;
  }
  function cerrarFicha() { const f = $('#ficha'); if (f) f.hidden = true; }
  $('#ficha-cerrar').addEventListener('click', cerrarFicha);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarFicha(); });


  /* =========================================================
     Crear cita desde el mostrador
     El local agenda a quien llama o entra caminando, que es la mayor parte de
     su negocio. Sin esto el panel solo mira; con esto, trabaja.
     ========================================================= */
  let CATALOGO = [];        // se pide una vez: no cambia entre días
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

    const profs = datos.profesionales || [];
    const selP = $('#cr-prof');
    selP.textContent = '';
    profs.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.nombre;
      selP.appendChild(o);
    });
    if (profId) selP.value = String(profId);
    $('#cr-hora').value = hhmm || '';

    await catalogo();
    pintarServicios();
    buscarClientes('');
    $('#dlg-crear').showModal();
  }

  /* Solo se ofrecen los servicios que ese profesional presta: elegir uno que
     no hace y descubrirlo al guardar es hacerle perder el tiempo. */
  function pintarServicios() {
    const prof = Number($('#cr-prof').value);
    const sel = $('#cr-serv');
    const antes = sel.value;
    sel.textContent = '';
    let grupo = null, og = null;
    CATALOGO.filter(s => (s.profesionales || []).map(Number).includes(prof)).forEach(s => {
      if (s.segmento !== grupo) {
        grupo = s.segmento;
        og = document.createElement('optgroup');
        og.label = SEGMENTOS[grupo] || grupo;
        sel.appendChild(og);
      }
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.nombre + (s.precio ? ' · $' + s.precio.toLocaleString('es-CO') : '');
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

  /* Desde el botón no hay hueco que dé contexto: se abre en la próxima marca
     de cuarto de hora, que es lo que casi siempre se quiere al agendar a
     alguien que acaba de entrar. */
  $('#abrir-crear').addEventListener('click', () => {
    const ahora = new Date();
    const m = Math.ceil((ahora.getHours() * 60 + ahora.getMinutes()) / PASO) * PASO;
    abrirCrear(null, pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60));
  });

  $('#cr-prof').addEventListener('change', pintarServicios);
  $('#cr-serv').addEventListener('change', sincronizarDuracion);

  /* ---- cliente ---- */
  let tBusca = null;
  $('#cr-buscar').addEventListener('input', e => {
    clearTimeout(tBusca);
    const q = e.target.value;
    tBusca = setTimeout(() => buscarClientes(q), 220);
  });

  async function buscarClientes(q) {
    const ul = $('#cr-lista');
    try {
      const r = await api('/panel/clientes?q=' + encodeURIComponent(q));
      ul.textContent = '';
      (r.clientes || []).forEach(c => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = c.nombre;
        const s = document.createElement('small');
        s.textContent = c.telefono || 'sin celular';
        b.appendChild(s);
        b.addEventListener('click', () => elegirCliente(c));
        li.appendChild(b);
        ul.appendChild(li);
      });
    } catch (e) { ul.textContent = ''; }
  }

  function elegirCliente(c) {
    clienteElegido = c;
    const p = $('#cr-elegido');
    p.textContent = c.nombre + (c.telefono ? ' · ' + c.telefono : '');
    const q = document.createElement('button');
    q.type = 'button';
    q.textContent = 'cambiar';
    q.addEventListener('click', limpiarCliente);
    p.appendChild(q);
    p.hidden = false;
    $('#cr-buscar').hidden = true;
    $('#cr-lista').hidden = true;
    $('#cr-nuevo').hidden = true;
  }

  function limpiarCliente() {
    clienteElegido = null;
    $('#cr-elegido').hidden = true;
    $('#cr-buscar').hidden = false;
    $('#cr-buscar').value = '';
    $('#cr-lista').hidden = false;
    $('#cr-nuevo').hidden = false;
    $('#cr-nombre').value = '';
    $('#cr-tel').value = '';
  }

  $('#cr-guardar').addEventListener('click', async () => {
    const err = $('#cr-error');
    err.hidden = true;
    const btn = $('#cr-guardar');
    btn.disabled = true;
    try {
      const cuerpo = {
        fecha: ymd(dia),
        hora: $('#cr-hora').value,
        minutos: Number($('#cr-min').value),
        servicios: [$('#cr-serv').value].filter(Boolean),
        profesional: Number($('#cr-prof').value)
      };
      if (clienteElegido) cuerpo.cliente_id = clienteElegido.id;
      else { cuerpo.nombre = $('#cr-nombre').value; cuerpo.telefono = $('#cr-tel').value; }

      await api('/panel/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      });
      $('#dlg-crear').close();
      cargar();
    } catch (e) {
      err.textContent = e.message || 'No se pudo crear la cita';
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });


  /* =========================================================
     Reprogramar arrastrando
     ========================================================= */
  let arrastrando = null;

  async function mover(id, hhmm, profId) {
    try {
      await api('/panel/mover', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fecha: ymd(dia), hora: hhmm, profesional: profId })
      });
      cargar();
    } catch (e) {
      alert(e.message || 'No se pudo mover la cita');
      cargar();   // devuelve el bloque a su sitio
    }
  }

  /* =========================================================
     Cobro
     ========================================================= */
  let citaCobrando = null;

  function abrirCobro(c) {
    citaCobrando = c;
    $('#co-quien').textContent = c.cliente + ' · ' + (c.servicios || '—');
    /* Se propone lo que valía al reservar, pero se puede cambiar: un descuento
       o un servicio que se alargó hacen que lo cobrado difiera. */
    $('#co-valor').value = c.total || 0;
    $('#co-metodo').value = 'efectivo';
    $('#co-error').hidden = true;
    $('#dlg-cobro').showModal();
  }

  $('#co-guardar').addEventListener('click', async () => {
    const err = $('#co-error');
    err.hidden = true;
    try {
      await api('/panel/cobrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cita_id: citaCobrando.id,
          cobrado: Number($('#co-valor').value),
          metodo_pago: $('#co-metodo').value
        })
      });
      $('#dlg-cobro').close();
      cerrarFicha();
      cargar();
    } catch (e) {
      err.textContent = e.message || 'No se pudo registrar';
      err.hidden = false;
    }
  });

  /* =========================================================
     Vistas: agenda / caja / ajustes
     ========================================================= */
  const money = n => '$' + Number(n || 0).toLocaleString('es-CO');
  const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia',
                    tarjeta: 'Tarjeta', otro: 'Otro' };

  function mostrarVista(cual) {
    $('#vista-caja').hidden = cual !== 'caja';
    $('#vista-ajustes').hidden = cual !== 'ajustes';
    const agenda = cual === 'agenda';
    document.querySelector('.rejilla-wrap').style.display = agenda ? '' : 'none';
    $('#lista').style.display = agenda ? '' : 'none';
    if (cual === 'caja') cargarCaja();
    if (cual === 'ajustes') cargarAjustes();
  }

  $('#ver-caja').addEventListener('click', () => mostrarVista('caja'));
  $('#ver-ajustes').addEventListener('click', () => mostrarVista('ajustes'));
  $('#ir-hoy').addEventListener('click', () => mostrarVista('agenda'));

  function tabla(cabeceras, filas) {
    const t = el('table', 'tabla');
    const thead = el('thead'); const tr = el('tr');
    cabeceras.forEach(h => {
      const th = el('th', h.num ? 'num' : '');
      th.textContent = h.t || h;
      tr.appendChild(th);
    });
    thead.appendChild(tr); t.appendChild(thead);
    const tb = el('tbody');
    filas.forEach(f => {
      const r = el('tr');
      f.forEach(celda => {
        const td = el('td', celda && celda.num ? 'num' : '');
        if (celda && celda.nodo) td.appendChild(celda.nodo);
        else { td.textContent = celda && celda.t !== undefined ? celda.t : celda; if (celda && celda.fuerte) td.className += ' fuerte'; }
        r.appendChild(td);
      });
      tb.appendChild(r);
    });
    t.appendChild(tb);
    return t;
  }

  async function cargarCaja() {
    const cont = $('#caja-cuerpo');
    cont.textContent = 'Cargando…';
    try {
      const d = await api('/panel/caja?fecha=' + ymd(dia));
      cont.textContent = '';

      const tot = el('p', 'vista__nota');
      tot.innerHTML = '';
      tot.textContent = d.cobros.length
        ? d.cobros.length + (d.cobros.length === 1 ? ' cobro · ' : ' cobros · ') + money(d.total)
        : 'Todavía no ha entrado nada hoy.';
      cont.appendChild(tot);
      if (!d.cobros.length) return;

      cont.appendChild(el('h3')).textContent = 'Por forma de pago';
      cont.appendChild(tabla(['Forma', { t: 'Valor', num: true }],
        Object.keys(d.porMetodo).map(k => [METODOS[k] || k, { t: money(d.porMetodo[k]), num: true, fuerte: true }])));

      cont.appendChild(el('h3')).textContent = 'Por profesional';
      cont.appendChild(tabla(
        ['Profesional', { t: 'Citas', num: true }, { t: 'Cobrado', num: true }, { t: 'Comisión', num: true }, { t: 'A pagar', num: true }],
        d.porProfesional.map(p => [p.nombre, { t: p.cuantas, num: true }, { t: money(p.bruto), num: true },
                                   { t: Math.round(p.comision * 100) + '%', num: true },
                                   { t: money(p.pagar), num: true, fuerte: true }])));

      cont.appendChild(el('h3')).textContent = 'Detalle';
      cont.appendChild(tabla(['Hora', 'Cliente', 'Servicios', 'Profesional', 'Pago', { t: 'Valor', num: true }],
        d.cobros.map(c => [hora(c.cobrado_en), c.cliente, c.servicios, c.profesional,
                           METODOS[c.metodo_pago] || c.metodo_pago, { t: money(c.cobrado), num: true }])));
    } catch (e) {
      cont.textContent = e.message || 'No se pudo cargar la caja.';
    }
  }

  async function cargarAjustes() {
    const hCont = $('#aj-horario'), sCont = $('#aj-servicios');
    hCont.textContent = 'Cargando…'; sCont.textContent = '';
    try {
      const d = await api('/panel/ajustes');
      hCont.textContent = '';

      hCont.appendChild(tabla(['Día', 'Abre', 'Cierra', 'Abierto'],
        d.horario.map(h => {
          const abre = el('input'); abre.type = 'time'; abre.value = h.abre;
          const cierra = el('input'); cierra.type = 'time'; cierra.value = h.cierra;
          const ab = el('input'); ab.type = 'checkbox'; ab.checked = h.abierto; ab.style.minHeight = 'auto'; ab.style.width = 'auto';
          const guardar = () => api('/panel/ajustes', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ horario: { dow: h.dow, abre: abre.value, cierra: cierra.value, abierto: ab.checked } })
          }).catch(e => alert(e.message));
          [abre, cierra].forEach(i => i.addEventListener('change', guardar));
          ab.addEventListener('change', guardar);
          return [DIAS[h.dow], { nodo: abre }, { nodo: cierra }, { nodo: ab }];
        })));

      sCont.appendChild(tabla(['Servicio', 'Segmento', { t: 'Precio', num: true }, { t: 'Minutos', num: true }, 'Activo'],
        d.servicios.map(sv => {
          const precio = el('input'); precio.type = 'number'; precio.step = '1000'; precio.min = '0';
          precio.value = sv.precio === null ? '' : sv.precio;
          precio.placeholder = 'a convenir';
          const min = el('input'); min.type = 'number'; min.min = '5'; min.max = '600'; min.step = '5'; min.value = sv.minutos;
          const act = el('input'); act.type = 'checkbox'; act.checked = sv.activo; act.style.minHeight = 'auto'; act.style.width = 'auto';
          const guardar = () => api('/panel/ajustes', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicio: { id: sv.id, precio: precio.value === '' ? null : Number(precio.value),
                                               minutos: Number(min.value), activo: act.checked } })
          }).then(() => { CATALOGO = []; }).catch(e => alert(e.message));
          [precio, min].forEach(i => i.addEventListener('change', guardar));
          act.addEventListener('change', guardar);
          return [sv.nombre, SEGMENTOS[sv.segmento] || sv.segmento, { nodo: precio, num: true }, { nodo: min, num: true }, { nodo: act }];
        })));
    } catch (e) {
      hCont.textContent = e.message || 'No se pudo cargar.';
    }
  }

  /* ---------- bloquear horas ---------- */
  const dlg = $('#dlg-bloqueo');
  $('#abrir-bloqueo').addEventListener('click', () => {
    const sel = $('#bq-prof');
    /* El equipo ya viene con la agenda; no hace falta pedirlo aparte. */
    if (sel.options.length === 1) {
      (datos.profesionales || []).forEach(p => {
        const o = document.createElement('option');
        o.value = p.id; o.textContent = p.nombre;
        sel.appendChild(o);
      });
    }
    $('#bq-error').hidden = true;
    dlg.showModal();
  });

  $('#bq-guardar').addEventListener('click', async () => {
    const err = $('#bq-error');
    err.hidden = true;
    try {
      await api('/panel/bloqueo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profesional_id: $('#bq-prof').value || null,
          fecha: ymd(dia),
          desde: $('#bq-desde').value,
          hasta: $('#bq-hasta').value,
          motivo: $('#bq-motivo').value
        })
      });
      dlg.close();
      cargar();
    } catch (e) {
      err.textContent = e.message || 'No se pudo bloquear';
      err.hidden = false;
    }
  });

  /* Si la cookie sigue viva se entra directo, sin volver a teclear la clave. */
  api('/panel/agenda?fecha=' + ymd(dia)).then(abrirPanel).catch(() => {});
})();

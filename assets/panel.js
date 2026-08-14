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
      btns.appendChild(boton('Cumplida', () => cambiar(c.id, 'cumplida')));
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

/* =========================================================
   Panel del local — agenda del día
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

  let dia = new Date();
  let datos = { citas: [], bloqueos: [], resumen: { total: 0, cuantas: 0 } };

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
      /* Un 404 sin cuerpo JSON no es «no encontrado»: es que la ruta ni
         siquiera se está ejecutando. */
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

  /* ---------- navegación de días ---------- */
  $('#dia-ant').addEventListener('click', () => { dia.setDate(dia.getDate() - 1); cargar(); });
  $('#dia-sig').addEventListener('click', () => { dia.setDate(dia.getDate() + 1); cargar(); });
  $('#ir-hoy').addEventListener('click', () => { dia = new Date(); cargar(); });

  /* ---------- carga y pintado ---------- */
  async function cargar() {
    pintarCabecera();
    $('#lista').textContent = '';
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
      : 'Sin citas';

    const lista = $('#lista');
    lista.textContent = '';

    const filas = [
      ...datos.citas.map(c => ({ t: new Date(c.inicio).getTime(), tipo: 'cita', d: c })),
      ...datos.bloqueos.map(b => ({ t: new Date(b.inicio).getTime(), tipo: 'bloqueo', d: b }))
    ].sort((a, b) => a.t - b.t);

    if (!filas.length) {
      const p = el('p', 'panel__vacio');
      p.textContent = 'Ninguna cita este día.';
      lista.appendChild(p);
      return;
    }
    filas.forEach(f => lista.appendChild(f.tipo === 'cita' ? tarjetaCita(f.d) : tarjetaBloqueo(f.d)));
  }

  const hora = iso => new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(iso));

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
    pie.append(tot, est);

    const btns = el('div', 'cita__btns');

    /* WhatsApp por enlace directo: abre el chat con el mensaje escrito y sale
       del número real del local. Sin API de por medio y sin costo. */
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
    pie.appendChild(btns);

    n.append(cab, cli, serv, pie);
    return n;
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

  /* ---------- bloquear horas ---------- */
  const dlg = $('#dlg-bloqueo');
  $('#abrir-bloqueo').addEventListener('click', async () => {
    const sel = $('#bq-prof');
    if (sel.options.length === 1) {
      /* Se piden al vuelo con un servicio que prestan los dos barberos, para no
         añadir un endpoint solo por llenar un desplegable. */
      try {
        const r = await api('/profesionales?servicios=corte-sencillo');
        (r.profesionales || []).forEach(p => {
          const o = document.createElement('option');
          o.value = p.id; o.textContent = p.nombre;
          sel.appendChild(o);
        });
      } catch (e) { /* se queda solo «todo el local» */ }
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

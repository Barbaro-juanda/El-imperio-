/* =========================================================
   Motion — módulos de movimiento del sitio
   =========================================================
   Va aparte de app.js porque son cosas distintas: app.js es el producto —la
   reserva, el catálogo, la galería—; esto es cómo se mueve. Separarlos permite
   leer el sistema de movimiento entero sin atravesar mil líneas de lógica de
   negocio, y borrarlo de un tirón el día que se decida otra cosa.

   Sin dependencias. Un IntersectionObserver compartido y requestAnimationFrame,
   que es todo lo que hace falta.
   ========================================================= */
(() => {
  'use strict';

  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------
     reveal — un único observador para todo el sitio
     ------------------------------------------------------
     Uno solo y no uno por sección: cada observador tiene su coste, y con
     decenas de elementos repartidos por la página la diferencia se nota en un
     teléfono de gama media.

     Marcado que entiende:
       data-reveal="up|fade|mask|scale"
       data-reveal-delay="120"          retraso en ms
       data-reveal-stagger="90"         en un contenedor: escalona a sus hijos
       data-reveal-threshold="0.25"     cuánto tiene que asomar para disparar
     ------------------------------------------------------ */
  function reveal() {
    const piezas = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!piezas.length) return;

    /* Con movimiento reducido no se esconde nada: se marca todo como visto y
       se acabó. Ni siquiera se crea el observador. */
    if (quieto.matches) {
      piezas.forEach(n => n.classList.add('is-visible', 'is-done'));
      return;
    }

    /* La máscara necesita un hijo que mover dentro del recorte. Se envuelve
       aquí y no en el HTML para que el marcado siga siendo legible y para que
       sin JavaScript no quede un <span> suelto sin función. */
    piezas.forEach(n => {
      if (n.getAttribute('data-reveal') !== 'mask') return;
      if (n.firstElementChild && n.firstElementChild.classList.contains('mask__i')) return;
      const dentro = document.createElement('span');
      dentro.className = 'mask__i';
      while (n.firstChild) dentro.appendChild(n.firstChild);
      n.appendChild(dentro);
    });

    /* Escalonado: el contenedor lo declara una vez y sus hijos heredan el
       retraso según su posición. Se calcula al arrancar, no al entrar, para que
       el orden sea el del documento y no el orden en que el observador
       despierte —que no está garantizado—.

       Con tope: en una lista de veinte, el último entraría casi dos segundos
       después del primero, y para entonces ya nadie está mirando. */
    document.querySelectorAll('[data-reveal-stagger]').forEach(cont => {
      const paso = Number(cont.getAttribute('data-reveal-stagger')) || 90;
      const tope = Number(cont.getAttribute('data-reveal-stagger-max')) || 8;
      Array.prototype.slice.call(cont.children)
        .filter(h => h.hasAttribute('data-reveal'))
        .forEach((h, i) => {
          if (h.hasAttribute('data-reveal-delay')) return;   // el propio manda
          h.style.setProperty('--reveal-delay', Math.min(i, tope) * paso + 'ms');
        });
    });

    piezas.forEach(n => {
      const d = n.getAttribute('data-reveal-delay');
      if (d) n.style.setProperty('--reveal-delay', Number(d) + 'ms');
    });

    /* Los umbrales distintos exigen observadores distintos —es parte de la
       configuración del observador, no de cada elemento—, así que se agrupan:
       un observador por umbral usado, no uno por elemento. */
    const porUmbral = new Map();
    piezas.forEach(n => {
      const u = n.getAttribute('data-reveal-threshold') || '0.15';
      if (!porUmbral.has(u)) porUmbral.set(u, []);
      porUmbral.get(u).push(n);
    });

    porUmbral.forEach((lista, umbral) => {
      const obs = new IntersectionObserver((entradas, o) => {
        entradas.forEach(e => {
          if (!e.isIntersecting) return;
          const n = e.target;
          n.classList.add('is-visible');
          /* Una sola vez: al volver a subir no se vuelve a animar. Repetirlo
             convierte el scroll en un parpadeo constante. */
          o.unobserve(n);
          const espera = (parseFloat(n.style.getPropertyValue('--reveal-delay')) || 0) + 1000;
          setTimeout(() => n.classList.add('is-done'), espera);
        });
      }, { threshold: Number(umbral), rootMargin: '0px 0px -6% 0px' });

      lista.forEach(n => obs.observe(n));
    });

    /* Red de seguridad. El observador puede no dispararse nunca —pestaña
       congelada, un contenedor con overflow que rompe el cálculo, una
       implementación a medias—, y eso dejaría media página invisible de forma
       permanente. Perder la animación es aceptable; perder el contenido no. */
    setTimeout(() => {
      piezas.forEach(n => n.classList.add('is-visible', 'is-done'));
    }, 3000);
  }

  /* ------------------------------------------------------
     header
     ------------------------------------------------------
     No hay módulo de header, y es a propósito.

     Hubo uno que volvía la barra transparente sobre el hero, la encogía al
     bajar y la retiraba al hacer scroll hacia abajo. Se quitó entero —lógica,
     clases y escucha de scroll— porque al local no le gustó: una barra que
     aparece y desaparece obliga a fijarse en ella cada vez que vuelve, y la
     que lleva el botón de reservar es justo la que no debe pedir atención.

     La barra es estática y su aspecto lo define `.nav` en styles.css. Al no
     haber módulo, tampoco hay un escucha de scroll corriendo por él, que es
     trabajo que se ahorra en cada cuadro de toda la página.
     ------------------------------------------------------ */

  /* ------------------------------------------------------
     hero — entrada por líneas, parallax e indicador
     ------------------------------------------------------ */
  function hero() {
    const seccion = document.querySelector('.hero');
    if (!seccion) return;

    /* Cada pieza del hero es una línea con recorte. Se envuelve desde aquí para
       que el HTML siga siendo legible y para que sin JavaScript no quede un
       marcado lleno de <i> sin función. El <h1> se parte por su <br>, que es
       donde el diseño ya decidió que corta. */
    const orden = ['.eyebrow--wide', '.hero__title', '.hero__sub',
                   '.hero__inner > .btn', '.hero__trust'];
    let n = 0;
    orden.forEach(sel => {
      const nodo = seccion.querySelector(sel);
      if (!nodo) return;
      const trozos = sel === '.hero__title'
        ? nodo.innerHTML.split(/<br\s*\/?>/i)
        : [nodo.innerHTML];
      nodo.innerHTML = trozos
        .map(t => '<span class="linea"><i>' + t + '</i></span>')
        .join('');
      nodo.querySelectorAll('.linea').forEach(l => {
        l.style.setProperty('--reveal-delay', (n++ * 140) + 'ms');
        /* Sin observador: el hero está en pantalla desde el primer momento, así
           que esperar a que «entre» sería esperar a nada. */
        requestAnimationFrame(() => requestAnimationFrame(() => l.classList.add('is-visible')));
      });
    });

    /* Red de seguridad, como en el revelado: si rAF no corre —pestaña en
       segundo plano al abrir— el titular no puede quedarse invisible. */
    setTimeout(() => seccion.querySelectorAll('.linea').forEach(l => l.classList.add('is-visible')), 1500);

    /* --- capas del video: zoom fuera, parallax dentro --- */
    /* NO se toca el video en pantallas estrechas.

       Envolverlo en las dos capas obliga a sacarlo de su sitio, y mover un
       <video> lo detiene. En escritorio se vuelve a arrancar sin problema; en
       un celular, no siempre: iOS solo reproduce solo por el atributo
       `autoplay` del marcado, y un elemento que se ha movido ya no lo
       aprovecha. Un play() del guion, fuera de un toque del usuario, lo
       rechaza.

       Y las capas ahí no hacen falta: el parallax está desactivado por debajo
       de 900px, así que la única que se usaría es la del acercamiento, y esa se
       puede poner sobre el contenedor sin mover nada. Menos piezas y el video
       intacto donde nació. */
    const media = seccion.querySelector('.hero__media');
    const apaisado = window.matchMedia('(min-width: 900px)').matches;

    if (media && !apaisado) {
      media.classList.add('hero__zoom');
    } else if (media && !media.querySelector('.hero__zoom')) {
      const zoom = document.createElement('div');
      zoom.className = 'hero__zoom';
      const par = document.createElement('div');
      par.className = 'hero__par';
      while (media.firstChild) par.appendChild(media.firstChild);
      zoom.appendChild(par);
      media.appendChild(zoom);

      /* Volver a arrancar el video.

         Mover un <video> de sitio en el DOM lo DETIENE: el navegador lo trata
         como un elemento nuevo que aún no ha recibido permiso para reproducir.
         Y aquí se mueve por fuerza, porque envolverlo en las dos capas exige
         sacarlo de donde estaba.

         En escritorio a veces se recuperaba solo y no se notó; en un celular se
         quedaba parado en el póster, con el hero congelado. Que sea `muted` es
         lo que permite volver a arrancarlo sin que nadie lo haya tocado: un
         video con sonido no tendría esa segunda oportunidad. */
      media.querySelectorAll('video').forEach(v => {
        const p = v.play();
        if (p && p.catch) p.catch(() => {});   // el póster cubre si el navegador dice que no
      });
    }

    /* Última red: si el navegador se negó a reproducir —modo de bajo consumo en
       iOS lo desactiva por completo, y ahí no hay atributo que valga— se vuelve
       a intentar en cuanto el visitante toca o desplaza la página. Eso ya es un
       gesto suyo, y con un gesto ningún navegador se niega.

       `once` en los tres: si funciona, no hace falta volver; si no, tampoco se
       gana nada insistiendo en cada scroll. */
    const video = seccion.querySelector('video');
    if (video) {
      const intentar = () => {
        if (!video.paused) return;
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      };
      ['touchstart', 'scroll', 'click'].forEach(ev =>
        window.addEventListener(ev, intentar, { once: true, passive: true }));
    }

    /* --- indicador de scroll --- */
    if (!seccion.querySelector('.scrollind')) {
      const ind = document.createElement('div');
      ind.className = 'scrollind';
      ind.setAttribute('aria-hidden', 'true');
      seccion.appendChild(ind);
    }
    const ind = seccion.querySelector('.scrollind');

    /* --- parallax --- */
    const par = seccion.querySelector('.hero__par');
    const anchoOk = () => window.matchMedia('(min-width: 900px)').matches;
    let pedido = false;

    function alScroll() {
      pedido = false;
      const y = window.scrollY;

      if (ind) ind.classList.toggle('is-ido', y > 40);

      /* Al 20% de la velocidad del contenido. translate3d y no `top`: lo
         primero lo resuelve la tarjeta gráfica sin tocar el layout; lo segundo
         obliga a rehacer la página en cada cuadro. */
      if (par && anchoOk() && !quieto.matches) {
        /* Se corta pasado el hero: seguir calculando para algo que ya no se ve
           es trabajo tirado en cada cuadro del resto de la página. */
        if (y < window.innerHeight * 1.2) {
          par.style.transform = 'translate3d(0,' + (y * 0.2) + 'px,0)';
        }
      }
    }

    window.addEventListener('scroll', () => {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(alScroll);
    }, { passive: true });

    alScroll();
  }

  /* ------------------------------------------------------
     counters — cifras que suben
     ------------------------------------------------------ */
  function counters() {
    const nodos = document.querySelectorAll('[data-contar]');
    if (!nodos.length) return;

    const pintar = (n, v) => {
      const dec = Number(n.getAttribute('data-contar-dec')) || 0;
      n.textContent = (n.getAttribute('data-contar-pre') || '') +
        v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }) +
        (n.getAttribute('data-contar-post') || '');
    };

    if (quieto.matches) {
      nodos.forEach(n => pintar(n, Number(n.getAttribute('data-contar'))));
      return;
    }

    const obs = new IntersectionObserver((entradas, o) => {
      entradas.forEach(e => {
        if (!e.isIntersecting) return;
        const n = e.target;
        o.unobserve(n);
        const fin = Number(n.getAttribute('data-contar'));
        const dur = 1400;
        const t0 = performance.now();
        /* easeOutCubic: arranca rápido y se posa. Contar en lineal se ve
           mecánico, como un marcador de gasolinera. */
        const paso = ahora => {
          const p = Math.min(1, (ahora - t0) / dur);
          pintar(n, fin * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(paso);
          else pintar(n, fin);   // el valor exacto, sin decimales flotantes
        };
        requestAnimationFrame(paso);
        setTimeout(() => pintar(n, fin), dur + 400);   // red de seguridad
      });
    }, { threshold: 0.4 });

    nodos.forEach(n => obs.observe(n));
  }

  /* ------------------------------------------------------
     estrellas — se rellenan de izquierda a derecha
     ------------------------------------------------------ */
  function estrellas() {
    const cajas = document.querySelectorAll('[data-estrellas]');
    if (!cajas.length) return;

    cajas.forEach(caja => {
      /* Cada estrella en su <span> para poder encenderlas de una en una. El
         aria-label del contenedor ya dice «5 de 5», así que los span van
         ocultos al lector: si no, leería «estrella estrella estrella…». */
      if (!caja.querySelector('span')) {
        caja.innerHTML = caja.textContent.trim().split('')
          .map(c => '<span aria-hidden="true">' + c + '</span>').join('');
      }
      const spans = caja.querySelectorAll('span');
      if (quieto.matches) { caja.classList.add('is-visible'); return; }

      new IntersectionObserver((es, o) => {
        es.forEach(e => {
          if (!e.isIntersecting) return;
          o.unobserve(e.target);
          spans.forEach((s, i) => setTimeout(() => { s.style.opacity = '1'; }, i * 120));
        });
      }, { threshold: 0.5 }).observe(caja);

      /* Misma red que en el revelado, y aquí hace más falta: si el observador
         no llega a disparar, las estrellas se quedan al 18% de opacidad, y eso
         no es «sin animar», es la nota de Google medio borrada. */
      setTimeout(() => {
        caja.classList.add('is-visible');
        spans.forEach(s => { s.style.opacity = '1'; });
      }, 3000);
    });
  }

  /* ------------------------------------------------------
     magnetic — solo el CTA principal
     ------------------------------------------------------
     Solo uno. Puesto en todos los botones deja de ser un detalle y pasa a ser
     una página que se mueve sola. */
  function magnetic() {
    if (quieto.matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const b = document.querySelector('.hero__inner .btn');
    if (!b) return;
    b.classList.add('btn--iman');

    const RADIO = 90;   // área de detección algo mayor que el botón
    let pedido = false, mx = 0, my = 0;

    function aplicar() {
      pedido = false;
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = mx - cx, dy = my - cy;
      const dentro = Math.abs(dx) < r.width / 2 + RADIO &&
                     Math.abs(dy) < r.height / 2 + RADIO;
      /* Al salir vuelve solo: el transform a cero y la transición del CSS hacen
         el resto, sin animar nada a mano. */
      b.style.transform = dentro
        ? 'translate(' + (dx * 0.28) + 'px,' + (dy * 0.35) + 'px)'
        : '';
      b.style.transitionDuration = dentro ? '0ms' : '';
    }

    window.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(aplicar);
    }, { passive: true });
  }

  /* ------------------------------------------------------
     grano — textura fija sobre el fondo
     ------------------------------------------------------ */
  function grano() {
    if (quieto.matches) return;
    if (document.querySelector('.grano')) return;

    /* SVG en línea, sin petición de red y sin canvas corriendo. Estático a
       propósito: animarlo obliga a repintar la pantalla entera en cada cuadro,
       y por un efecto al 3% de opacidad no compensa ni un poco. */
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">' +
      '<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3"/></filter>' +
      '<rect width="180" height="180" filter="url(#g)"/></svg>';
    document.documentElement.style.setProperty(
      '--grano', 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")');

    const capa = document.createElement('div');
    capa.className = 'grano';
    capa.setAttribute('aria-hidden', 'true');
    document.body.appendChild(capa);
  }

  /* ------------------------------------------------------
     cursor — punto que sigue con retraso
     ------------------------------------------------------ */
  function cursor() {
    if (quieto.matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const punto = document.createElement('div');
    punto.className = 'cursor';
    const anillo = document.createElement('div');
    anillo.className = 'cursor__anillo';
    [punto, anillo].forEach(n => { n.setAttribute('aria-hidden', 'true'); document.body.appendChild(n); });

    let x = 0, y = 0, ax = 0, ay = 0, activo = false;

    window.addEventListener('mousemove', e => {
      x = e.clientX; y = e.clientY;
      if (!activo) { activo = true; ax = x; ay = y; requestAnimationFrame(latir); }
      /* El anillo crece sobre lo que se puede pulsar. `closest` y no una lista
         de clases: así funciona con lo que se añada mañana sin tocar esto. */
      const sobre = e.target.closest('a, button, [role="button"], input, select, textarea, label');
      anillo.classList.toggle('is-sobre', !!sobre);
    }, { passive: true });

    function latir() {
      /* Interpolación al 0.15: el punto persigue al cursor sin alcanzarlo del
         todo. Es lo que da la sensación de peso. */
      ax += (x - ax) * 0.15;
      ay += (y - ay) * 0.15;
      punto.style.transform  = 'translate3d(' + x  + 'px,' + y  + 'px,0)';
      anillo.style.transform = 'translate3d(' + ax + 'px,' + ay + 'px,0)' +
                               (anillo.classList.contains('is-sobre') ? ' scale(1)' : ' scale(.2)');
      requestAnimationFrame(latir);
    }
  }

  function arrancar() {
    reveal();
    hero();
    counters();
    estrellas();
    magnetic();
    grano();
    cursor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }

  /* Lo usa app.js cuando rehace la galería o la carta: los elementos nuevos
     llegan sin observar. */
  window.__motion = { reveal };
})();

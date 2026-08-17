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
     header — compacto, oculto al bajar, visible al subir
     ------------------------------------------------------ */
  const APARECE = 80;   // hasta aquí, transparente sobre el hero
  const UMBRAL  = 10;   // movimiento mínimo para reaccionar

  /* La decisión, separada del DOM y sin efectos: dado dónde estás y dónde
     estabas, qué debe hacer la barra. Aparte por dos razones. Se puede
     comprobar sin navegador —que es donde vive el único fallo que importa
     aquí, la barra temblando— y se lee de un vistazo, que con la lógica
     mezclada entre classList.toggle no pasaba.

     `oculto` puede venir null: significa «no cambies lo que había», que no es
     lo mismo que «muéstrala». */
  function estadoHeader(y, ultimo) {
    const arriba = y < APARECE;
    const salto = y - ultimo;

    /* Por debajo del umbral no se decide nada. Sin esto, el rebote de un
       trackpad o el ajuste de una imagen al cargar haría entrar y salir la
       barra varias veces por segundo. */
    if (Math.abs(salto) <= UMBRAL) {
      return { top: arriba, fijo: !arriba, oculto: null, ultimo: ultimo };
    }

    /* Nunca se esconde dentro del hero: ahí está el botón de reservar, y
       quitarlo de la vista mientras alguien decide es lo peor que puede hacer
       una animación. La conversión manda sobre el efecto. */
    return {
      top: arriba,
      fijo: !arriba,
      oculto: salto > 0 && y > APARECE * 3,
      ultimo: y
    };
  }

  function header() {
    const barra = document.getElementById('nav');
    if (!barra) return;

    let ultimo = window.scrollY;
    let pedido = false;

    function aplicar() {
      pedido = false;
      const e = estadoHeader(window.scrollY, ultimo);
      barra.classList.toggle('is-top', e.top);
      barra.classList.toggle('is-fijo', e.fijo);
      if (e.oculto !== null) barra.classList.toggle('is-oculto', e.oculto);
      ultimo = e.ultimo;
    }

    /* Todo el scroll pasa por rAF: el navegador puede disparar el evento
       decenas de veces por cuadro, y leer scrollY en cada uno obliga a
       recalcular el layout otras tantas. Con rAF se lee una vez por cuadro,
       justo antes de pintar. `passive` le dice al navegador que este manejador
       nunca va a cancelar el scroll, y así no tiene que esperarnos. */
    window.addEventListener('scroll', () => {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(aplicar);
    }, { passive: true });

    aplicar();
  }

  function arrancar() {
    reveal();
    header();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }

  /* Lo usa app.js cuando rehace la galería o la carta: los elementos nuevos
     llegan sin observar. */
  window.__motion = { reveal, estadoHeader, APARECE, UMBRAL };
})();

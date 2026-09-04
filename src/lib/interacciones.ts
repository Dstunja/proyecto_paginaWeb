/**
 * Capa de interacción fina: parallax del hero y botones magnéticos.
 *
 * Es el complemento de src/lib/revelado.ts, no su reemplazo. Aquel se encarga
 * de la entrada de las secciones al hacer scroll; este de dos gestos que
 * responden a lo que hace la persona en el momento.
 *
 * CÓMO SE USA (no hay que escribir JavaScript en ningún componente):
 *
 *   <img data-parallax />              se desplaza un poco más lento que la página
 *   <a class="btn" data-magnetico>     se estira hacia el cursor cuando pasa cerca
 *
 * ACCESIBILIDAD
 * -------------
 * Todo cuelga de la clase `js-revelado` que el <head> pone en <html>, la misma
 * que gobierna el revelado: solo aparece si hay IntersectionObserver y el
 * sistema NO pide menos movimiento. Con "reducir movimiento" activado este
 * archivo no engancha ni un solo escuchador, así que no queda ni el coste de
 * los eventos. El contenido nunca depende de que esto corra.
 *
 * RENDIMIENTO
 * -----------
 * Ni un cálculo de posición dentro del evento. `scroll` y `pointermove` solo
 * anotan el último valor y piden un fotograma; lo que toca el layout ocurre
 * dentro de requestAnimationFrame y como mucho una vez por fotograma. Solo se
 * escribe `transform`, que el navegador resuelve en el compositor sin rehacer
 * el diseño de la página.
 */

/** Desplazamiento máximo del parallax, en píxeles. Muy corto a propósito. */
const RECORRIDO_PARALLAX = 16;

/** Cuánto se estira un botón hacia el cursor, en píxeles. */
const IMAN = 4;

/** Radio alrededor del botón en el que el imán empieza a notarse. */
const RADIO_IMAN = 90;

if (document.documentElement.classList.contains('js-revelado')) {
  iniciarParallax();
  iniciarImanes();
}

/**
 * Parallax del hero.
 *
 * El elemento sube más despacio que el resto de la página mientras la portada
 * está en pantalla. El factor se calcula sobre cuánto se ha desplazado la
 * página respecto a la altura de la ventana, y se recorta a RECORRIDO_PARALLAX
 * para que nunca se despegue de su sitio: es un matiz de profundidad, no un
 * efecto que se note por sí mismo.
 *
 * Solo trabaja mientras el elemento está a la vista. Un IntersectionObserver
 * enciende y apaga el escuchador de scroll, así que en el resto de la página
 * no queda nada corriendo.
 */
function iniciarParallax(): void {
  const objetivos = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  if (!objetivos.length) return;

  const visibles = new Set<HTMLElement>();
  let pendiente = false;

  const pintar = () => {
    pendiente = false;
    for (const objetivo of visibles) {
      const caja = objetivo.getBoundingClientRect();
      // -1 arriba del todo, 0 centrado, 1 abajo del todo.
      const avance = (caja.top + caja.height / 2) / window.innerHeight - 0.5;
      const y = Math.max(-1, Math.min(1, avance)) * RECORRIDO_PARALLAX;
      objetivo.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    }
  };

  const alDesplazar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(pintar);
  };

  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      const objetivo = entrada.target as HTMLElement;
      if (entrada.isIntersecting) visibles.add(objetivo);
      else {
        visibles.delete(objetivo);
        // Al salir de pantalla se deja quieto, no a medio camino.
        objetivo.style.transform = '';
      }
    }

    if (visibles.size) {
      window.addEventListener('scroll', alDesplazar, { passive: true });
      alDesplazar();
    } else {
      window.removeEventListener('scroll', alDesplazar);
    }
  });

  objetivos.forEach((objetivo) => observador.observe(objetivo));
}

/**
 * Botones magnéticos.
 *
 * El botón se estira unos píxeles hacia el cursor cuando este entra en su
 * radio. Solo con ratón de verdad: en una pantalla táctil no hay cursor que
 * seguir, y `pointermove` llegaría con el dedo ya encima.
 *
 * El escuchador va en el documento y no en cada botón porque el imán tiene que
 * notarse ANTES de llegar al botón; un `mousemove` sobre el propio botón solo
 * dispararía cuando el cursor ya está dentro y el gesto se perdería.
 *
 * Se escriben DOS VARIABLES CSS, no la propiedad `transform`. Es importante:
 * `.btn:hover` ya usa `transform` para elevar el botón, y un `transform` en
 * línea desde aquí le ganaría siempre y le quitaría esa elevación. Con las
 * variables, el CSS compone los dos movimientos (ver `[data-magnetico]` en
 * src/styles/global.css).
 */
function iniciarImanes(): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const botones = Array.from(document.querySelectorAll<HTMLElement>('[data-magnetico]'));
  if (!botones.length) return;

  let raton = { x: 0, y: 0 };
  let pendiente = false;

  const soltar = (boton: HTMLElement) => {
    boton.style.removeProperty('--iman-x');
    boton.style.removeProperty('--iman-y');
  };

  const pintar = () => {
    pendiente = false;
    for (const boton of botones) {
      const caja = boton.getBoundingClientRect();
      const cx = caja.left + caja.width / 2;
      const cy = caja.top + caja.height / 2;
      const dx = raton.x - cx;
      const dy = raton.y - cy;
      const distancia = Math.hypot(dx, dy);

      if (distancia > RADIO_IMAN + Math.max(caja.width, caja.height) / 2) {
        soltar(boton);
        continue;
      }

      // Cuanto más cerca, más se estira; nunca más de IMAN píxeles.
      const fuerza = 1 - Math.min(1, distancia / (RADIO_IMAN * 2));
      boton.style.setProperty('--iman-x', `${((dx / RADIO_IMAN) * IMAN * fuerza).toFixed(2)}px`);
      boton.style.setProperty('--iman-y', `${((dy / RADIO_IMAN) * IMAN * fuerza).toFixed(2)}px`);
    }
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      raton = { x: e.clientX, y: e.clientY };
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(pintar);
    },
    { passive: true },
  );

  // Si el cursor abandona la ventana, los botones vuelven a su sitio.
  document.addEventListener('pointerleave', () => botones.forEach(soltar));
}

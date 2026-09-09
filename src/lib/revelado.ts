/**
 * Revelado al hacer scroll.
 *
 * Las secciones y las tarjetas entran con un fundido y un desplazamiento corto
 * hacia arriba la primera vez que asoman en pantalla, en vez de estar todas
 * puestas de golpe al cargar. Una vez reveladas se quedan así: no se vuelven a
 * animar al subir y bajar.
 *
 * CÓMO SE USA (no hay que escribir JavaScript en ningún componente):
 *
 *   <div data-revelar>…</div>          un elemento suelto
 *   <div class="grid" data-revelar-grupo>   cada hijo directo se revela por su
 *     <article>…</article>                  cuenta y con retraso escalonado
 *     <article>…</article>                  respecto a los de su misma fila
 *   </div>
 *
 * TRES VARIANTES, según lo que se esté revelando:
 *
 *   data-revelar             fundido + subida de 16 px. Es el valor por
 *   data-revelar="subir"     defecto: sirve para secciones y tarjetas.
 *   data-revelar="fundido"   solo fundido, sin desplazamiento. Para bloques de
 *                            texto largo y para los mapas, donde mover el
 *                            contenido bajo el cursor molesta más que suma.
 *   data-revelar="escala"    fundido + un 3 % de acercamiento. Para lo que se
 *                            quiere destacar: los bloques con foto grande.
 *
 * En un grupo la variante se pone en el CONTENEDOR y la heredan todos los
 * hijos: `<div data-revelar-grupo="escala">`. Así no hay que repetirla en cada
 * tarjeta de una rejilla que se pinta en bucle.
 *
 * El estado inicial (invisible) lo pone el CSS en src/styles/global.css, no
 * este archivo, para que no haya parpadeo: si se escondiera desde aquí el
 * contenido se pintaría visible y desaparecería un instante después.
 *
 * ACCESIBILIDAD Y DEGRADACIÓN
 * ---------------------------
 * Todo el efecto cuelga de la clase `js-revelado` que el <head> pone en <html>
 * (ver BaseLayout.astro). Esa clase solo se añade si el sistema NO pide menos
 * movimiento y el navegador tiene IntersectionObserver. Si falta cualquiera de
 * las dos cosas —o si directamente no hay JavaScript— la clase nunca aparece,
 * el CSS de ocultamiento no aplica y todo el contenido se ve de una vez. El
 * contenido nunca depende de que esta animación funcione.
 */

/** Retraso entre una tarjeta y la siguiente de su misma fila. */
const RETRASO_ENTRE_TARJETAS = 80;

/**
 * Tope del escalonado. Una fila de ocho tarjetas en un monitor ancho no debe
 * tardar medio segundo en terminar de entrar: a partir de cierto punto las
 * últimas arrancan juntas. Con 80 ms de paso, el tope entra en la séptima.
 */
const RETRASO_MAXIMO = 480;

/** Las tres variantes. Cualquier otro valor cae en la de por defecto. */
const VARIANTES = new Set(['subir', 'fundido', 'escala']);
const VARIANTE_POR_DEFECTO = 'subir';

/**
 * Cuánto tiene que haber asomado el elemento para dispararlo.
 *
 * `threshold: 0` con un margen inferior negativo significa "cuando su borde
 * superior pase del 90 % de la altura de la ventana". Se usa así, y no un
 * porcentaje del elemento, porque una sección más alta que la pantalla nunca
 * llegaría a cumplir un threshold alto y se quedaría sin revelar.
 */
const OPCIONES: IntersectionObserverInit = { threshold: 0, rootMargin: '0px 0px -10% 0px' };

/**
 * Retraso escalonado de una tarjeta dentro de su fila.
 *
 * Se calcula en el momento de revelar, no al arrancar, porque el número de
 * columnas depende del ancho de la ventana: así un cambio de tamaño antes de
 * llegar a la sección no deja los retrasos calculados para otra rejilla.
 * Los elementos sueltos (`data-revelar`) no escalonan nada.
 */
function retrasoDe(elemento: HTMLElement): number {
  const grupo = elemento.parentElement;
  if (!grupo?.hasAttribute('data-revelar-grupo')) return 0;

  const hermanos = Array.from(grupo.children) as HTMLElement[];
  // Misma fila = mismo borde superior. El margen de 4 px absorbe los
  // redondeos a subpíxel de la rejilla.
  const fila = hermanos.filter((h) => Math.abs(h.offsetTop - elemento.offsetTop) < 4);
  return Math.min(fila.indexOf(elemento) * RETRASO_ENTRE_TARJETAS, RETRASO_MAXIMO);
}

/**
 * Qué variante le toca a un elemento.
 *
 * Primero mira su propio `data-revelar`; si viene vacío -que es el caso de
 * todos los hijos de un grupo, que no llevan el atributo- hereda la del
 * contenedor. Un valor desconocido cae en la de por defecto en vez de dejar el
 * elemento sin animación: un typo en el marcado no debe esconder contenido.
 */
function varianteDe(elemento: HTMLElement): string {
  const propia = elemento.getAttribute('data-revelar');
  const heredada = elemento.parentElement?.getAttribute('data-revelar-grupo');
  const valor = (propia || heredada || '').trim();
  return VARIANTES.has(valor) ? valor : VARIANTE_POR_DEFECTO;
}

if (document.documentElement.classList.contains('js-revelado')) {
  /*
   * Hijos de un grupo que NO se pintan: un componente puede dejar su `<script>`
   * dentro de la misma rejilla que sus tarjetas (lo hace MapaCobertura en
   * /contactanos/), y `[data-revelar-grupo] > *` lo alcanzaría igual. Como un
   * `<script>` es `display: none`, nunca llega a intersecar: se quedaría
   * observado para siempre, sin revelar y con el `will-change` puesto. No se
   * ve, pero es basura acumulada; se filtran por nombre de etiqueta, que es
   * exacto y no obliga a medir nada.
   */
  const NO_SE_PINTAN = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META']);

  const objetivos = Array.from(
    document.querySelectorAll<HTMLElement>('[data-revelar], [data-revelar-grupo] > *'),
  ).filter((elemento) => !NO_SE_PINTAN.has(elemento.tagName));

  if (objetivos.length) {
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const elemento = entrada.target as HTMLElement;

        // Se deja de observar antes de animar: el revelado es de una sola vez.
        observador.unobserve(elemento);
        elemento.style.setProperty('--retraso-revelado', `${retrasoDe(elemento)}ms`);
        elemento.setAttribute('data-variante-revelado', varianteDe(elemento));

        /* `will-change` avisa al navegador de que va a componer opacidad y
           transformación, y eso le cuesta una capa por elemento. Se retira en
           cuanto la animación termina -en el propio elemento, con estilo en
           línea, que gana a la regla del CSS- para no dejar centenares de capas
           vivas en una página con 620 tarjetas. `once` quita el oyente solo. */
        elemento.addEventListener(
          'animationend',
          () => {
            elemento.style.willChange = 'auto';
          },
          { once: true },
        );

        elemento.setAttribute('data-revelado', '');
      }
    }, OPCIONES);

    objetivos.forEach((objetivo) => observador.observe(objetivo));
  }
}

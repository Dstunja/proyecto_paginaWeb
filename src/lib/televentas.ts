/**
 * Reparto de los enlaces de Televentas entre las asesoras de
 * `televentas` (src/data/site.ts).
 *
 * POR QUÉ UN SORTEO Y NO UN TURNO. El sitio es estático: no hay un contador
 * compartido entre clientes, y lo que se guarda en el navegador vive en el
 * teléfono de cada uno. Un turno "la primera vez Gabriela, la siguiente Sara"
 * guardado ahí haría empezar a TODOS los clientes nuevos por la misma asesora.
 * Por eso a cada navegador se le sortea una asesora la primera vez que toca
 * un enlace de Televentas: con muchos clientes el reparto sale parejo.
 *
 * UNA VEZ ASIGNADA, NO CAMBIA SOLA. Se guarda en localStorage y desde ahí
 * todos los enlaces, y el pedido armado, van a la misma persona: un cliente
 * que vuelve a escribir no salta de asesora. Solo cambia si el cliente elige
 * a otra (en Contáctanos o con "¿Prefieres a…?" del panel del pedido).
 *
 * CÓMO SE ENGANCHA UN ENLACE. El HTML sale con la primera asesora, así que el
 * enlace funciona aunque no haya JavaScript. `enlazarTeleventas()` reescribe
 * todos los `a[data-televentas]` de la página: al cargar, si el navegador ya
 * tiene asesora; si no, al primer toque sobre uno de ellos, antes de que el
 * navegador siga el enlace. Se usa `pointerdown` además de `click` para que
 * el clic central y "abrir en otra pestaña" también salgan bien.
 *
 * Lo que toca `window` solo corre en el navegador; `enlaceTeleventas` se usa
 * también en el frontmatter para imprimir el enlace inicial.
 */
import { televentas } from '../data/site';

export type Asesora = (typeof televentas)[number];

/** Clave de localStorage, con el mismo prefijo y versión que `dst:pedido:v1`. */
export const CLAVE_TELEVENTAS = 'dst:televentas:v1';

/**
 * Mensaje de los enlaces genéricos de pedido (botón flotante, CTA de la
 * portada, Contáctanos, "sin pedido armado"). Va sin saludo: lo pone `saludar`.
 */
export const MENSAJE_PEDIDO = 'quiero hacer un pedido.';

/** La que llevan los enlaces impresos en el HTML, antes de repartir. */
export const ASESORA_POR_DEFECTO: Asesora = televentas[0];

/** Selector de los enlaces que se reparten. El valor del atributo es el mensaje. */
const SELECTOR_REPARTO = 'a[data-televentas]';

/** Selector de los enlaces a una asesora concreta: tocarlos la deja elegida. */
const SELECTOR_ELEGIDA = '[data-asesora]';

/** "Hola Gabriela, " + el mensaje. */
export function saludar(asesora: Asesora, mensaje: string): string {
  return `Hola ${asesora.nombre}, ${mensaje}`;
}

/** URL de WhatsApp de la asesora con el texto tal cual, ya saludado o no. */
export function enlaceWhatsappDe(asesora: Asesora, texto: string): string {
  return `${asesora.whatsapp}?text=${encodeURIComponent(texto)}`;
}

/** URL de WhatsApp de la asesora con el mensaje precedido del saludo. */
export function enlaceTeleventas(asesora: Asesora, mensaje: string): string {
  return enlaceWhatsappDe(asesora, saludar(asesora, mensaje));
}

/** La otra asesora de la lista, para ofrecer el cambio. */
export function otraAsesora(asesora: Asesora): Asesora | undefined {
  return televentas.find((a) => a.nombre !== asesora.nombre);
}

/**
 * Respaldo para cuando el navegador no deja usar localStorage (navegación
 * privada en algunos navegadores, datos del sitio bloqueados): la asignación
 * dura lo que dure la página, pero al menos no cambia entre un clic y otro.
 */
let enMemoria: string | null = null;

function leerNombre(): string | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_TELEVENTAS);
    if (!crudo) return null;
    const { asesora } = JSON.parse(crudo) as { asesora?: unknown };
    return typeof asesora === 'string' ? asesora : null;
  } catch {
    return enMemoria;
  }
}

function guardarNombre(nombre: string): void {
  enMemoria = nombre;
  try {
    window.localStorage.setItem(CLAVE_TELEVENTAS, JSON.stringify({ asesora: nombre }));
  } catch {
    // Sin localStorage queda la copia en memoria.
  }
}

/** La asesora que este navegador ya tiene, o `null` si todavía no se le asignó. */
export function asesoraGuardada(): Asesora | null {
  const nombre = leerNombre();
  return televentas.find((a) => a.nombre === nombre) ?? null;
}

/**
 * La asesora de este navegador. Si no tiene, se sortea una y se guarda.
 *
 * Una asesora guardada que ya no está en la lista cuenta como ninguna: a ese
 * cliente se le sortea otra en vez de dejarlo apuntando a un número que no
 * existe.
 */
export function asesoraAsignada(): Asesora {
  const guardada = asesoraGuardada();
  if (guardada) return guardada;
  const sorteada = televentas[Math.floor(Math.random() * televentas.length)] ?? ASESORA_POR_DEFECTO;
  guardarNombre(sorteada.nombre);
  return sorteada;
}

/** Reescribe todos los enlaces repartidos de la página con esta asesora. */
function pintarEnlaces(asesora: Asesora): void {
  document.querySelectorAll<HTMLAnchorElement>(SELECTOR_REPARTO).forEach((enlace) => {
    enlace.href = enlaceTeleventas(asesora, enlace.dataset.televentas ?? '');
  });
}

/** Deja elegida a una asesora concreta y actualiza los enlaces de la página. */
export function elegirAsesora(asesora: Asesora): void {
  guardarNombre(asesora.nombre);
  pintarEnlaces(asesora);
}

let enlazado = false;

/**
 * Engancha el reparto en la página. Se puede llamar desde varios componentes:
 * solo la primera llamada instala los escuchas.
 */
export function enlazarTeleventas(): void {
  if (enlazado) return;
  enlazado = true;

  const guardada = asesoraGuardada();
  if (guardada) pintarEnlaces(guardada);

  const alTocar = (evento: Event) => {
    const objetivo = evento.target;
    if (!(objetivo instanceof Element)) return;
    if (objetivo.closest(SELECTOR_REPARTO)) pintarEnlaces(asesoraAsignada());
  };

  // En captura: el `href` tiene que estar reescrito antes de que el navegador
  // siga el enlace y antes de que cualquier otro escucha lo lea.
  document.addEventListener('pointerdown', alTocar, true);
  document.addEventListener('click', alTocar, true);

  // Elegir a una asesora concreta cuenta solo con el clic: un toque largo
  // para copiar su número no es una elección.
  document.addEventListener(
    'click',
    (evento) => {
      const objetivo = evento.target;
      if (!(objetivo instanceof Element)) return;
      const nombre = objetivo.closest<HTMLElement>(SELECTOR_ELEGIDA)?.dataset.asesora;
      const elegida = televentas.find((a) => a.nombre === nombre);
      if (elegida) elegirAsesora(elegida);
    },
    true,
  );
}

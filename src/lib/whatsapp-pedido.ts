/**
 * Enlaces de WhatsApp para pedidos, cotizaciones y atención comercial.
 *
 * ANTES: esto repartía los enlaces entre las asesoras de Televentas, sorteando
 * una por navegador y recordándola en localStorage. Televentas dejó de existir
 * como área de la empresa, así que no hay entre quiénes repartir: todos los
 * enlaces de pedido van a un único número.
 *
 * Ese número es la línea comercial, propia para pedidos y cotizaciones, distinta
 * del número general de la empresa (`empresa.whatsapp` en src/data/site.ts), que
 * sigue atendiendo el teléfono, PQRS, empleos y lo administrativo.
 *
 * EDITAR AQUÍ si cambia la línea comercial. Todos los enlaces comerciales del
 * sitio pasan por este archivo, así que cambiar `WHATSAPP_PEDIDO` y
 * `TELEFONO_PEDIDO` los mueve todos a la vez: el botón flotante, los CTA del
 * inicio, "Pedir catálogo", Contáctanos, el pie de página, el buscador de
 * municipios y el armador de pedidos.
 *
 * No toca el DOM ni el navegador: se usa igual en el frontmatter de un .astro
 * (al compilar) que dentro de un <script> del cliente.
 */

/**
 * Mensaje de los enlaces genéricos de pedido (botón flotante, CTA de la
 * portada, Contáctanos, "sin pedido armado").
 */
export const MENSAJE_PEDIDO = 'Hola, quiero hacer un pedido.';

/** El número de la línea comercial, tal como se muestra en pantalla. */
export const TELEFONO_PEDIDO = '311 827 5957';

/** El WhatsApp al que llegan los pedidos y las cotizaciones. */
export const WHATSAPP_PEDIDO = 'https://wa.me/573118275957';

/** URL de WhatsApp al número de pedidos, con el texto ya puesto. */
export function enlacePedido(texto: string): string {
  return `${WHATSAPP_PEDIDO}?text=${encodeURIComponent(texto)}`;
}

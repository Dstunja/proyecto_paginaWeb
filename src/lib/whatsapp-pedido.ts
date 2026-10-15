/**
 * Enlaces de WhatsApp para pedidos, cotizaciones y atención comercial.
 *
 * ANTES: esto repartía los enlaces entre las asesoras de Televentas, sorteando
 * una por navegador y recordándola en localStorage. Televentas dejó de existir
 * como área de la empresa, así que no hay entre quiénes repartir. Después se
 * probó una línea comercial aparte (311 827 5957) para pedidos y cotizaciones,
 * y también se descartó: la empresa atiende todo por un solo número.
 *
 * Hoy el número es el MISMO de `empresa.telefono` / `empresa.whatsapp` en
 * src/data/site.ts, que es el que contesta teléfono, PQRS, empleos y lo
 * administrativo. Se mantiene este archivo aparte —y no se importa de site.ts—
 * porque son dos decisiones distintas: si algún día vuelve a haber una línea
 * comercial propia, se cambia aquí sin tocar el número general. Mientras tanto,
 * los dos valores deben coincidir dígito por dígito.
 *
 * EDITAR AQUÍ si cambia la línea de pedidos. Todos los enlaces comerciales del
 * sitio pasan por este archivo, así que cambiar `WHATSAPP_PEDIDO` y
 * `TELEFONO_PEDIDO` los mueve todos a la vez: el botón flotante, los CTA del
 * inicio, "Pedir catálogo", Contáctanos, el pie de página, el buscador de
 * municipios y el armador de pedidos. Ojo: `scripts/verificar-pedido.mjs`
 * repite el número a mano (`WHATSAPP_PEDIDOS`) justamente para delatar un
 * cambio por error, así que hay que ajustarlo en el mismo commit.
 *
 * No toca el DOM ni el navegador: se usa igual en el frontmatter de un .astro
 * (al compilar) que dentro de un <script> del cliente.
 */

/**
 * Mensaje de los enlaces genéricos de pedido (botón flotante, CTA de la
 * portada, Contáctanos, "sin pedido armado").
 */
export const MENSAJE_PEDIDO = 'Hola, quiero hacer un pedido.';

/** El número de la línea de pedidos, tal como se muestra en pantalla. */
export const TELEFONO_PEDIDO = '310 623 2429';

/** El WhatsApp al que llegan los pedidos y las cotizaciones. */
export const WHATSAPP_PEDIDO = 'https://wa.me/573106232429';

/** URL de WhatsApp al número de pedidos, con el texto ya puesto. */
export function enlacePedido(texto: string): string {
  return `${WHATSAPP_PEDIDO}?text=${encodeURIComponent(texto)}`;
}

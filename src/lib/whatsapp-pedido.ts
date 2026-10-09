/**
 * Enlaces de WhatsApp para pedidos y atención comercial.
 *
 * ANTES: esto repartía los enlaces entre las asesoras de Televentas, sorteando
 * una por navegador y recordándola en localStorage. Televentas dejó de existir
 * como área de la empresa, así que no hay entre quiénes repartir: todos los
 * enlaces de pedido van a un único número.
 *
 * EDITAR AQUÍ cuando haya un número propio para pedidos. Hoy se usa el general
 * de la empresa (`empresa.whatsapp` en src/data/site.ts), el mismo de PQRS y
 * empleos, porque todavía no hay otro. Todos los enlaces del sitio pasan por
 * este archivo, así que cambiar `WHATSAPP_PEDIDO` los mueve todos a la vez:
 * el botón flotante, los CTA del inicio, Contáctanos y el armador de pedidos.
 *
 * No toca el DOM ni el navegador: se usa igual en el frontmatter de un .astro
 * (al compilar) que dentro de un <script> del cliente.
 */
import { empresa } from '../data/site';

/**
 * Mensaje de los enlaces genéricos de pedido (botón flotante, CTA de la
 * portada, Contáctanos, "sin pedido armado").
 */
export const MENSAJE_PEDIDO = 'Hola, quiero hacer un pedido.';

/** El WhatsApp al que llegan los pedidos. */
export const WHATSAPP_PEDIDO = empresa.whatsapp;

/** URL de WhatsApp al número de pedidos, con el texto ya puesto. */
export function enlacePedido(texto: string): string {
  return `${WHATSAPP_PEDIDO}?text=${encodeURIComponent(texto)}`;
}

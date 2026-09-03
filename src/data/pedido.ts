/**
 * Configuración de la sección "Arma tu pedido".
 *
 * El sitio es estático (GitHub Pages hoy, Hostinger después): no hay servidor
 * que reciba el pedido. Lo que hace la página es ayudar al tendero a armar la
 * lista y entregársela a un asesor por WhatsApp, que es el canal que la
 * empresa ya usa. Por eso aquí no hay precios ni inventario: solo referencias
 * y cantidades.
 */

import { empresa } from './site';

/**
 * Clave de localStorage. Lleva el prefijo del sitio para no chocar con nada
 * más servido desde el mismo dominio (GitHub Pages aloja varios proyectos bajo
 * dstunja.github.io, que comparten origen y por lo tanto comparten
 * localStorage). El sufijo de versión permite cambiar el formato del pedido
 * más adelante sin romperle la sesión a quien tenga uno guardado.
 */
export const CLAVE_PEDIDO = 'dst:pedido:v1';

/** Número de WhatsApp del asesor, en el formato que espera wa.me (sin +). */
export const WHATSAPP_NUMERO = empresa.telefonoE164.replace(/\D/g, '');

/**
 * Tope de caracteres del texto YA CODIFICADO que se manda en `?text=`.
 *
 * `wa.me` no documenta ningún límite, así que se elige uno conservador: 4000
 * caracteres codificados dejan la URL completa por debajo de 4 KB, que es
 * territorio seguro en cualquier navegador actual y en el paso a la app de
 * Android. Ojo con la aritmética: codificar más o menos duplica el texto
 * (`×` ocupa 6 caracteres, cada tilde 6, cada salto de línea 3), de modo que
 * 4000 codificados son unas 30 referencias por mensaje.
 *
 * AJUSTAR AQUÍ si en la práctica se ve que WhatsApp aguanta más (subirlo hace
 * que quepan más referencias en el primer mensaje) o si algún teléfono falla
 * con pedidos largos (bajarlo).
 *
 * Lo que no cabe no se pierde: el pedido completo se copia al portapapeles
 * para pegarlo como segundo mensaje. Abrir varias ventanas de wa.me seguidas
 * no es alternativa, porque el navegador bloquea la segunda por emergente.
 */
export const LIMITE_TEXTO_URL = 4000;

/** Cantidad máxima por referencia, para atajar errores de digitación. */
export const CANTIDAD_MAXIMA = 999;

/** Cuántas tarjetas se pintan por tanda antes del botón "Ver más". */
export const TAMANO_TANDA = 24;

/** Aviso que debe aparecer en la interfaz y en el mensaje al asesor. */
export const AVISO_PRECIOS = 'Los precios y disponibilidad los confirma tu asesor.';

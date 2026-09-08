/**
 * Precios sugeridos al público (PSP) de referencia, por CÓDIGO SAP.
 *
 * PARA QUÉ SIRVE
 * --------------
 * Hasta ahora cada tarjeta del armador de pedidos repetía "confirma tu asesor",
 * lo que obligaba al tendero a llamar solo para saber si una referencia le
 * cabía en el presupuesto. Con este archivo lleno, la tarjeta y el panel
 * muestran un precio ORIENTATIVO y el asesor entra a confirmar el valor final
 * según zona y volumen, que es lo que de verdad varía.
 *
 * POR QUÉ EL CÓDIGO SAP Y NO EL `id`
 * ----------------------------------
 * El `id` de src/data/productos.ts se genera a partir del nombre y la
 * presentación: si mañana se corrige una tilde o se cambia "300 g" por "300g",
 * el `id` cambia y el precio se despegaría de su producto en silencio. El
 * código SAP es el único identificador estable que comparten el maestro de
 * productos, el deck de origen y el mensaje que recibe el asesor.
 *
 * Ojo: hay referencias con `codigoParcial: true` (el deck solo mostraba los
 * últimos dígitos) y otras con el código vacío. Esas no pueden llevar precio
 * hasta que se complete su código; el sitio simplemente las muestra sin él.
 *
 * ---------------------------------------------------------------------------
 * EDITAR AQUÍ: cargar los precios sugeridos al público
 * ---------------------------------------------------------------------------
 * Formato: una línea por referencia, `'CÓDIGO SAP': valor en pesos (entero)`.
 *
 *     export const PRECIOS_SUGERIDOS: Record<string, number> = {
 *       '2034008': 12900,
 *       '2034009': 12900,
 *     };
 *
 * Reglas al llenarlo:
 *   1. El valor va en PESOS COLOMBIANOS, entero y sin separadores ni símbolo
 *      ($, puntos ni comas): 12900, no '$ 12.900'.
 *   2. Solo referencias cuyo PSP esté CONFIRMADO. Una referencia que no
 *      aparezca en esta lista no muestra cifra: tanto la tarjeta del catálogo
 *      como la línea del panel dicen "Precio a consultar" (la constante
 *      `SIN_PSP` de src/lib/precios.ts), que es preferible a mostrar una cifra
 *      inventada.
 *   3. El código debe existir tal cual en `codigo` de src/data/productos.ts.
 *      `npm run build` avisa en consola de los códigos que no cuadren (ver
 *      `codigosSinProducto` en src/lib/precios.ts).
 *
 * No hay que tocar ningún componente: en cuanto haya entradas aquí, la tarjeta
 * del catálogo, el panel del pedido y el subtotal orientativo aparecen solos.
 *
 * Mientras esta lista esté vacía el sitio se comporta exactamente como antes,
 * solo que sin repetir el aviso de precios en cada tarjeta: queda una sola nota
 * al pie del panel.
 */
export const PRECIOS_SUGERIDOS: Record<string, number> = {};

/**
 * Códigos SAP cuyo precio viene de la LISTA OFICIAL del proveedor, no de una
 * estimación.
 *
 * QUÉ DISTINGUE A ESTA LISTA DE LA DE ARRIBA
 * ------------------------------------------
 * `PRECIOS_SUGERIDOS` dice CUÁNTO cuesta; esta dice DE DÓNDE salió esa cifra.
 * Son dos preguntas distintas y la tarjeta necesita las dos: un precio tomado
 * de la lista oficial se puede mostrar tal cual, y uno deducido -del deck, o
 * del promedio de su categoría- tiene que ir con el aviso de que es
 * aproximado. Sin esta lista las dos cifras se verían idénticas en pantalla,
 * que es exactamente la confusión que el aviso trata de evitar.
 *
 * El sitio lo consulta a través de `precioEsOficial` (src/lib/precios.ts), y
 * de ahí sale el `pspEstimado` que enciende el aviso de la tarjeta.
 *
 * EDITAR AQUÍ: se llena junto con `PRECIOS_SUGERIDOS` al cargar la lista de
 * precios del proveedor, con los códigos que aparecieron en ella con un valor
 * mayor que cero. Un código que en la lista venga en 0 NO va aquí: ese cero no
 * es un precio, es un dato que falta, y la referencia debe quedar estimada.
 *
 * Mientras esté vacía, todas las referencias con precio se muestran como
 * estimadas, que es lo correcto: hoy las cifras del sitio salen del deck
 * "MASIVO 1.0" y ninguna está confirmada contra la lista oficial.
 */
export const PRECIOS_OFICIALES: ReadonlySet<string> = new Set([]);

/**
 * Fecha en que se actualizaron los precios de arriba, tal como se quiere leer
 * en la nota al pie del panel ('septiembre de 2026'). Vacío = no se menciona.
 *
 * EDITAR AQUÍ junto con la lista: un precio de referencia sin fecha envejece
 * sin que nadie se dé cuenta.
 */
export const PRECIOS_ACTUALIZADOS = 'agosto de 2026';

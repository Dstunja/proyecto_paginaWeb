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
 * ---------------------------------------------------------------------------
 * LOS TRES ORÍGENES DE PRECIO DEL CATÁLOGO, Y CUÁL ES ESTE
 * ---------------------------------------------------------------------------
 * Una tarjeta puede mostrar cifra por tres caminos distintos. No se mezclan y
 * el orden de preferencia es de arriba abajo:
 *
 *   1. PSP CONFIRMADO POR ASESOR — es ESTE archivo. Precio de venta real que
 *      el asesor comercial dio y confirmó, referencia por referencia. Manda
 *      sobre todo lo demás porque es el único que alguien ha verificado a
 *      mano contra lo que de verdad se cobra.
 *   2. PSP DEL DECK — el campo `precio` de src/data/productos.ts, extraído de
 *      las páginas del deck "MASIVO 1.0" que declaran un PSP explícito.
 *   3. PRECIO DE LISTA — src/data/preciosLista.ts, del maestro de precios de
 *      SAP. Es el último recurso, va rotulado "Precio de lista" y NUNCA como
 *      sugerido: no es lo que la tienda le cobra al consumidor.
 *
 * Quien resuelve ese orden es `precioSugerido` y `precioLista` en
 * src/lib/precios.ts; aquí solo se cargan las cifras.
 *
 * Las 10 fichas de abajo salen de 8 códigos: dos códigos los comparten dos
 * referencias cada uno (los spaghetti Monticello y los atunes Zenú), y el
 * asesor confirmó que en ambos casos las dos presentaciones valen lo mismo,
 * así que ya no hace falta distinguir cuál es cuál para ponerles precio.
 */
export const PRECIOS_SUGERIDOS: Record<string, number> = {
  // Confirmados por el asesor comercial en septiembre de 2026. Antes de esto
  // eran las últimas 10 referencias del catálogo sin ninguna cifra que mostrar:
  // su precio de lista existía en SAP pero no se podía publicar (combos CMU,
  // códigos repetidos en dos fichas, listas con fecha centinela).
  '1046580': 8620, //  Chocolate Tesalia Clavos y Canela sin azúcar, 100 g
  '1049712': 17300, // Corona Crema Chantilly Instantánea, paquete x 3
  '1053148': 8540, //  Chocolate Corona Delicatto 54% menos azúcar, 142 g
  '1055640': 7200, //  Galleta Saltín Noel Integral x 9
  '1059172': 14320, // Chocolate Corona Stevia, barra
  '1075439': 22000, // Galleta Saltín Noel Tradicional x 12
  '1080263': 6725, //  Monticello Spaghetti, 500 g — las DOS fichas (Integral y n°5)
  '1082110': 5200, //  Zenú Trozos de Atún, 140 g — las DOS fichas (aceite de girasol y agua)
};

/**
 * Fecha en que se actualizaron los precios de arriba, tal como se quiere leer
 * en la nota al pie del panel ('septiembre de 2026'). Vacío = no se menciona.
 *
 * EDITAR AQUÍ junto con la lista: un precio de referencia sin fecha envejece
 * sin que nadie se dé cuenta.
 */
export const PRECIOS_ACTUALIZADOS = 'septiembre de 2026';

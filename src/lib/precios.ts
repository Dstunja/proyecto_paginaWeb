/**
 * Cruce entre el catálogo (src/data/productos.ts) y los precios sugeridos
 * (src/data/precios.ts).
 *
 * Vive aparte y son funciones PURAS a propósito: el maestro de productos se
 * regenera desde el deck de Nutresa, así que las correcciones de precio no se
 * escriben ahí sino en src/data/precios.ts, por CÓDIGO SAP. El precio se
 * resuelve en tiempo de compilación y solo viaja al navegador de las
 * referencias que sí lo tienen.
 *
 * Se usa desde el frontmatter de los componentes (servidor) y desde sus
 * `<script>` (navegador); por eso aquí no hay `document`, `window` ni
 * `localStorage`.
 */

import { PRECIOS_SUGERIDOS } from '../data/precios';
import { PRECIOS_LISTA, type PrecioLista } from '../data/preciosLista';

export type { PrecioLista };

/** Una referencia mínima: lo que hace falta para resolverle el precio. */
export interface ConCodigo {
  codigo: string;
  codigoParcial?: boolean;
  /** PSP que ya trae el maestro de productos, extraído del deck de Nutresa. */
  precio?: number;
}

/**
 * Precio sugerido de una referencia, o `null` si no está confirmado.
 *
 * Hay dos fuentes y este es el orden:
 *   1. src/data/precios.ts, la corrección manual por código SAP. Manda sobre
 *      todo lo demás: es donde se anota un precio que el asesor ya corrigió.
 *   2. El campo `precio` del maestro (src/data/productos.ts), que viene del
 *      deck "MASIVO 1.0" y cubre las referencias cuya página declara un PSP.
 *
 * Devuelve `null` —y no 0 ni undefined— para que en la interfaz sea imposible
 * confundir "no sabemos" con "sale gratis". Las referencias con código parcial
 * o vacío no pueden llevar corrección manual (su código no identifica un
 * producto único), pero sí conservan el PSP del deck si lo tienen.
 */
export function precioSugerido(producto: ConCodigo): number | null {
  const codigo = producto.codigo?.trim();
  if (codigo && !producto.codigoParcial) {
    const manual = PRECIOS_SUGERIDOS[codigo];
    if (typeof manual === 'number' && Number.isFinite(manual) && manual > 0) return manual;
  }
  const delDeck = producto.precio;
  return typeof delDeck === 'number' && Number.isFinite(delDeck) && delDeck > 0 ? delDeck : null;
}

/**
 * Lo que se escribe cuando una referencia no tiene PSP confirmado.
 *
 * Vive aquí, en una constante, y no suelto en cada plantilla: el aviso sale
 * hoy en la tarjeta del catálogo y en la línea del panel del pedido, y si cada
 * vista trae su propia frase acaban diciendo cosas distintas para el mismo
 * caso -que es exactamente lo que pasaba antes, con "Precio a consultar" en la
 * tarjeta y "Precio con tu asesor" en el panel-.
 *
 * Es texto de interfaz, no un dato: el criterio de cuándo aplica lo pone
 * `precioSugerido`, que devuelve `null`.
 */
export const SIN_PSP = 'Precio a consultar';

/**
 * Precio de lista de una referencia que NO tiene PSP, o `null`.
 *
 * POR QUÉ EXISTE ESTE SEGUNDO PRECIO
 * ----------------------------------
 * De las 711 referencias del catálogo solo 112 traen PSP en el deck de
 * Nutresa. Las 599 restantes decían todas "Precio a consultar", que no le
 * sirve de nada a quien está armando un pedido y quiere hacerse una idea del
 * monto. El maestro de precios de SAP (`infolista.xls`) sí trae una cifra para
 * 474 de ellas: su precio de lista.
 *
 * EL PSP MANDA SIEMPRE
 * --------------------
 * Cuando la referencia tiene PSP esta función devuelve `null` aunque el
 * maestro traiga precio de lista. No son la misma cifra ni miden lo mismo, y
 * el PSP es el que de verdad ve el consumidor en el mostrador.
 *
 * NO SE CALCULA NADA
 * ------------------
 * El precio de lista está expresado por unidad de venta, y el factor de
 * conversión UMB→UMV no viene en el export. Así que la cifra se publica TAL
 * CUAL, sin dividirla entre las unidades del empaque: dividir daría un número
 * inventado con apariencia de precio unitario. Lo que sí se dice, cuando el
 * nombre de SAP lo declara, es por cuántas unidades se vende
 * (`PrecioLista.unidades`), y de eso se encarga `presentacionDeLista`.
 */
export function precioLista(producto: ConCodigo): PrecioLista | null {
  if (precioSugerido(producto) !== null) return null;
  const codigo = producto.codigo?.trim();
  if (!codigo || producto.codigoParcial) return null;
  return PRECIOS_LISTA[codigo] ?? null;
}

/**
 * El rótulo del precio de lista. Va en una constante por lo mismo que
 * `SIN_PSP`: lo pintan la tarjeta del catálogo y la línea del panel, y tienen
 * que decir exactamente lo mismo.
 *
 * NUNCA se rotula como PSP ni como "sugerido": es el precio de la lista del
 * proveedor, no lo que la tienda le cobra al consumidor, y confundirlos sería
 * el peor error posible en este renglón.
 */
export const ETIQUETA_PRECIO_LISTA = 'Precio de lista';

/** `Presentación: caja x 12`, la unidad de venta a la que corresponde la cifra. */
export const presentacionDeLista = (unidades: number) => `Presentación: caja x ${unidades}`;

/**
 * Aviso que acompaña a la foto de las referencias con precio de lista.
 *
 * La foto es la del empaque individual, mientras que el precio corresponde a
 * la unidad de venta completa. Decirlo junto a la imagen evita que se lea como
 * "esta cajita cuesta eso".
 */
export const IMAGEN_REFERENCIA = 'Imagen de referencia del producto';

/** `$ 12.900`. Sin decimales: los precios de tienda van en pesos redondos. */
export function formatearPesos(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}

/** Una línea del pedido, ya con su precio resuelto (o sin él). */
export interface LineaConPrecio {
  cantidad: number;
  psp: number | null;
}

export interface ResumenPrecios {
  /** Suma de cantidad × psp de las líneas que SÍ tienen precio. */
  subtotal: number;
  /** Cuántas referencias del pedido tienen precio de referencia. */
  conPrecio: number;
  /** Cuántas referencias tiene el pedido en total. */
  total: number;
  /** `true` solo si todas las referencias tienen precio: subtotal completo. */
  completo: boolean;
}

/**
 * Subtotal orientativo del pedido.
 *
 * Cuando alguna referencia no tiene precio el subtotal NO se oculta: se marca
 * como parcial y se dice de cuántas referencias sale. Un subtotal escondido
 * deja al tendero sin ninguna idea del monto; uno presentado como total cuando
 * le faltan la mitad de las líneas es peor, porque parece exacto.
 */
export function resumirPrecios(lineas: LineaConPrecio[]): ResumenPrecios {
  let subtotal = 0;
  let conPrecio = 0;

  for (const linea of lineas) {
    if (linea.psp === null) continue;
    subtotal += linea.psp * linea.cantidad;
    conPrecio += 1;
  }

  return {
    subtotal,
    conPrecio,
    total: lineas.length,
    completo: lineas.length > 0 && conPrecio === lineas.length,
  };
}

/**
 * Códigos de src/data/precios.ts que no corresponden a ninguna referencia del
 * catálogo: normalmente un dígito de más o un código que ya salió de línea.
 *
 * Lo usa el frontmatter del catálogo para avisarlo por consola durante
 * `npm run build`. No rompe la compilación a propósito: un precio sobrante no
 * daña la página, solo conviene limpiarlo.
 */
export function codigosSinProducto(productos: ConCodigo[]): string[] {
  const existentes = new Set(productos.map((p) => p.codigo?.trim()).filter(Boolean));
  return Object.keys(PRECIOS_SUGERIDOS).filter((codigo) => !existentes.has(codigo.trim()));
}

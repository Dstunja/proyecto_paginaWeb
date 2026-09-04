/**
 * Cruce entre el catálogo (src/data/productos.ts) y los precios sugeridos
 * (src/data/precios.ts).
 *
 * Vive aparte y son funciones PURAS a propósito: la interfaz de `Producto` no
 * se toca —el maestro de productos se regenera desde el deck de Nutresa y
 * cualquier campo agregado a mano se perdería en la siguiente regeneración—,
 * así que el precio se resuelve por CÓDIGO SAP en tiempo de compilación y solo
 * viaja al navegador de las referencias que sí lo tienen.
 *
 * Se usa desde el frontmatter de los componentes (servidor) y desde sus
 * `<script>` (navegador); por eso aquí no hay `document`, `window` ni
 * `localStorage`.
 */

import { PRECIOS_SUGERIDOS } from '../data/precios';

/** Una referencia mínima: lo que hace falta para resolverle el precio. */
export interface ConCodigo {
  codigo: string;
  codigoParcial?: boolean;
}

/**
 * Precio sugerido de una referencia, o `null` si no está confirmado.
 *
 * Devuelve `null` —y no 0 ni undefined— para que en la interfaz sea imposible
 * confundir "no sabemos" con "sale gratis". Las referencias con código parcial
 * o vacío nunca tienen precio: su código no identifica un producto único.
 */
export function precioSugerido(producto: ConCodigo): number | null {
  if (producto.codigoParcial) return null;
  const codigo = producto.codigo?.trim();
  if (!codigo) return null;
  const valor = PRECIOS_SUGERIDOS[codigo];
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : null;
}

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

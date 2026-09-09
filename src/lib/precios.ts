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
import { LISTA_PROVEEDOR } from '../data/precios-lista';

/** Una referencia mínima: lo que hace falta para resolverle el precio. */
export interface ConCodigo {
  codigo: string;
  codigoParcial?: boolean;
  /** PSP que ya trae el maestro de productos, extraído del deck de Nutresa. */
  precio?: number;
}

/**
 * Precio CONFIRMADO de una referencia, o `null` si no lo hay.
 *
 * Hay dos fuentes y este es el orden:
 *   1. src/data/precios.ts, la corrección manual por código SAP. Manda sobre
 *      todo lo demás: es donde se anota un precio que el asesor ya corrigió y
 *      que la siguiente carga del infolista no debe pisar.
 *   2. src/data/precios-lista.ts, la lista del proveedor: el precio con IVA al
 *      que la tienda compra, que es el que el sitio publica.
 *
 * El campo `precio` del maestro (el PSP del deck "MASIVO 1.0") YA NO se usa
 * como precio a mostrar. Es un precio al consumidor -lo que el tendero cobra-
 * y la lista es un precio al distribuidor -lo que el tendero paga-: mezclarlos
 * pondría en la misma grilla dos cifras que significan cosas distintas y que
 * se diferencian en torno a un 20 %. Se conserva en los datos para poder
 * comparar, pero la tarjeta muestra una sola clase de precio.
 *
 * Devuelve `null` —y no 0 ni undefined— para que en la interfaz sea imposible
 * confundir "no sabemos" con "sale gratis". Las referencias con código parcial
 * o vacío nunca cruzan: su código no identifica un producto único.
 */
export function precioConfirmado(producto: ConCodigo): number | null {
  const codigo = producto.codigo?.trim();
  if (!codigo || producto.codigoParcial) return null;

  const manual = PRECIOS_SUGERIDOS[codigo];
  if (typeof manual === 'number' && Number.isFinite(manual) && manual > 0) return manual;

  const deLista = LISTA_PROVEEDOR[codigo];
  return typeof deLista === 'number' && Number.isFinite(deLista) && deLista > 0 ? deLista : null;
}

/** Lo mínimo que hace falta para estimar por parecido: su grupo y su código. */
export interface ConCategoria extends ConCodigo {
  id: string;
  marca: string;
  categoria: string;
}

/**
 * Precio aproximado de las referencias que la lista del proveedor no cubre.
 *
 * CÓMO SE DEDUCE
 * --------------
 * El promedio de los precios confirmados de su MISMA MARCA dentro de su MISMA
 * CATEGORÍA. Si esa combinación no tiene ninguno confirmado -pasa con marcas
 * pequeñas-, se abre a toda la categoría. Si la categoría entera está sin
 * precios, la referencia se queda sin cifra y la tarjeta dice `SIN_PSP`.
 *
 * Se va de lo específico a lo general a propósito: el promedio de "Zenú" en
 * "Enlatados y conservas" se parece mucho más a una lata de Zenú que el
 * promedio de toda la categoría, donde entran marcas de otro rango de precio.
 *
 * QUÉ TAN BUENO ES ESTE NÚMERO
 * ----------------------------
 * Es un orden de magnitud, no un precio. Dentro de una misma marca y
 * categoría conviven presentaciones muy distintas -un sobre y una caja de 24-,
 * así que el promedio puede quedar lejos de una referencia concreta. Por eso
 * TODA cifra que salga de aquí viaja marcada como estimada y la tarjeta lo
 * dice: sirve para que el tendero se haga una idea del monto del pedido, no
 * para cuadrar una factura.
 *
 * Devuelve un Map por `id` y no por código SAP porque también cubre las
 * referencias de código parcial o vacío, que no tienen código con el que
 * indexarse.
 */
export function estimarPorCategoria(productos: readonly ConCategoria[]): Map<string, number> {
  const porMarca = new Map<string, number[]>();
  const porCategoria = new Map<string, number[]>();

  for (const p of productos) {
    const precio = precioConfirmado(p);
    if (precio === null) continue;
    const clave = `${p.categoria} / ${p.marca}`;
    (porMarca.get(clave) ?? porMarca.set(clave, []).get(clave)!).push(precio);
    (porCategoria.get(p.categoria) ?? porCategoria.set(p.categoria, []).get(p.categoria)!).push(
      precio,
    );
  }

  const promedio = (v: number[] | undefined) =>
    v && v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;

  const estimados = new Map<string, number>();
  for (const p of productos) {
    if (precioConfirmado(p) !== null) continue;
    const valor =
      promedio(porMarca.get(`${p.categoria} / ${p.marca}`)) ??
      promedio(porCategoria.get(p.categoria));
    if (valor !== null && valor > 0) estimados.set(p.id, valor);
  }
  return estimados;
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
 * Es texto de interfaz, no un dato: el criterio de cuándo aplica lo ponen
 * `precioConfirmado` y `estimarPorCategoria`, cuando ninguno de los dos da
 * cifra. Hoy no le toca a ninguna referencia, pero el caso sigue cubierto:
 * una lista futura puede dejar sin precio a una categoría entera.
 */
export const SIN_PSP = 'Precio a consultar';

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

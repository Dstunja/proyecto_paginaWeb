/**
 * Estado del pedido: qué referencias eligió el cliente y en qué cantidad.
 *
 * Este módulo SOLO corre en el navegador (usa localStorage y `document`): se
 * importa desde los `<script>` de los componentes, nunca desde el frontmatter
 * de un `.astro`.
 *
 * La fuente de verdad es localStorage, no una variable en memoria. Cada vez
 * que algo cambia el pedido se escribe y se avisa con un evento en `document`;
 * quien escucha vuelve a leer. Así el catálogo, el panel y el contador de la
 * barra superior siempre muestran lo mismo, aunque Astro empaquete sus
 * scripts por separado, y el pedido sobrevive al navegar entre páginas.
 */

import {
  AVISO_PRECIOS,
  CANTIDAD_MAXIMA,
  CLAVE_PEDIDO,
  LIMITE_TEXTO_URL,
  WHATSAPP_NUMERO,
} from '../data/pedido';
import { empresa } from '../data/site';
import { formatearPesos, resumirPrecios, type ResumenPrecios } from './precios';

/**
 * Producto tal como lo necesita el navegador.
 *
 * Es un subconjunto de `Producto` (src/data/productos.ts): los campos internos
 * (`codigoParcial`, `embalaje`, `paginaPdf`) no se envían al cliente porque no
 * se le muestran. El `codigo` sí viaja, pero solo para escribirlo en el
 * mensaje que recibe el asesor.
 */
export interface ProductoPedido {
  id: string;
  marca: string;
  categoria: string;
  /**
   * Segundo nivel de la categoría. Viaja porque el filtro de subcategorías
   * corre en el navegador; las categorías que no lo tienen -hoy solo
   * "Untables"- llegan sin el campo.
   */
  subcategoria?: string;
  nombre: string;
  presentacion: string;
  codigo: string;
  imagen?: string;
  /**
   * Precio sugerido al público, en pesos. Sale del PSP que trae el maestro de
   * productos (extraído del deck) o de la corrección manual en
   * src/data/precios.ts, que manda cuando existe; ver `precioSugerido` en
   * src/lib/precios.ts. Si no hay ninguno, la referencia se muestra con la
   * etiqueta "Precio con tu asesor" y no entra en el subtotal orientativo.
   */
  psp?: number;
}

/** Datos de contacto que acompañan al pedido. */
export interface DatosCliente {
  negocio: string;
  municipio: string;
  contacto: string;
  telefono: string;
}

/** Una referencia elegida y su cantidad, en unidades. */
export interface ItemPedido {
  id: string;
  cantidad: number;
}

export interface Pedido {
  /** En el orden en que se fueron agregando. */
  items: ItemPedido[];
  cliente: DatosCliente;
}

/** Evento que se dispara en `document` cada vez que el pedido cambia. */
export const EVENTO_PEDIDO = 'dst:pedido';

// ---------------------------------------------------------------------------
// Catálogo en memoria
// ---------------------------------------------------------------------------

/**
 * Índice de productos por id, para poder escribir el nombre y el código en el
 * mensaje a partir de lo guardado (que solo son ids y cantidades).
 *
 * Lo alimenta la página /pedido/ con el listado que imprimió en el HTML. Las
 * demás páginas —donde solo vive el contador de la barra— no lo necesitan.
 */
const CATALOGO = new Map<string, ProductoPedido>();

export function registrarProductos(lista: ProductoPedido[]): void {
  for (const p of lista) CATALOGO.set(p.id, p);
}

export function obtenerProducto(id: string): ProductoPedido | undefined {
  return CATALOGO.get(id);
}

// ---------------------------------------------------------------------------
// Lectura y escritura
// ---------------------------------------------------------------------------

export function pedidoVacio(): Pedido {
  return { items: [], cliente: { negocio: '', municipio: '', contacto: '', telefono: '' } };
}

/** Deja la cantidad dentro de rango y como entero. */
function normalizarCantidad(valor: unknown): number {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(n, CANTIDAD_MAXIMA);
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Lee el pedido guardado.
 *
 * Nunca lanza: si el navegador bloquea localStorage (modo privado de algunos
 * navegadores, almacenamiento deshabilitado) o el contenido quedó corrupto,
 * devuelve un pedido vacío y la página sigue funcionando, solo que sin memoria
 * entre visitas.
 */
export function leerPedido(): Pedido {
  const vacio = pedidoVacio();
  let crudo: string | null = null;

  try {
    crudo = window.localStorage.getItem(CLAVE_PEDIDO);
  } catch {
    return vacio;
  }
  if (!crudo) return vacio;

  try {
    const datos = JSON.parse(crudo) as Partial<Pedido>;
    const items: ItemPedido[] = Array.isArray(datos.items)
      ? datos.items
          .map((item) => ({ id: texto(item?.id), cantidad: normalizarCantidad(item?.cantidad) }))
          .filter((item) => item.id !== '' && item.cantidad > 0)
      : [];

    const cliente = datos.cliente ?? ({} as Partial<DatosCliente>);
    return {
      items,
      cliente: {
        negocio: texto(cliente.negocio),
        municipio: texto(cliente.municipio),
        contacto: texto(cliente.contacto),
        telefono: texto(cliente.telefono),
      },
    };
  } catch {
    return vacio;
  }
}

/**
 * Guarda el pedido y avisa a toda la página.
 *
 * `avisar` se pone en false para los cambios que no alteran la lista —escribir
 * el nombre del negocio, por ejemplo—: repintar en cada tecla movería el
 * cursor de sitio.
 */
export function guardarPedido(pedido: Pedido, avisar = true): void {
  try {
    window.localStorage.setItem(CLAVE_PEDIDO, JSON.stringify(pedido));
  } catch {
    // Sin almacenamiento el pedido solo dura lo que dure la página abierta.
  }
  if (avisar) {
    document.dispatchEvent(new CustomEvent<Pedido>(EVENTO_PEDIDO, { detail: pedido }));
  }
}

/**
 * Ejecuta `fn` cada vez que el pedido cambia, incluidos los cambios hechos en
 * otra pestaña del mismo sitio (evento `storage` del navegador).
 */
export function alCambiarPedido(fn: (pedido: Pedido) => void): void {
  document.addEventListener(EVENTO_PEDIDO, (e) => {
    const detalle = (e as CustomEvent<Pedido>).detail;
    fn(detalle ?? leerPedido());
  });
  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE_PEDIDO) fn(leerPedido());
  });
}

// ---------------------------------------------------------------------------
// Operaciones sobre el pedido (devuelven un pedido nuevo, no lo mutan)
// ---------------------------------------------------------------------------

export function cantidadDe(pedido: Pedido, id: string): number {
  return pedido.items.find((item) => item.id === id)?.cantidad ?? 0;
}

/** Fija la cantidad de una referencia. Con 0 (o menos) la saca del pedido. */
export function fijarCantidad(pedido: Pedido, id: string, cantidad: number): Pedido {
  const n = normalizarCantidad(cantidad);
  const indice = pedido.items.findIndex((item) => item.id === id);
  const items = pedido.items.filter((item) => item.id !== id);

  if (n > 0) {
    // Se conserva la posición original si ya estaba, para que la lista del
    // panel no salte de lugar al corregir una cantidad.
    if (indice >= 0) items.splice(indice, 0, { id, cantidad: n });
    else items.push({ id, cantidad: n });
  }

  return { ...pedido, items };
}

export function sumarCantidad(pedido: Pedido, id: string, delta: number): Pedido {
  return fijarCantidad(pedido, id, cantidadDe(pedido, id) + delta);
}

export function vaciarPedido(pedido: Pedido): Pedido {
  return { ...pedido, items: [] };
}

export function totalUnidades(pedido: Pedido): number {
  return pedido.items.reduce((suma, item) => suma + item.cantidad, 0);
}

export function totalReferencias(pedido: Pedido): number {
  return pedido.items.length;
}

/**
 * Subtotal orientativo del pedido, resuelto contra el catálogo en memoria.
 *
 * Las referencias sin precio confirmado no se cuentan: el resumen dice de
 * cuántas de cuántas sale el número, para que nunca se lea como un total.
 */
export function resumenDelPedido(pedido: Pedido): ResumenPrecios {
  return resumirPrecios(
    pedido.items.map((item) => ({
      cantidad: item.cantidad,
      psp: obtenerProducto(item.id)?.psp ?? null,
    })),
  );
}

// ---------------------------------------------------------------------------
// Mensaje para el asesor
// ---------------------------------------------------------------------------

/** `2 × Saltín Noel Tradicional (300 g) — cód. 1234567` */
function lineaDeItem(item: ItemPedido): string {
  const p = obtenerProducto(item.id);
  if (!p) return `${item.cantidad} × (referencia ${item.id})`;
  const codigo = p.codigo ? ` — cód. ${p.codigo}` : '';
  // El precio de referencia va también en el mensaje: así el asesor ve con qué
  // cifra hizo cuentas el cliente y sobre qué tiene que confirmar.
  const precio = typeof p.psp === 'number' ? ` — ref. ${formatearPesos(p.psp)}` : '';
  return `${item.cantidad} × ${p.nombre} (${p.presentacion})${codigo}${precio}`;
}

/** Encabezado con los datos del negocio; omite lo que no se haya llenado. */
function encabezado(pedido: Pedido): string {
  const { negocio, municipio, contacto, telefono } = pedido.cliente;
  const lineas = [`*Pedido — ${empresa.nombre}*`, ''];
  if (negocio) lineas.push(`Negocio: ${negocio}`);
  if (municipio) lineas.push(`Municipio: ${municipio}`);
  if (contacto) lineas.push(`Contacto: ${contacto}`);
  if (telefono) lineas.push(`Teléfono: ${telefono}`);
  lineas.push('', '');
  return lineas.join('\n');
}

/** Título de la lista: cuántas referencias y cuántas unidades. */
function titulo(pedido: Pedido): string {
  const referencias = totalReferencias(pedido);
  const unidades = totalUnidades(pedido);
  const r = referencias === 1 ? 'referencia' : 'referencias';
  const u = unidades === 1 ? 'unidad' : 'unidades';
  return `*Productos* (${referencias} ${r}, ${unidades} ${u})`;
}

/**
 * Línea de subtotal del mensaje. Se omite entera si ninguna referencia del
 * pedido tiene precio confirmado: un "subtotal: $ 0" confundiría al asesor más
 * de lo que ayuda.
 */
function lineaSubtotal(pedido: Pedido): string {
  const resumen = resumenDelPedido(pedido);
  if (resumen.conPrecio === 0) return '';
  const alcance = resumen.completo
    ? ''
    : ` (parcial: ${resumen.conPrecio} de ${resumen.total} referencias con precio de referencia)`;
  return `\n\n*Subtotal de referencia:* ${formatearPesos(resumen.subtotal)}${alcance}`;
}

/** Mensaje completo, sin recortar. Es también el texto del botón "Copiar". */
export function mensajePedido(pedido: Pedido): string {
  const lineas = pedido.items.map(lineaDeItem);
  return `${encabezado(pedido)}${titulo(pedido)}\n${lineas.join('\n')}${lineaSubtotal(pedido)}\n\n${AVISO_PRECIOS}`;
}

/** Cuánto ocupa el texto dentro de la URL, ya codificado. */
function largoCodificado(valor: string): number {
  return encodeURIComponent(valor).length;
}

/**
 * Arma el mensaje que cabe en la URL de WhatsApp.
 *
 * Si el pedido es muy largo se envían las primeras referencias y se avisa
 * —dentro del propio mensaje— cuántas faltan; el pedido completo se copia al
 * portapapeles para pegarlo enseguida como segundo mensaje.
 */
export function mensajeParaUrl(pedido: Pedido): {
  texto: string;
  recortado: boolean;
  omitidas: number;
} {
  const completo = mensajePedido(pedido);
  if (largoCodificado(completo) <= LIMITE_TEXTO_URL) {
    return { texto: completo, recortado: false, omitidas: 0 };
  }

  const armar = (cuantas: number) => {
    const omitidas = pedido.items.length - cuantas;
    const lineas = pedido.items.slice(0, cuantas).map(lineaDeItem);
    const aviso = `\n_(Van las primeras ${cuantas}; las otras ${omitidas} se las envío en el siguiente mensaje.)_`;
    return `${encabezado(pedido)}${titulo(pedido)}\n${lineas.join('\n')}${aviso}\n\n${AVISO_PRECIOS}`;
  };

  // Búsqueda binaria de cuántas líneas caben: con 709 referencias posibles,
  // probar de una en una obligaría a medir la URL cientos de veces.
  let bajo = 0;
  let alto = pedido.items.length;
  while (bajo < alto) {
    const medio = Math.ceil((bajo + alto) / 2);
    if (largoCodificado(armar(medio)) <= LIMITE_TEXTO_URL) bajo = medio;
    else alto = medio - 1;
  }

  return { texto: armar(bajo), recortado: true, omitidas: pedido.items.length - bajo };
}

/** URL de WhatsApp con el mensaje prellenado. */
export function enlaceWhatsapp(valor: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(valor)}`;
}

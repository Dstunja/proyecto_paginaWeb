/**
 * Migración: convierte los datos actuales de src/data/ en las tablas de la
 * hoja "Catálogo DST", con las columnas en el mismo orden.
 *
 * Es una función pura: recibe los arreglos y devuelve las tres tablas, la
 * lista de fotos que hay que copiar renombradas y un informe con lo que no
 * cabe en la hoja. Quien escribe en disco es scripts/exportar-a-hoja.mjs.
 *
 * QUÉ PRECIO SE EXPORTA
 * ---------------------
 * Solo el PSP que muestra hoy el sitio: la corrección manual de
 * src/data/precios.ts si la hay y, si no, el PSP del deck (`precio` del
 * maestro). NUNCA el precio de lista de preciosLista.ts: ese sigue en el
 * repositorio como segunda opción para las filas sin PSP, y no es un dato que
 * se administre desde la hoja.
 *
 * FOTOS
 * -----
 * En la carpeta de Drive cada foto se llama por su código SAP (productos) o
 * por su ID (ofertas). Las fotos "crop_1051111_tosh_cremademani.jpg" pasan a
 * "1051111.jpg", y las de public/img/innovacion/ que usa alguna referencia
 * pasan a su código. Un especial cuya foto no es la de su referencia del
 * catálogo lleva además "<código>-especial.<ext>".
 */
import type { ProductoEspecial } from '../../data/especiales.ts';
import type { Producto } from '../../data/productos.ts';
import type { Vacante } from '../../data/vacantes.ts';
import { COLUMNAS_LISTAS, COLUMNAS_OFERTAS, COLUMNAS_PRODUCTOS, MARCA_CODIGO_COMPARTIDO } from './columnas.ts';
import { slug } from './texto.ts';
import type { Tablas } from './tipos.ts';

export interface EntradaExportacion {
  productos: Producto[];
  marcas: readonly string[];
  categorias: readonly string[];
  subcategorias: Record<string, readonly string[]>;
  vacantes: Vacante[];
  especiales: ProductoEspecial[];
  /** PRECIOS_SUGERIDOS de src/data/precios.ts: manda sobre el PSP del deck. */
  preciosManuales: Record<string, number>;
  /** PRECIOS_ACTUALIZADOS, para anotarlo en Observaciones. */
  preciosActualizados: string;
}

/** Una foto que hay que copiar a la carpeta de Drive con otro nombre. */
export interface FotoExportada {
  /**
   * Origen relativo a la raíz del repo, SIN extensión garantizada: el script
   * la busca con cualquiera de las de imagen, igual que hace el sitio.
   */
  origen: string;
  /**
   * Nombre en la carpeta de Drive SIN extensión ('1051111', 'vendedor-tat'):
   * el script le pone la del archivo que encuentre, que es la real.
   */
  nombre: string;
}

export interface Exportacion {
  tablas: Tablas;
  fotos: FotoExportada[];
  informe: string[];
}

/** Fila 2 de cada pestaña: la ayuda que ya tiene la hoja, por si se pega entera. */
const AYUDA_PRODUCTOS: Record<keyof typeof COLUMNAS_PRODUCTOS, string> = {
  codigo: 'Código SAP de la referencia. Único (salvo CÓDIGO COMPARTIDO en Observaciones).',
  nombre: 'Nombre tal como se quiere leer en la tarjeta.',
  marca: 'Una de la pestaña Listas.',
  categoria: 'Una de la pestaña Listas.',
  subcategoria: 'Una de la pestaña Listas, o vacío.',
  presentacion: '"400 g", "20 bolsitas"...',
  unidadesPorCaja: 'Entero, opcional. No se muestra.',
  precio: 'PSP en pesos, entero sin $ ni puntos. Vacío = precio de lista.',
  descripcion: 'Solo se muestra en la tarjeta de especiales del mes.',
  imagen: 'Nombre del archivo en la carpeta de Drive. Vacío = <código>.*',
  activo: 'Sí / No.',
  etiquetaEspecial: 'Vacío = normal. Sí = especial del mes. Otro texto de Listas = especial con ese distintivo.',
  vigenteHasta: 'AAAA-MM-DD, opcional. Ese día aún se publica.',
  observaciones: 'Notas internas. No se publican. "Ejemplo" al inicio = fila ignorada.',
};

const AYUDA_OFERTAS: Record<keyof typeof COLUMNAS_OFERTAS, string> = {
  id: 'Va en la dirección: minúsculas, números y guiones (vendedor-tat). Único.',
  cargo: 'Nombre del cargo. Único entre las activas.',
  area: 'Opcional. Se muestra en el detalle si está.',
  tipoContrato: 'Uno de la pestaña Listas.',
  ciudad: 'Una de la pestaña Listas.',
  descripcion: 'Un párrafo por línea. El primero es el resumen de la tarjeta.',
  requisitos: 'Uno por línea.',
  ofrecemos: 'Uno por línea, opcional.',
  salario: 'Opcional. Se muestra en el detalle si está.',
  whatsappExtra: 'Celular adicional, opcional.',
  imagen: 'Nombre del archivo en la carpeta de Drive. Vacío = <ID>.*',
  activa: 'Sí / No.',
  publicadaEl: 'AAAA-MM-DD, opcional. Antes de ese día no sale.',
  cierraEl: 'AAAA-MM-DD, opcional. Ese día aún se publica.',
  observaciones: 'Notas internas. No se publican. "Ejemplo" al inicio = fila ignorada.',
};

export function exportar(entrada: EntradaExportacion): Exportacion {
  const informe: string[] = [];
  const fotos: FotoExportada[] = [];

  const especialPorCodigo = new Map<string, ProductoEspecial>();
  for (const e of entrada.especiales) {
    if (!e.codigo) {
      informe.push(`Especial sin código, NO exportado (la hoja identifica los especiales por su código SAP): «${e.nombre}» (${e.marca}).`);
      continue;
    }
    especialPorCodigo.set(e.codigo, e);
  }

  const veces = new Map<string, number>();
  for (const p of entrada.productos) veces.set(p.codigo, (veces.get(p.codigo) ?? 0) + 1);

  const nombresFoto = new Map<string, string>();
  const productos = entrada.productos.map((p) => {
    const compartido = (veces.get(p.codigo) ?? 0) > 1;
    const especial = especialPorCodigo.get(p.codigo);
    const imagen = fotoDeProducto(p, compartido, nombresFoto, fotos);
    if (especial && especial.imagen && p.imagen && !mismoArchivo(especial.imagen, p.imagen)) {
      fotos.push({ origen: origenPublico(especial.imagen), nombre: `${p.codigo}-especial` });
    }

    const observaciones: string[] = [];
    if (compartido) observaciones.push(MARCA_CODIGO_COMPARTIDO);
    if (p.codigoCompletado) observaciones.push('Código completado por coincidencia única en SAP; pendiente de confirmar con el asesor');
    if (entrada.preciosManuales[p.codigo] !== undefined) observaciones.push(`PSP confirmado por el asesor (${entrada.preciosActualizados})`);
    if (p.embalaje) observaciones.push(`Embalaje: ${p.embalaje}`);
    if (p.paginaPdf) observaciones.push(`Página del deck: ${p.paginaPdf}`);

    return [
      p.codigo,
      p.nombre,
      p.marca,
      p.categoria,
      p.subcategoria ?? '',
      p.presentacion,
      '',
      String(pspPublicado(p, entrada.preciosManuales) ?? ''),
      especial?.descripcion ?? '',
      imagen,
      'Sí',
      especial ? (especial.etiqueta ?? 'Sí') : '',
      '',
      observaciones.join('; '),
    ];
  });

  const ofertas = entrada.vacantes.map((v) => {
    fotos.push({ origen: origenPublico(v.imagen), nombre: v.slug });
    return [
      v.slug,
      v.cargo,
      '',
      v.tipo,
      v.ciudad,
      v.descripcion.join('\n'),
      v.requisitos.join('\n'),
      (v.ofrecemos ?? []).join('\n'),
      '',
      v.whatsappExtra?.texto ?? '',
      // Vacía: la foto se llama como el ID, que es el valor por defecto.
      '',
      'Sí',
      '',
      '',
      '',
    ];
  });

  const compartidos = [...veces].filter(([, n]) => n > 1).map(([c]) => c);
  if (compartidos.length) {
    informe.push(`Códigos compartidos por más de una fila (llevan «${MARCA_CODIGO_COMPARTIDO}» en Observaciones): ${compartidos.join(', ')}.`);
  }
  const completados = entrada.productos.filter((p) => p.codigoCompletado).length;
  if (completados) informe.push(`${completados} referencias con código completado por coincidencia única; se anota en Observaciones.`);
  informe.push('Los especiales marcados como pendientes en src/data/especiales.ts no se exportan: siguen sin confirmar.');

  const unicos = (valores: string[]) => [...new Set(valores.filter(Boolean))];
  const listas: Record<keyof typeof COLUMNAS_LISTAS, string[]> = {
    categorias: [...entrada.categorias],
    marcas: [...entrada.marcas],
    siNo: ['Sí', 'No'],
    tiposContrato: unicos(entrada.vacantes.map((v) => v.tipo)),
    ciudades: unicos(entrada.vacantes.map((v) => v.ciudad)),
    etiquetasEspeciales: unicos(['Nuevo', 'Edición limitada', ...entrada.especiales.map((e) => e.etiqueta ?? '')]),
    subcategorias: unicos(Object.values(entrada.subcategorias).flat()),
  };
  informe.push(
    `La pestaña Listas de la hoja debe contener, como mínimo: Tipo de contrato = ${listas.tiposContrato.join(' | ')}; Ciudades = ${listas.ciudades.join(' | ')}; Etiqueta especial = ${listas.etiquetasEspeciales.join(' | ')}.`,
  );

  const clavesListas = Object.keys(COLUMNAS_LISTAS) as (keyof typeof COLUMNAS_LISTAS)[];
  const largo = Math.max(...clavesListas.map((k) => listas[k].length));
  const filasListas = Array.from({ length: largo }, (_, i) => clavesListas.map((k) => listas[k][i] ?? ''));

  return {
    tablas: {
      productos: [Object.values(COLUMNAS_PRODUCTOS), Object.values(AYUDA_PRODUCTOS), ...productos],
      ofertas: [Object.values(COLUMNAS_OFERTAS), Object.values(AYUDA_OFERTAS), ...ofertas],
      listas: [Object.values(COLUMNAS_LISTAS), ...filasListas],
    },
    fotos,
    informe,
  };
}

/** El PSP que hoy muestra el sitio: corrección manual y, si no, el del deck. */
export function pspPublicado(p: Producto, manuales: Record<string, number>): number | null {
  const manual = manuales[p.codigo];
  if (typeof manual === 'number' && manual > 0) return manual;
  return typeof p.precio === 'number' && p.precio > 0 ? p.precio : null;
}

/**
 * Decide el nombre de la foto del producto en Drive, anota la copia y
 * devuelve lo que va en la columna Imagen.
 *
 * Lo normal es que la foto se llame como el código, y entonces la columna
 * queda VACÍA (es el valor por defecto): menos texto que mantener en la hoja.
 * Dos filas con el mismo código y fotos distintas no pueden llamarse las dos
 * "<código>.jpg": la segunda lleva el nombre en slug y ese nombre sí va en la
 * columna, sin extensión, porque la foto se busca por nombre.
 */
function fotoDeProducto(p: Producto, compartido: boolean, nombres: Map<string, string>, fotos: FotoExportada[]): string {
  if (!p.imagen) return '';
  const origen = p.imagen.startsWith('/') ? origenPublico(p.imagen) : `src/assets/productos/${p.imagen}`;
  const nombre = compartido && nombres.has(p.codigo) && nombres.get(p.codigo) !== origen
    ? `${p.codigo}-${slug(p.nombre)}`
    : p.codigo;
  if (!nombres.has(nombre)) {
    nombres.set(nombre, origen);
    fotos.push({ origen, nombre });
  }
  return nombre === p.codigo ? '' : nombre;
}

function origenPublico(rutaPublica: string): string {
  return `public/${rutaPublica.replace(/^\/+/, '')}`;
}

function mismoArchivo(a: string, b: string): boolean {
  return a.replace(/^\/+/, '') === b.replace(/^\/+/, '');
}

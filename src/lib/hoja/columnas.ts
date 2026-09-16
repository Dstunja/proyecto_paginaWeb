/**
 * Títulos de las columnas de la hoja "Catálogo DST", pestaña por pestaña.
 *
 * Las columnas se buscan por TÍTULO, no por posición: quien edita la hoja puede
 * reordenarlas o insertar una nueva sin romper el build. Lo que no puede hacer
 * es renombrar una: si falta un título, el build falla diciendo cuál. La
 * comparación es tolerante a mayúsculas, tildes y espacios (ver texto.ts).
 *
 * El orden de aquí es el orden en que el exportador escribe los CSV, que es
 * el mismo en que están en la hoja.
 */

export const PESTANAS = {
  productos: 'Productos',
  ofertas: 'Ofertas laborales',
  listas: 'Listas',
} as const;

export const COLUMNAS_PRODUCTOS = {
  codigo: 'Código SAP',
  nombre: 'Nombre',
  marca: 'Marca',
  categoria: 'Categoría',
  subcategoria: 'Subcategoría',
  presentacion: 'Presentación',
  unidadesPorCaja: 'Unidades por caja',
  precio: 'Precio sugerido (COP)',
  descripcion: 'Descripción',
  imagen: 'Imagen',
  activo: 'Activo',
  etiquetaEspecial: 'Etiqueta especial',
  vigenteHasta: 'Vigente hasta',
  observaciones: 'Observaciones',
} as const;

export const COLUMNAS_OFERTAS = {
  id: 'ID',
  cargo: 'Cargo',
  area: 'Área',
  tipoContrato: 'Tipo de contrato',
  ciudad: 'Ciudad / zona',
  descripcion: 'Descripción',
  requisitos: 'Requisitos',
  ofrecemos: 'Ofrecemos',
  salario: 'Salario',
  whatsappExtra: 'WhatsApp adicional',
  imagen: 'Imagen',
  activa: 'Activa',
  publicadaEl: 'Publicada el',
  cierraEl: 'Cierra el',
  observaciones: 'Observaciones',
} as const;

export const COLUMNAS_LISTAS = {
  categorias: 'Categorías',
  marcas: 'Marcas',
  siNo: 'Sí/No',
  tiposContrato: 'Tipo de contrato',
  ciudades: 'Ciudades',
  etiquetasEspeciales: 'Etiqueta especial',
  subcategorias: 'Subcategorías',
} as const;

/**
 * En Productos y Ofertas la fila 1 son los títulos y la 2 las descripciones
 * de ayuda; los datos empiezan en la 3. En Listas no hay fila de ayuda.
 */
export const PRIMERA_FILA_DATOS = { productos: 3, ofertas: 3, listas: 2 } as const;

/**
 * Última fila de valores de Listas. Lo que haya debajo (notas, cálculos) no
 * cuenta como valor admitido.
 */
export const ULTIMA_FILA_LISTAS = 200;

/** Una fila cuya columna Observaciones empieza así es de ejemplo y se ignora. */
export const PREFIJO_EJEMPLO = 'Ejemplo';

/** Dos filas pueden compartir código SAP solo si AMBAS llevan esto en Observaciones. */
export const MARCA_CODIGO_COMPARTIDO = 'CÓDIGO COMPARTIDO';

export type ClaveProducto = keyof typeof COLUMNAS_PRODUCTOS;
export type ClaveOferta = keyof typeof COLUMNAS_OFERTAS;
export type ClaveLista = keyof typeof COLUMNAS_LISTAS;

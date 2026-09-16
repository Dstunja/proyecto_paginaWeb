/**
 * Tipos compartidos por la lectura de la hoja "Catálogo DST".
 *
 * Este directorio (src/lib/hoja/) no depende de Astro ni del DOM: los mismos
 * módulos corren dentro del build, en las pruebas de Vitest y desde los
 * scripts de scripts/ con `node --experimental-strip-types`. Por eso los
 * imports entre ellos llevan la extensión .ts (Node la exige; Astro la admite
 * con `allowImportingTsExtensions`).
 */

/** Un error o un aviso de validación, con la fila de la hoja a la que apunta. */
export interface Problema {
  /** Pestaña de la hoja: 'Productos', 'Ofertas laborales' o 'Listas'. */
  pestana: string;
  /** Número de fila tal como se ve en Google Sheets (la 1 son los títulos). 0 = no aplica. */
  fila: number;
  /** Título de la columna afectada, si el problema es de una celda concreta. */
  columna?: string;
  /** Código SAP o ID de la oferta, para reconocer la fila sin abrir la hoja. */
  clave?: string;
  mensaje: string;
}

/** Las pestañas de la hoja como matrices de celdas, sin interpretar. */
export interface Tablas {
  productos: string[][];
  ofertas: string[][];
  listas: string[][];
}

/** Los valores admitidos de cada columna con lista desplegable (pestaña Listas). */
export interface Listas {
  categorias: string[];
  marcas: string[];
  siNo: string[];
  tiposContrato: string[];
  ciudades: string[];
  etiquetasEspeciales: string[];
  subcategorias: string[];
}

/** Fecha en formato ISO 'AAAA-MM-DD', sin hora. */
export type FechaISO = string;

/** Un producto de la pestaña Productos ya validado y con sus tipos. */
export interface ProductoHoja {
  fila: number;
  codigo: string;
  nombre: string;
  marca: string;
  categoria: string;
  subcategoria: string | null;
  presentacion: string;
  unidadesPorCaja: number | null;
  /** PSP en pesos, entero, o null si la celda está vacía (se usa el precio de lista). */
  precio: number | null;
  descripcion: string;
  imagen: string;
  activo: boolean;
  /**
   * null = no es especial. '' = especial sin distintivo (la celda decía "Sí").
   * Otro texto = especial con ese distintivo ('Nuevo', 'Edición limitada').
   */
  etiquetaEspecial: string | null;
  vigenteHasta: FechaISO | null;
  /** La fila lleva "CÓDIGO COMPARTIDO" en Observaciones. */
  codigoCompartido: boolean;
}

/** Una oferta de la pestaña Ofertas laborales ya validada y con sus tipos. */
export interface OfertaHoja {
  fila: number;
  id: string;
  cargo: string;
  area: string;
  tipoContrato: string;
  ciudad: string;
  /** Un párrafo por línea de la celda. */
  descripcion: string[];
  requisitos: string[];
  ofrecemos: string[];
  salario: string;
  whatsappExtra: { numero: string; texto: string } | null;
  imagen: string;
  activa: boolean;
  publicadaEl: FechaISO | null;
  cierraEl: FechaISO | null;
}

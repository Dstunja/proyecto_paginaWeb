/**
 * Primer paso: de la matriz de celdas de cada pestaña a filas con nombre.
 *
 * Aquí todavía no se valida nada de fondo; solo se localiza cada columna por
 * su título, se descartan las filas que no son datos y se devuelve cada fila
 * como un objeto `{ fila, codigo, nombre, ... }` con TODO como texto. La
 * validación y el tipado están en validar.ts.
 *
 * Filas que se descartan:
 *  - La fila 2 de Productos y Ofertas (descripciones de ayuda).
 *  - Las filas completamente vacías, estén donde estén.
 *  - Las filas cuya columna Observaciones empieza por "Ejemplo" (sin
 *    distinguir mayúsculas ni tildes): son las de muestra de la hoja.
 */
import {
  COLUMNAS_LISTAS,
  COLUMNAS_OFERTAS,
  COLUMNAS_PRODUCTOS,
  PESTANAS,
  PREFIJO_EJEMPLO,
  PRIMERA_FILA_DATOS,
  ULTIMA_FILA_LISTAS,
  type ClaveLista,
  type ClaveOferta,
  type ClaveProducto,
} from './columnas.ts';
import { celda, empiezaPor, normalizar } from './texto.ts';
import type { Listas, Problema, Tablas } from './tipos.ts';

/** Una fila de Productos u Ofertas con sus celdas como texto y su número de fila. */
export type FilaCruda<K extends string> = Record<K, string> & { fila: number };

export interface Lectura {
  productos: FilaCruda<ClaveProducto>[];
  ofertas: FilaCruda<ClaveOferta>[];
  listas: Listas;
  /** Columnas que faltan. Si hay alguno, las filas de esa pestaña vienen vacías. */
  errores: Problema[];
}

/** Lee las tres pestañas. No lanza: los títulos que falten van en `errores`. */
export function leerTablas(tablas: Tablas): Lectura {
  const errores: Problema[] = [];
  const productos = leerPestana(PESTANAS.productos, tablas.productos, COLUMNAS_PRODUCTOS, PRIMERA_FILA_DATOS.productos, errores);
  const ofertas = leerPestana(PESTANAS.ofertas, tablas.ofertas, COLUMNAS_OFERTAS, PRIMERA_FILA_DATOS.ofertas, errores);
  const listas = leerListas(tablas.listas, errores);
  return { productos, ofertas, listas, errores };
}

/**
 * Localiza cada columna por su título en la fila 1 y devuelve las filas de
 * datos. Si falta algún título, anota un error por columna y devuelve [].
 */
export function leerPestana<K extends string>(
  pestana: string,
  tabla: string[][],
  columnas: Record<K, string>,
  primeraFilaDatos: number,
  errores: Problema[],
): FilaCruda<K>[] {
  const indices = localizarColumnas(pestana, tabla[0] ?? [], columnas, errores);
  if (!indices) return [];

  const filas: FilaCruda<K>[] = [];
  const tieneObservaciones = 'observaciones' in indices;
  for (let i = primeraFilaDatos - 1; i < tabla.length; i++) {
    const celdas = tabla[i] ?? [];
    if (celdas.every((c) => celda(c) === '')) continue;
    const fila = { fila: i + 1 } as FilaCruda<K>;
    for (const clave of Object.keys(columnas) as K[]) {
      fila[clave] = celda(celdas[indices[clave]]) as FilaCruda<K>[K];
    }
    if (tieneObservaciones && empiezaPor((fila as Record<string, string>).observaciones ?? '', PREFIJO_EJEMPLO)) continue;
    filas.push(fila);
  }
  return filas;
}

/**
 * Pestaña Listas: fila 1 títulos, valores de la fila 2 a la 200. Cada columna es una
 * lista independiente; se quitan los vacíos y los repetidos (normalizados),
 * conservando el orden y la grafía de la primera aparición.
 */
export function leerListas(tabla: string[][], errores: Problema[]): Listas {
  const vacias: Listas = {
    categorias: [],
    marcas: [],
    siNo: [],
    tiposContrato: [],
    ciudades: [],
    etiquetasEspeciales: [],
    subcategorias: [],
  };
  const indices = localizarColumnas(PESTANAS.listas, tabla[0] ?? [], COLUMNAS_LISTAS, errores);
  if (!indices) return vacias;

  const listas = { ...vacias };
  for (const clave of Object.keys(COLUMNAS_LISTAS) as ClaveLista[]) {
    const vistos = new Set<string>();
    const valores: string[] = [];
    for (let i = PRIMERA_FILA_DATOS.listas - 1; i < Math.min(tabla.length, ULTIMA_FILA_LISTAS); i++) {
      const valor = celda((tabla[i] ?? [])[indices[clave]]);
      const norma = normalizar(valor);
      if (!norma || vistos.has(norma)) continue;
      vistos.add(norma);
      valores.push(valor);
    }
    listas[clave] = valores;
  }
  return listas;
}

/** Índice de cada columna en la fila de títulos, o null si falta alguna. */
function localizarColumnas<K extends string>(
  pestana: string,
  titulos: string[],
  columnas: Record<K, string>,
  errores: Problema[],
): Record<K, number> | null {
  const porTitulo = new Map<string, number>();
  titulos.forEach((t, i) => {
    const n = normalizar(celda(t));
    if (n && !porTitulo.has(n)) porTitulo.set(n, i);
  });

  const indices = {} as Record<K, number>;
  let faltan = 0;
  for (const [clave, titulo] of Object.entries(columnas) as [K, string][]) {
    const indice = porTitulo.get(normalizar(titulo));
    if (indice === undefined) {
      faltan++;
      errores.push({
        pestana,
        fila: 1,
        columna: titulo,
        mensaje:
          titulos.length === 0
            ? `la pestaña «${pestana}» está vacía o no existe`
            : `falta la columna «${titulo}» en la fila 1 (se busca por título; no la renombres)`,
      });
    } else {
      indices[clave] = indice;
    }
  }
  return faltan ? null : indices;
}

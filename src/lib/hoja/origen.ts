/**
 * De dónde salen las tablas: la variable HOJA_CATALOGO_URL decide.
 *
 *  - Sin definir: el sitio compila con src/data/*.ts, como siempre (GitHub
 *    Pages y desarrollo local).
 *  - `archivo:<carpeta>`: lee Productos.csv, Ofertas laborales.csv y
 *    Listas.csv de esa carpeta (los que escribe `npm run exportar:hoja`). Es el
 *    modo de desarrollo y de las verificaciones, y no necesita Google.
 *  - Enlace de edición de Google Sheets: lee la hoja con la cuenta de servicio
 *    (google.ts).
 *
 * Este módulo es el único de src/lib/hoja/ que toca el disco además de
 * google.ts; el resto son funciones puras.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PESTANAS } from './columnas.ts';
import { leerCsv } from './csv.ts';
import type { Tablas } from './tipos.ts';

export type Origen =
  | { tipo: 'ninguno' }
  | { tipo: 'archivo'; carpeta: string }
  | { tipo: 'google'; idHoja: string };

export const PREFIJO_ARCHIVO = 'archivo:';

export function interpretarOrigen(valor: string | undefined): Origen {
  const v = (valor ?? '').trim();
  if (!v) return { tipo: 'ninguno' };
  if (v.toLowerCase().startsWith(PREFIJO_ARCHIVO)) {
    return { tipo: 'archivo', carpeta: v.slice(PREFIJO_ARCHIVO.length).trim() };
  }
  const m = v.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (m) return { tipo: 'google', idHoja: m[1] as string };
  throw new Error(
    `HOJA_CATALOGO_URL no se entiende: «${v}». Debe ser el enlace de edición de Google Sheets (https://docs.google.com/spreadsheets/d/.../edit) o "archivo:<carpeta con los CSV>".`,
  );
}

/** Nombre del CSV de cada pestaña dentro de la carpeta del modo archivo. */
export const ARCHIVOS_CSV = {
  productos: `${PESTANAS.productos}.csv`,
  ofertas: `${PESTANAS.ofertas}.csv`,
  listas: `${PESTANAS.listas}.csv`,
} as const;

export async function leerTablasDeCarpeta(carpeta: string): Promise<Tablas> {
  const leer = async (archivo: string) => {
    try {
      return leerCsv(await readFile(join(carpeta, archivo), 'utf8'));
    } catch (e) {
      throw new Error(`No se pudo leer ${join(carpeta, archivo)}: ${(e as Error).message}`);
    }
  };
  return {
    productos: await leer(ARCHIVOS_CSV.productos),
    ofertas: await leer(ARCHIVOS_CSV.ofertas),
    listas: await leer(ARCHIVOS_CSV.listas),
  };
}

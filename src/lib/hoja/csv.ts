/**
 * Lectura y escritura de CSV (RFC 4180), sin dependencias.
 *
 * Se usa en dos sitios: el exportador escribe un CSV por pestaña para pegarlo
 * en la hoja, y el modo `archivo:` de HOJA_CATALOGO_URL lee esos mismos CSV
 * en vez de Google, para desarrollar y verificar sin cuenta de servicio.
 *
 * Detalles que importan con Google Sheets y Excel:
 *  - Las celdas con saltos de línea (descripciones, requisitos) van entre
 *    comillas y se conservan tal cual.
 *  - Al escribir se antepone un BOM: sin él, Excel en Windows abre el archivo
 *    como ANSI y las tildes se estropean. Google Sheets lo ignora.
 */

const BOM = '﻿';

/** Convierte el texto de un CSV en filas de celdas (todas como texto). */
export function leerCsv(texto: string): string[][] {
  const entrada = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;

  for (let i = 0; i < entrada.length; i++) {
    const c = entrada[i];
    if (entreComillas) {
      if (c === '"') {
        if (entrada[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }
    if (c === '"') {
      entreComillas = true;
    } else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && entrada[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else {
      celda += c;
    }
  }
  // Última fila sin salto de línea final.
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

/** Serializa filas de celdas como CSV con BOM y saltos CRLF. */
export function escribirCsv(filas: readonly (readonly unknown[])[]): string {
  const cuerpo = filas
    .map((fila) => fila.map((c) => escaparCelda(c === null || c === undefined ? '' : String(c))).join(','))
    .join('\r\n');
  return BOM + cuerpo + '\r\n';
}

function escaparCelda(valor: string): string {
  if (/[",\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

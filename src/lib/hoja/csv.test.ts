import { describe, expect, it } from 'vitest';
import { escribirCsv, leerCsv } from './csv.ts';

describe('leerCsv', () => {
  it('separa celdas, respeta comillas, comas y saltos de línea dentro de una celda', () => {
    const csv = 'a,b,c\r\n1,"dos, con coma","tres\ncon salto"\r\n';
    expect(leerCsv(csv)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'dos, con coma', 'tres\ncon salto'],
    ]);
  });

  it('desescapa comillas dobles y admite última fila sin salto final', () => {
    expect(leerCsv('x\n"dice ""hola"""')).toEqual([['x'], ['dice "hola"']]);
  });

  it('quita el BOM inicial y acepta LF, CRLF y CR', () => {
    expect(leerCsv('﻿a,b\r\n1,2\n3,4\r5,6')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ]);
  });

  it('conserva las celdas vacías', () => {
    expect(leerCsv('a,,c\n,,\n')).toEqual([['a', '', 'c'], ['', '', '']]);
  });
});

describe('escribirCsv', () => {
  it('produce un CSV con BOM que se vuelve a leer igual', () => {
    const filas = [
      ['Código', 'Nombre'],
      ['1', 'Con, coma y "comillas"\ny salto'],
      [22000, null],
    ];
    const texto = escribirCsv(filas);
    expect(texto.startsWith('﻿')).toBe(true);
    expect(leerCsv(texto)).toEqual([
      ['Código', 'Nombre'],
      ['1', 'Con, coma y "comillas"\ny salto'],
      ['22000', ''],
    ]);
  });
});

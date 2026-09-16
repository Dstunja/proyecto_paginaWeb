import { describe, expect, it } from 'vitest';
import { COLUMNAS_LISTAS, COLUMNAS_OFERTAS, COLUMNAS_PRODUCTOS } from './columnas.ts';
import { leerTablas } from './leer.ts';
import type { Tablas } from './tipos.ts';

const TITULOS_P = Object.values(COLUMNAS_PRODUCTOS);
const TITULOS_O = Object.values(COLUMNAS_OFERTAS);
const TITULOS_L = Object.values(COLUMNAS_LISTAS);

/** Una fila de Productos con las columnas en el orden de la hoja. */
function filaP(codigo: string, extras: Partial<Record<keyof typeof COLUMNAS_PRODUCTOS, string>> = {}): string[] {
  const base: Record<keyof typeof COLUMNAS_PRODUCTOS, string> = {
    codigo,
    nombre: `Producto ${codigo}`,
    marca: 'Noel',
    categoria: 'Galletas',
    subcategoria: '',
    presentacion: '100 g',
    unidadesPorCaja: '',
    precio: '',
    descripcion: '',
    imagen: '',
    activo: 'Sí',
    etiquetaEspecial: '',
    vigenteHasta: '',
    observaciones: '',
    ...extras,
  };
  return Object.keys(COLUMNAS_PRODUCTOS).map((k) => base[k as keyof typeof COLUMNAS_PRODUCTOS]);
}

const AYUDA = TITULOS_P.map(() => 'texto de ayuda');

function tablas(productos: string[][], listas: string[][] = [TITULOS_L], ofertas: string[][] = [TITULOS_O, TITULOS_O.map(() => 'ayuda')]): Tablas {
  return { productos, ofertas, listas };
}

describe('leerTablas', () => {
  it('salta la fila 2 y devuelve las filas con su número de Google Sheets', () => {
    const l = leerTablas(tablas([TITULOS_P, AYUDA, filaP('100'), filaP('200')]));
    expect(l.errores).toEqual([]);
    expect(l.productos.map((p) => [p.fila, p.codigo, p.nombre])).toEqual([
      [3, '100', 'Producto 100'],
      [4, '200', 'Producto 200'],
    ]);
  });

  it('localiza las columnas por título aunque estén en otro orden o con otra grafía', () => {
    const titulos = ['NOMBRE ', 'codigo sap', ...TITULOS_P.filter((t) => t !== 'Nombre' && t !== 'Código SAP')];
    const fila = ['Galleta X', '555', ...filaP('555').slice(2)];
    const l = leerTablas(tablas([titulos, titulos.map(() => ''), fila]));
    expect(l.errores).toEqual([]);
    expect(l.productos[0]?.codigo).toBe('555');
    expect(l.productos[0]?.nombre).toBe('Galleta X');
  });

  it('anota un error por cada columna que falta y no devuelve filas de esa pestaña', () => {
    const sinPrecio = TITULOS_P.filter((t) => t !== 'Precio sugerido (COP)' && t !== 'Activo');
    const l = leerTablas(tablas([sinPrecio, [], filaP('1')]));
    expect(l.productos).toEqual([]);
    expect(l.errores.map((e) => e.columna)).toEqual(['Precio sugerido (COP)', 'Activo']);
    expect(l.errores[0]?.mensaje).toMatch(/falta la columna/);
  });

  it('distingue una pestaña vacía de una a la que le falta una columna', () => {
    const l = leerTablas({ productos: [], ofertas: [TITULOS_O], listas: [TITULOS_L] });
    expect(l.errores[0]?.mensaje).toMatch(/está vacía o no existe/);
  });

  it('ignora las filas vacías y las de ejemplo, sin distinguir mayúsculas ni tildes', () => {
    const l = leerTablas(
      tablas([
        TITULOS_P,
        AYUDA,
        filaP('1', { observaciones: 'EJEMPLO: fila de muestra' }),
        TITULOS_P.map(() => '   '),
        filaP('2', { observaciones: 'éjemplo de cómo llenar' }),
        filaP('3', { observaciones: 'Este no es un ejemplo' }),
        [],
      ]),
    );
    expect(l.productos.map((p) => p.codigo)).toEqual(['3']);
  });

  it('recorta espacios y trata las celdas que faltan al final como vacías', () => {
    const corta = ['  9 ', ' Nombre con espacios '];
    const l = leerTablas(tablas([TITULOS_P, AYUDA, corta]));
    expect(l.productos[0]).toMatchObject({ codigo: '9', nombre: 'Nombre con espacios', observaciones: '' });
  });

  it('lee Listas desde la fila 2, quitando vacíos y repetidos pero conservando el orden y la grafía', () => {
    const l = leerTablas(
      tablas([TITULOS_P, AYUDA], [
        TITULOS_L,
        ['Galletas', 'Bénet', 'Sí', 'Tiempo completo', 'Tunja', 'Nuevo', 'Dulces'],
        ['Pastas', 'benet', 'No', '', '', '', 'Saladas'],
        ['', 'Noel', '', '', '', '', 'Dulces'],
      ]),
    );
    expect(l.listas.categorias).toEqual(['Galletas', 'Pastas']);
    expect(l.listas.marcas).toEqual(['Bénet', 'Noel']);
    expect(l.listas.siNo).toEqual(['Sí', 'No']);
    expect(l.listas.subcategorias).toEqual(['Dulces', 'Saladas']);
  });

  it('en Listas no cuenta nada por debajo de la fila 200', () => {
    const filas = Array.from({ length: 205 }, (_, i) => [i === 199 ? 'Fila 200' : i === 200 ? 'Fila 201' : '']);
    const l = leerTablas(tablas([TITULOS_P, AYUDA], [TITULOS_L, ...filas.slice(1)]));
    expect(l.listas.categorias).toEqual(['Fila 200']);
  });
});

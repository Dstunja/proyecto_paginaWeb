import { describe, expect, it } from 'vitest';
import { cargarDesdeTablas, ErrorHoja, formatearProblema } from './cargar.ts';
import { COLUMNAS_LISTAS, COLUMNAS_OFERTAS, COLUMNAS_PRODUCTOS } from './columnas.ts';
import type { Tablas } from './tipos.ts';

const TP = Object.values(COLUMNAS_PRODUCTOS);
const TO = Object.values(COLUMNAS_OFERTAS);
const TL = Object.values(COLUMNAS_LISTAS);

function tablas(productos: string[][], ofertas: string[][] = []): Tablas {
  return {
    productos: [TP, TP.map(() => 'ayuda'), ...productos],
    ofertas: [TO, TO.map(() => 'ayuda'), ...ofertas],
    listas: [TL, ['Galletas', 'Noel', 'Sí', 'Tiempo completo', 'Tunja', 'Nuevo', 'Dulces'], ['', '', 'No']],
  };
}

//                 código   nombre     marca   cat        sub  pres   u/c  precio  desc  img  activo  etiq  vig  obs
const OK = ['1', 'Galleta', 'Noel', 'Galletas', '', '100 g', '', '5000', '', '', 'Sí', '', '', ''];
const OFERTA_OK = ['vendedor', 'Vendedor', '', 'Tiempo completo', 'Tunja', 'Descripción.', 'Moto', '', '', '', '', 'Sí', '', '', ''];

describe('cargarDesdeTablas', () => {
  it('devuelve catálogo y empleos con una hoja correcta', () => {
    const carga = cargarDesdeTablas(tablas([OK], [OFERTA_OK]), { hoy: '2026-09-16' });
    expect(carga.catalogo.productos.map((p) => p.codigo)).toEqual(['1']);
    expect(carga.empleos.vacantes.map((v) => v.slug)).toEqual(['vendedor']);
    expect(carga.avisos).toEqual([]);
    expect(carga.hoy).toBe('2026-09-16');
  });

  it('lanza ErrorHoja con TODOS los errores, uno por línea, con fila y clave', () => {
    const mala1 = [...OK];
    mala1[7] = '$ 5.000';
    const mala2 = ['2', 'Otra', 'Jet', 'Galletas', '', '', '', '', '', '', 'quizá', '', '', ''];
    let error: unknown;
    try {
      cargarDesdeTablas(tablas([mala1, mala2]));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorHoja);
    const e = error as ErrorHoja;
    expect(e.errores.length).toBe(3);
    expect(e.message).toContain('3 errores');
    expect(e.message).toContain('Productos, fila 3 (1): «Precio sugerido (COP)»');
    expect(e.message).toContain('Productos, fila 4 (2): «Marca»');
    expect(e.message).toContain('Productos, fila 4 (2): «Activo»');
  });

  it('una columna que falta detiene todo antes de validar filas', () => {
    const t = tablas([OK]);
    t.productos[0] = TP.filter((c) => c !== 'Activo');
    expect(() => cargarDesdeTablas(t)).toThrow(/falta la columna «Activo»/);
  });

  it('nunca deja pasar un catálogo vacío', () => {
    const inactivo = [...OK];
    inactivo[10] = 'No';
    expect(() => cargarDesdeTablas(tablas([inactivo]))).toThrow(/no queda ningún producto publicable/);
    expect(() => cargarDesdeTablas(tablas([]))).toThrow(/no queda ningún producto publicable/);
  });

  it('las ofertas pueden estar vacías: /empleos/ muestra "no hay vacantes"', () => {
    const carga = cargarDesdeTablas(tablas([OK], []));
    expect(carga.empleos.vacantes).toEqual([]);
  });
});

describe('formatearProblema', () => {
  it('arma la línea con pestaña, fila, clave y columna', () => {
    expect(
      formatearProblema({ pestana: 'Productos', fila: 90, clave: '1049712', columna: 'Precio sugerido (COP)', mensaje: 'debe ser entero' }),
    ).toBe('Productos, fila 90 (1049712): «Precio sugerido (COP)» debe ser entero');
    expect(formatearProblema({ pestana: 'Productos', fila: 0, mensaje: 'no queda nada' })).toBe('Productos: no queda nada');
    expect(formatearProblema({ pestana: 'Ofertas laborales', fila: 5, clave: 'fila 5', columna: 'ID', mensaje: 'está vacío' })).toBe(
      'Ofertas laborales, fila 5: «ID» está vacío',
    );
  });
});

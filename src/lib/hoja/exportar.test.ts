/**
 * Ida y vuelta con los datos REALES del repositorio: exportar a las tablas de
 * la hoja, volver a cargarlas como si fueran la hoja y comprobar que el
 * catálogo y las vacantes resultantes son los mismos que hoy publica el sitio.
 * Es la garantía de que la migración no pierde ni cambia nada.
 */
import { describe, expect, it } from 'vitest';
import { especialesDelMes } from '../../data/especiales.ts';
import { PRECIOS_ACTUALIZADOS, PRECIOS_SUGERIDOS } from '../../data/precios.ts';
import { CATEGORIAS, MARCAS, SUBCATEGORIAS, productos } from '../../data/productos.ts';
import { vacantes } from '../../data/vacantes.ts';
import { cargarDesdeTablas } from './cargar.ts';
import { escribirCsv, leerCsv } from './csv.ts';
import { exportar, pspPublicado } from './exportar.ts';

const exportacion = exportar({
  productos,
  marcas: MARCAS,
  categorias: CATEGORIAS,
  subcategorias: SUBCATEGORIAS,
  vacantes,
  especiales: especialesDelMes,
  preciosManuales: PRECIOS_SUGERIDOS,
  preciosActualizados: PRECIOS_ACTUALIZADOS,
});

// Pasa por CSV de verdad, que es lo que escribe el script y lee el modo archivo.
const releidas = {
  productos: leerCsv(escribirCsv(exportacion.tablas.productos)),
  ofertas: leerCsv(escribirCsv(exportacion.tablas.ofertas)),
  listas: leerCsv(escribirCsv(exportacion.tablas.listas)),
};
const carga = cargarDesdeTablas(releidas, { hoy: '2026-09-16' });

describe('exportar → cargar (ida y vuelta con los datos reales)', () => {
  it('conserva todas las referencias, con su código, nombre, marca, categoría y subcategoría', () => {
    expect(carga.catalogo.productos.length).toBe(productos.length);
    const claves = (lista: { codigo: string; nombre: string; marca: string; categoria: string; subcategoria?: string; presentacion: string }[]) =>
      lista.map((p) => [p.codigo, p.nombre, p.marca, p.categoria, p.subcategoria ?? '', p.presentacion].join('|')).sort();
    expect(claves(carga.catalogo.productos)).toEqual(claves(productos));
  });

  it('publica exactamente el PSP que hoy muestra el sitio, y nunca el precio de lista', () => {
    const porCodigoYNombre = new Map(carga.catalogo.productos.map((p) => [`${p.codigo}|${p.nombre}`, p.precio ?? null]));
    for (const p of productos) {
      expect(porCodigoYNombre.get(`${p.codigo}|${p.nombre}`), p.codigo).toBe(pspPublicado(p, PRECIOS_SUGERIDOS));
    }
    // Los 10 PSP confirmados por el asesor mandan sobre el del deck.
    const conManual = carga.catalogo.productos.filter((p) => PRECIOS_SUGERIDOS[p.codigo] !== undefined);
    expect(conManual.length).toBe(10);
    for (const p of conManual) expect(p.precio).toBe(PRECIOS_SUGERIDOS[p.codigo]);
  });

  it('conserva las marcas, categorías y subcategorías con su orden', () => {
    expect(carga.catalogo.marcas).toEqual([...MARCAS]);
    expect(carga.catalogo.categorias).toEqual([...CATEGORIAS]);
    // Con la hoja solo se ofrecen las subcategorías que tienen productos: hoy
    // "Snacks horneados" está en SUBCATEGORIAS sin ninguna referencia y el
    // panel pinta un filtro que no devuelve nada. El orden se conserva.
    for (const [categoria, subs] of Object.entries(SUBCATEGORIAS)) {
      const usadas = subs.filter((s) => productos.some((p) => p.categoria === categoria && p.subcategoria === s));
      expect(carga.catalogo.subcategorias[categoria], categoria).toEqual(usadas);
    }
  });

  it('las dos parejas con código compartido pasan la validación y tienen ids distintos', () => {
    const ids = carga.catalogo.productos.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith('1080263')).sort()).toEqual(['1080263-monticello-spaghetti-integral', '1080263-monticello-spaghetti-n-5']);
  });

  it('los especiales con código llegan a especiales del mes con su descripción y distintivo', () => {
    const conCodigo = especialesDelMes.filter((e) => e.codigo);
    expect(carga.catalogo.especiales.length).toBe(conCodigo.length);
    for (const e of conCodigo) {
      const salida = carga.catalogo.especiales.find((s) => s.codigo === e.codigo);
      expect(salida, e.nombre).toMatchObject({ descripcion: e.descripcion, ...(e.etiqueta ? { etiqueta: e.etiqueta } : {}) });
    }
    // El que no tiene código no se puede exportar y se reporta.
    expect(exportacion.informe.some((l) => l.includes('Bénet Magnesio Gomas'))).toBe(true);
  });

  it('conserva las vacantes completas', () => {
    expect(carga.empleos.vacantes.map((v) => v.slug)).toEqual(vacantes.map((v) => v.slug));
    for (const v of vacantes) {
      const salida = carga.empleos.vacantes.find((s) => s.slug === v.slug);
      expect(salida, v.slug).toMatchObject({
        cargo: v.cargo,
        ciudad: v.ciudad,
        tipo: v.tipo,
        descripcion: v.descripcion,
        requisitos: v.requisitos,
        ...(v.ofrecemos ? { ofrecemos: v.ofrecemos } : {}),
        ...(v.whatsappExtra ? { whatsappExtra: v.whatsappExtra } : {}),
      });
    }
  });

  it('renombra las fotos por código o ID, sin repetir nombres ni dejar extensión', () => {
    const nombres = exportacion.fotos.map((f) => f.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(nombres.every((n) => /^[a-z0-9-]+$/.test(n)), 'solo el nombre base, sin punto').toBe(true);
    expect(nombres).toContain('1051111'); // era crop_1051111_tosh_cremademani.jpg
    expect(nombres).toContain('1089478'); // era /img/innovacion/jumbo-pistacho-dubai.jpg
    expect(nombres).toContain('2034008-especial'); // el especial de Badia usa otra foto que su ficha
    expect(nombres).toContain('vendedor-tat');
    expect(exportacion.fotos.find((f) => f.nombre === '1051111')?.origen).toBe('src/assets/productos/crop_1051111_tosh_cremademani.jpg');
  });

  it('la columna Imagen queda vacía salvo cuando la foto no se llama como el código', () => {
    const [titulos, , ...filas] = releidas.productos;
    const iCodigo = titulos!.indexOf('Código SAP');
    const iImagen = titulos!.indexOf('Imagen');
    const conImagen = filas.filter((f) => f[iImagen]).map((f) => [f[iCodigo], f[iImagen]]);
    expect(conImagen.sort()).toEqual([
      ['1080263', '1080263-monticello-spaghetti-n-5'],
      ['1082110', '1082110-zenu-trozos-de-atun-en-agua'],
    ]);
    const [titulosO, , ...filasO] = releidas.ofertas;
    expect(filasO.every((f) => f[titulosO!.indexOf('Imagen')] === '')).toBe(true);
  });

  it('las filas de ayuda (fila 2) no se cuelan como datos', () => {
    expect(carga.catalogo.productos.some((p) => p.nombre.includes('tal como se quiere leer'))).toBe(false);
  });
});

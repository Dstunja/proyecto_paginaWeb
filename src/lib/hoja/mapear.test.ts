import { describe, expect, it } from 'vitest';
import { mapearCatalogo, mapearEmpleos } from './mapear.ts';
import type { Listas, OfertaHoja, ProductoHoja } from './tipos.ts';

const LISTAS: Listas = {
  categorias: ['Galletas', 'Pastas', 'Untables'],
  marcas: ['Noel', 'Monticello', 'Tosh', 'Jet'],
  siNo: ['Sí', 'No'],
  tiposContrato: ['Tiempo completo'],
  ciudades: ['Tunja'],
  etiquetasEspeciales: ['Nuevo'],
  subcategorias: ['Saladas', 'Dulces', 'Largas', 'Cortas'],
};

const HOY = '2026-09-16';

function producto(extras: Partial<ProductoHoja>): ProductoHoja {
  return {
    fila: 3,
    codigo: '1',
    nombre: 'Producto',
    marca: 'Noel',
    categoria: 'Galletas',
    subcategoria: null,
    presentacion: '100 g',
    unidadesPorCaja: null,
    precio: null,
    descripcion: '',
    imagen: '',
    activo: true,
    etiquetaEspecial: null,
    vigenteHasta: null,
    codigoCompartido: false,
    ...extras,
  };
}

describe('mapearCatalogo', () => {
  it('produce la estructura de productos.ts con el código SAP como id', () => {
    const c = mapearCatalogo([producto({ codigo: '1055640', precio: 7200, subcategoria: 'Saladas', imagen: 'foto.png' })], LISTAS, HOY);
    expect(c.productos).toEqual([
      {
        id: '1055640',
        marca: 'Noel',
        categoria: 'Galletas',
        subcategoria: 'Saladas',
        nombre: 'Producto',
        presentacion: '100 g',
        codigo: '1055640',
        codigoParcial: false,
        precio: 7200,
        embalaje: '',
        paginaPdf: 0,
        imagen: 'foto.png',
      },
    ]);
  });

  it('sin precio no lleva el campo, y sin imagen usa el código', () => {
    const [p] = mapearCatalogo([producto({ codigo: '9' })], LISTAS, HOY).productos;
    expect(p).not.toHaveProperty('precio');
    expect(p).not.toHaveProperty('subcategoria');
    expect(p?.imagen).toBe('9');
  });

  it('oculta los inactivos y los vencidos, y los cuenta en el resumen', () => {
    const c = mapearCatalogo(
      [
        producto({ codigo: 'a' }),
        producto({ codigo: 'b', activo: false }),
        producto({ codigo: 'c', vigenteHasta: '2026-09-15' }),
        producto({ codigo: 'd', vigenteHasta: '2026-09-16' }),
      ],
      LISTAS,
      HOY,
    );
    expect(c.productos.map((p) => p.codigo)).toEqual(['a', 'd']);
    expect(c.resumen).toEqual({ publicables: 2, inactivos: 1, vencidos: 1, especiales: 0 });
  });

  it('las parejas con código compartido llevan el nombre en el id para distinguirse', () => {
    const c = mapearCatalogo(
      [
        producto({ codigo: '1080263', nombre: 'Monticello Spaghetti Integral', marca: 'Monticello', codigoCompartido: true }),
        producto({ codigo: '1080263', nombre: 'Monticello Spaghetti n°5', marca: 'Monticello', codigoCompartido: true }),
        producto({ codigo: '2' }),
      ],
      LISTAS,
      HOY,
    );
    expect(c.productos.map((p) => p.id)).toEqual(['1080263-monticello-spaghetti-integral', '1080263-monticello-spaghetti-n-5', '2']);
  });

  it('marcas, categorías y subcategorías salen en el orden de Listas y solo las usadas', () => {
    const c = mapearCatalogo(
      [
        producto({ codigo: 'a', marca: 'Tosh', categoria: 'Untables' }),
        producto({ codigo: 'b', marca: 'Monticello', categoria: 'Pastas', subcategoria: 'Cortas' }),
        producto({ codigo: 'c', marca: 'Monticello', categoria: 'Pastas', subcategoria: 'Largas' }),
        producto({ codigo: 'd', marca: 'Noel', categoria: 'Galletas', subcategoria: 'Dulces', activo: false }),
      ],
      LISTAS,
      HOY,
    );
    expect(c.marcas).toEqual(['Monticello', 'Tosh']);
    expect(c.categorias).toEqual(['Pastas', 'Untables']);
    expect(c.subcategorias).toEqual({ Pastas: ['Largas', 'Cortas'], Untables: [] });
  });

  it('los productos con etiqueta especial alimentan los especiales del mes, con su descripción y distintivo', () => {
    const c = mapearCatalogo(
      [
        producto({ codigo: '1089478', nombre: 'Jumbo Pistacho', marca: 'Jet', descripcion: 'Barra de 90 g.', etiquetaEspecial: 'Nuevo', imagen: '1089478.jpg' }),
        producto({ codigo: '2', nombre: 'Sin distintivo', etiquetaEspecial: '' }),
        producto({ codigo: '3', etiquetaEspecial: 'Nuevo', activo: false }),
      ],
      LISTAS,
      HOY,
    );
    expect(c.especiales).toEqual([
      { nombre: 'Jumbo Pistacho', marca: 'Jet', descripcion: 'Barra de 90 g.', imagen: '1089478.jpg', etiqueta: 'Nuevo', codigo: '1089478' },
      { nombre: 'Sin distintivo', marca: 'Noel', descripcion: '', imagen: '2', codigo: '2' },
    ]);
    expect(c.periodoEspeciales).toBe('Septiembre 2026');
    expect(c.resumen.especiales).toBe(2);
  });
});

describe('mapearEmpleos', () => {
  function oferta(extras: Partial<OfertaHoja>): OfertaHoja {
    return {
      fila: 3,
      id: 'vendedor-tat',
      cargo: 'Vendedor TAT',
      area: '',
      tipoContrato: 'Tiempo completo',
      ciudad: 'Tunja',
      descripcion: ['Resumen corto.', 'Más detalle.'],
      requisitos: ['Moto'],
      ofrecemos: [],
      salario: '',
      whatsappExtra: null,
      imagen: '',
      activa: true,
      publicadaEl: null,
      cierraEl: null,
      ...extras,
    };
  }

  it('produce la estructura de vacantes.ts con el primer párrafo como resumen', () => {
    const e = mapearEmpleos([oferta({ ofrecemos: ['Salario'], whatsappExtra: { numero: '573', texto: '3' }, area: 'Ventas', salario: '$ 2.000.000' })], HOY);
    expect(e.vacantes).toEqual([
      {
        slug: 'vendedor-tat',
        cargo: 'Vendedor TAT',
        ciudad: 'Tunja',
        tipo: 'Tiempo completo',
        resumen: 'Resumen corto.',
        imagen: 'vendedor-tat',
        descripcion: ['Resumen corto.', 'Más detalle.'],
        requisitos: ['Moto'],
        ofrecemos: ['Salario'],
        whatsappExtra: { numero: '573', texto: '3' },
        area: 'Ventas',
        salario: '$ 2.000.000',
      },
    ]);
  });

  it('omite los campos opcionales vacíos', () => {
    const [v] = mapearEmpleos([oferta({})], HOY).vacantes;
    expect(v).not.toHaveProperty('ofrecemos');
    expect(v).not.toHaveProperty('whatsappExtra');
    expect(v).not.toHaveProperty('area');
    expect(v).not.toHaveProperty('salario');
  });

  it('oculta inactivas, cerradas y futuras, y las cuenta', () => {
    const e = mapearEmpleos(
      [
        oferta({ id: 'a' }),
        oferta({ id: 'b', activa: false }),
        oferta({ id: 'c', cierraEl: '2026-09-15' }),
        oferta({ id: 'd', publicadaEl: '2026-09-17' }),
        oferta({ id: 'e', cierraEl: '2026-09-16' }),
      ],
      HOY,
    );
    expect(e.vacantes.map((v) => v.slug)).toEqual(['a', 'e']);
    expect(e.resumen).toEqual({ publicables: 2, inactivas: 1, cerradas: 1, futuras: 1 });
  });
});

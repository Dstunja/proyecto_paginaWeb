import { describe, expect, it } from 'vitest';
import type { ClaveOferta, ClaveProducto } from './columnas.ts';
import type { FilaCruda } from './leer.ts';
import type { Listas } from './tipos.ts';
import { validarOfertas, validarTodo } from './validar.ts';

const LISTAS: Listas = {
  categorias: ['Galletas', 'Pastas'],
  marcas: ['Noel', 'Bénet'],
  siNo: ['Sí', 'No'],
  tiposContrato: ['Tiempo completo'],
  ciudades: ['Tunja, Boyacá'],
  etiquetasEspeciales: ['Nuevo', 'Edición limitada'],
  subcategorias: ['Dulces', 'Largas'],
};

let contadorFila = 3;
function producto(extras: Partial<FilaCruda<ClaveProducto>> = {}): FilaCruda<ClaveProducto> {
  return {
    fila: contadorFila++,
    codigo: '1000001',
    nombre: 'Galleta',
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
}

function oferta(extras: Partial<FilaCruda<ClaveOferta>> = {}): FilaCruda<ClaveOferta> {
  return {
    fila: contadorFila++,
    id: 'vendedor-tat',
    cargo: 'Vendedor TAT',
    area: '',
    tipoContrato: 'Tiempo completo',
    ciudad: 'Tunja, Boyacá',
    descripcion: 'Primer párrafo.\nSegundo párrafo.',
    requisitos: '- Moto propia\n- Documentos al día',
    ofrecemos: '',
    salario: '',
    whatsappExtra: '',
    imagen: '',
    activa: 'Sí',
    publicadaEl: '',
    cierraEl: '',
    observaciones: '',
    ...extras,
  };
}

function erroresDeProductos(...filas: FilaCruda<ClaveProducto>[]) {
  const v = validarTodo(filas, [], LISTAS);
  return { ...v, columnas: v.errores.map((e) => e.columna) };
}

describe('validarProductos', () => {
  it('acepta una fila correcta y la tipa', () => {
    const v = erroresDeProductos(producto({ precio: '22000', unidadesPorCaja: '12', vigenteHasta: '2026-12-31', subcategoria: 'dulces' }));
    expect(v.errores).toEqual([]);
    expect(v.productos[0]).toMatchObject({
      codigo: '1000001',
      precio: 22000,
      unidadesPorCaja: 12,
      vigenteHasta: '2026-12-31',
      activo: true,
      subcategoria: 'Dulces',
      etiquetaEspecial: null,
      codigoCompartido: false,
    });
  });

  it('precio vacío es válido y queda en null', () => {
    const v = erroresDeProductos(producto({ precio: '' }));
    expect(v.errores).toEqual([]);
    expect(v.productos[0]?.precio).toBeNull();
  });

  it('rechaza precios con $, puntos, decimales, texto o cero', () => {
    // "22.000" es el caso peligroso: tomarlo como decimal publicaría $22.
    for (const precio of ['$22.000', '22.000', '22000.0', '17300,5', '22000.5', 'consultar', '0', '-5', '22 000']) {
      const v = erroresDeProductos(producto({ precio }));
      expect(v.columnas, precio).toEqual(['Precio sugerido (COP)']);
      expect(v.productos[0]?.precio, precio).toBeNull();
    }
  });

  it('avisa, sin fallar, de un precio sospechosamente alto', () => {
    const v = erroresDeProductos(producto({ precio: '2200000' }));
    expect(v.errores).toEqual([]);
    expect(v.avisos.map((a) => a.columna)).toEqual(['Precio sugerido (COP)']);
  });

  it('exige código sin espacios y nombre', () => {
    expect(erroresDeProductos(producto({ codigo: '' })).columnas).toEqual(['Código SAP']);
    expect(erroresDeProductos(producto({ codigo: '10 00' })).columnas).toEqual(['Código SAP']);
    expect(erroresDeProductos(producto({ nombre: '' })).columnas).toEqual(['Nombre']);
  });

  it('marca, categoría y subcategoría deben estar en Listas; se devuelven con la grafía de Listas', () => {
    const v = erroresDeProductos(producto({ marca: 'BENET', categoria: 'pastas ' }));
    expect(v.errores).toEqual([]);
    expect(v.productos[0]).toMatchObject({ marca: 'Bénet', categoria: 'Pastas' });

    const mal = erroresDeProductos(producto({ marca: 'Jet', categoria: 'Bebidas', subcategoria: 'Cortas' }));
    expect(mal.columnas).toEqual(['Marca', 'Categoría', 'Subcategoría']);
    expect(mal.errores[0]?.mensaje).toMatch(/no está en la columna Marcas de la pestaña Listas/);
  });

  it('Activo solo admite Sí o No (con o sin tilde, en cualquier caja)', () => {
    expect(erroresDeProductos(producto({ activo: 'si' })).productos[0]?.activo).toBe(true);
    expect(erroresDeProductos(producto({ activo: 'NO' })).productos[0]?.activo).toBe(false);
    expect(erroresDeProductos(producto({ activo: '' })).columnas).toEqual(['Activo']);
    expect(erroresDeProductos(producto({ activo: 'true' })).columnas).toEqual(['Activo']);
  });

  it('Etiqueta especial: Sí = sin distintivo, texto de Listas = distintivo, otro = error', () => {
    expect(erroresDeProductos(producto({ etiquetaEspecial: 'Sí' })).productos[0]?.etiquetaEspecial).toBe('');
    expect(erroresDeProductos(producto({ etiquetaEspecial: 'nuevo' })).productos[0]?.etiquetaEspecial).toBe('Nuevo');
    expect(erroresDeProductos(producto({ etiquetaEspecial: 'No' })).productos[0]?.etiquetaEspecial).toBeNull();
    expect(erroresDeProductos(producto({ etiquetaEspecial: 'Oferta' })).columnas).toEqual(['Etiqueta especial']);
  });

  it('fechas inválidas son error; presentación vacía es aviso', () => {
    expect(erroresDeProductos(producto({ vigenteHasta: '31/02/2026' })).columnas).toEqual(['Vigente hasta']);
    const v = erroresDeProductos(producto({ presentacion: '' }));
    expect(v.errores).toEqual([]);
    expect(v.avisos[0]?.columna).toBe('Presentación');
  });

  it('un código repetido es error en ambas filas, salvo CÓDIGO COMPARTIDO en las dos', () => {
    const repetido = erroresDeProductos(producto({ codigo: '7' }), producto({ codigo: '7', nombre: 'Otro' }));
    expect(repetido.errores.map((e) => e.fila).length).toBe(2);
    expect(repetido.errores[0]?.mensaje).toMatch(/CÓDIGO COMPARTIDO/);

    const soloUna = erroresDeProductos(
      producto({ codigo: '7', observaciones: 'CÓDIGO COMPARTIDO' }),
      producto({ codigo: '7', nombre: 'Otro' }),
    );
    expect(soloUna.errores.length).toBe(2);

    const ambas = erroresDeProductos(
      producto({ codigo: '7', observaciones: 'codigo compartido con la de agua' }),
      producto({ codigo: '7', nombre: 'Otro', observaciones: 'CÓDIGO COMPARTIDO' }),
    );
    expect(ambas.errores).toEqual([]);
    expect(ambas.productos.every((p) => p.codigoCompartido)).toBe(true);
  });

  it('dos filas con el mismo código Y el mismo nombre son una duplicada aunque lleven la marca', () => {
    const v = erroresDeProductos(
      producto({ codigo: '7', observaciones: 'CÓDIGO COMPARTIDO' }),
      producto({ codigo: '7', observaciones: 'CÓDIGO COMPARTIDO' }),
    );
    expect(v.errores[0]?.mensaje).toMatch(/fila duplicada/);
  });

  it('cada error lleva pestaña, fila, columna y código para encontrar la celda', () => {
    const v = validarTodo([producto({ fila: 42, codigo: '1049712', precio: '17.300,5' })], [], LISTAS);
    expect(v.errores[0]).toMatchObject({ pestana: 'Productos', fila: 42, columna: 'Precio sugerido (COP)', clave: '1049712' });
  });
});

describe('validarOfertas', () => {
  function validar(...filas: FilaCruda<ClaveOferta>[]) {
    const errores: never[] = [];
    const avisos: never[] = [];
    const ofertas = validarOfertas(filas, LISTAS, errores, avisos);
    return { ofertas, errores: errores as { columna?: string; mensaje: string; fila: number }[], avisos: avisos as { columna?: string }[] };
  }

  it('acepta una fila correcta, parte descripción y requisitos por líneas y quita viñetas', () => {
    const v = validar(oferta({ ofrecemos: 'Salario base\n\nComisiones', whatsappExtra: '310 878 8754', area: 'Comercial', salario: 'A convenir' }));
    expect(v.errores).toEqual([]);
    expect(v.ofertas[0]).toMatchObject({
      id: 'vendedor-tat',
      descripcion: ['Primer párrafo.', 'Segundo párrafo.'],
      requisitos: ['Moto propia', 'Documentos al día'],
      ofrecemos: ['Salario base', 'Comisiones'],
      whatsappExtra: { numero: '573108788754', texto: '310 878 8754' },
      activa: true,
      area: 'Comercial',
      salario: 'A convenir',
    });
  });

  it('el ID tiene que servir en una URL', () => {
    for (const id of ['', 'Vendedor TAT', 'vendedor_tat', 'ñandu', '-a']) {
      expect(validar(oferta({ id })).errores.map((e) => e.columna), id).toEqual(['ID']);
    }
  });

  it('tipo de contrato y ciudad deben estar en Listas', () => {
    const v = validar(oferta({ tipoContrato: 'Prestación', ciudad: 'Duitama' }));
    expect(v.errores.map((e) => e.columna)).toEqual(['Tipo de contrato', 'Ciudad / zona']);
  });

  it('descripción vacía es error, requisitos vacíos es aviso', () => {
    expect(validar(oferta({ descripcion: '' })).errores.map((e) => e.columna)).toEqual(['Descripción']);
    const v = validar(oferta({ requisitos: '' }));
    expect(v.errores).toEqual([]);
    expect(v.avisos.map((a) => a.columna)).toEqual(['Requisitos']);
  });

  it('el WhatsApp adicional admite 10 dígitos o con 57 delante y rechaza lo demás', () => {
    expect(validar(oferta({ whatsappExtra: '+57 310 878 8754' })).ofertas[0]?.whatsappExtra?.numero).toBe('573108788754');
    expect(validar(oferta({ whatsappExtra: '3108788754' })).ofertas[0]?.whatsappExtra?.texto).toBe('310 878 8754');
    expect(validar(oferta({ whatsappExtra: '8788754' })).errores.map((e) => e.columna)).toEqual(['WhatsApp adicional']);
    expect(validar(oferta({ whatsappExtra: '6017654321' })).errores.map((e) => e.columna)).toEqual(['WhatsApp adicional']);
  });

  it('fechas: inválidas son error y "Cierra el" no puede ir antes de "Publicada el"', () => {
    expect(validar(oferta({ cierraEl: 'pronto' })).errores.map((e) => e.columna)).toEqual(['Cierra el']);
    const v = validar(oferta({ publicadaEl: '2026-10-01', cierraEl: '2026-09-01' }));
    expect(v.errores[0]?.mensaje).toMatch(/anterior a «Publicada el»/);
  });

  it('ID repetido es error; cargo repetido solo si las dos están activas', () => {
    const ids = validar(oferta({ id: 'x', cargo: 'A' }), oferta({ id: 'x', cargo: 'B' }));
    expect(ids.errores.map((e) => e.columna)).toEqual(['ID', 'ID']);

    const cargos = validar(oferta({ id: 'a', cargo: 'Vendedor' }), oferta({ id: 'b', cargo: 'vendedor' }));
    expect(cargos.errores.map((e) => e.columna)).toEqual(['Cargo', 'Cargo']);

    const unaInactiva = validar(oferta({ id: 'a', cargo: 'Vendedor' }), oferta({ id: 'b', cargo: 'Vendedor', activa: 'No' }));
    expect(unaInactiva.errores).toEqual([]);
  });
});

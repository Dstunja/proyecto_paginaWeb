/**
 * Orquesta los tres pasos —leer, validar, mapear— sobre las tablas de la hoja,
 * vengan de Google o de unos CSV. Es el único punto de entrada que usan el
 * build, `verificar:hoja` y las pruebas.
 *
 * Si hay errores lanza `ErrorHoja` con TODOS ellos formateados, uno por línea,
 * para que un solo build fallido enseñe todo lo que hay que corregir y no un
 * error cada vez.
 */
import { leerTablas } from './leer.ts';
import { mapearCatalogo, mapearEmpleos, type Catalogo, type Empleos } from './mapear.ts';
import type { FechaISO, Problema, Tablas } from './tipos.ts';
import { validarTodo } from './validar.ts';
import { hoyEnColombia } from './vigencia.ts';

export interface Carga {
  catalogo: Catalogo;
  empleos: Empleos;
  avisos: Problema[];
  hoy: FechaISO;
}

export class ErrorHoja extends Error {
  errores: Problema[];
  constructor(errores: Problema[]) {
    // En orden de pestaña y fila, que es como se recorre la hoja para corregir.
    const ordenados = [...errores].sort((a, b) => a.pestana.localeCompare(b.pestana) || a.fila - b.fila);
    super(`La hoja «Catálogo DST» tiene ${errores.length} error${errores.length === 1 ? '' : 'es'}:\n${formatearProblemas(ordenados)}`);
    this.name = 'ErrorHoja';
    this.errores = ordenados;
  }
}

export function cargarDesdeTablas(tablas: Tablas, opciones: { hoy?: FechaISO } = {}): Carga {
  const hoy = opciones.hoy ?? hoyEnColombia();
  const lectura = leerTablas(tablas);
  if (lectura.errores.length) throw new ErrorHoja(lectura.errores);

  const validacion = validarTodo(lectura.productos, lectura.ofertas, lectura.listas);
  const errores = [...validacion.errores];

  const catalogo = mapearCatalogo(validacion.productos, lectura.listas, hoy);
  const empleos = mapearEmpleos(validacion.ofertas, hoy);

  // Nunca se publica un catálogo vacío: una pestaña borrada por accidente o
  // todos los productos con Activo = No dejarían el armador de pedidos sin
  // nada, y eso es peor que conservar la versión anterior.
  if (errores.length === 0 && catalogo.productos.length === 0) {
    errores.push({
      pestana: 'Productos',
      fila: 0,
      mensaje: `no queda ningún producto publicable (${lectura.productos.length} filas leídas, ${catalogo.resumen.inactivos} inactivas, ${catalogo.resumen.vencidos} vencidas)`,
    });
  }

  if (errores.length) throw new ErrorHoja(errores);
  return { catalogo, empleos, avisos: validacion.avisos, hoy };
}

/** `Productos, fila 90 (1049712): «Precio sugerido (COP)» debe ser ...` */
export function formatearProblema(p: Problema): string {
  const donde = p.fila > 0 ? `, fila ${p.fila}` : '';
  const clave = p.clave && !p.clave.startsWith('fila ') ? ` (${p.clave})` : '';
  const columna = p.columna ? `«${p.columna}» ` : '';
  return `${p.pestana}${donde}${clave}: ${columna}${p.mensaje}`;
}

export function formatearProblemas(problemas: Problema[]): string {
  return problemas.map((p) => `  - ${formatearProblema(p)}`).join('\n');
}

/** Resumen de una carga correcta, para el log del build y verificar:hoja. */
export function resumirCarga(carga: Carga): string {
  const c = carga.catalogo.resumen;
  const e = carga.empleos.resumen;
  return [
    `Hoja «Catálogo DST» leída (hoy en Colombia: ${carga.hoy}).`,
    `  Productos: ${c.publicables} publicables, ${c.inactivos} inactivos, ${c.vencidos} vencidos, ${c.especiales} en especiales del mes.`,
    `  Ofertas: ${e.publicables} publicables, ${e.inactivas} inactivas, ${e.cerradas} cerradas, ${e.futuras} aún sin publicar.`,
    `  Marcas: ${carga.catalogo.marcas.length}. Categorías: ${carga.catalogo.categorias.length}.`,
  ].join('\n');
}

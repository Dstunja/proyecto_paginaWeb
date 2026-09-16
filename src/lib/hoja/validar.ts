/**
 * Segundo paso: validar cada fila y convertirla a su tipo.
 *
 * Son funciones puras: reciben las filas crudas de leer.ts y la pestaña
 * Listas, y devuelven las filas ya tipadas más dos listas de problemas:
 *
 *  - ERRORES detienen el build. Es todo o nada: publicar un catálogo con una
 *    fila mal antes que un catálogo entero es peor que un build fallido que
 *    dice exactamente qué corregir, porque Vercel conserva la versión anterior
 *    mientras el build no pase.
 *  - AVISOS salen en el log y no detienen nada.
 *
 * Cada problema lleva pestaña, fila, columna y clave (código o ID), para que
 * quien edita la hoja encuentre la celda sin ayuda.
 *
 * Los valores con lista desplegable (marca, categoría, ciudad...) se cotejan
 * contra Listas sin distinguir mayúsculas ni tildes, y se devuelven con la
 * grafía de Listas. Así "benet" publica "Bénet".
 */
import { COLUMNAS_OFERTAS, COLUMNAS_PRODUCTOS, MARCA_CODIGO_COMPARTIDO, PESTANAS, type ClaveOferta, type ClaveProducto } from './columnas.ts';
import type { FilaCruda } from './leer.ts';
import { buscarEnLista, contiene, lineas, normalizar } from './texto.ts';
import type { Listas, OfertaHoja, Problema, ProductoHoja } from './tipos.ts';
import { parsearFecha } from './vigencia.ts';

export interface Validacion {
  productos: ProductoHoja[];
  ofertas: OfertaHoja[];
  errores: Problema[];
  avisos: Problema[];
}

/** Por encima de esto el precio casi seguro tiene un cero de más: aviso. */
export const PRECIO_SOSPECHOSO = 1_000_000;

export function validarTodo(
  productos: FilaCruda<ClaveProducto>[],
  ofertas: FilaCruda<ClaveOferta>[],
  listas: Listas,
): Validacion {
  const errores: Problema[] = [];
  const avisos: Problema[] = [];
  const p = validarProductos(productos, listas, errores, avisos);
  const o = validarOfertas(ofertas, listas, errores, avisos);
  return { productos: p, ofertas: o, errores, avisos };
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

export function validarProductos(
  filas: FilaCruda<ClaveProducto>[],
  listas: Listas,
  errores: Problema[],
  avisos: Problema[],
): ProductoHoja[] {
  const C = COLUMNAS_PRODUCTOS;
  const resultado: ProductoHoja[] = [];

  for (const f of filas) {
    const clave = f.codigo || `fila ${f.fila}`;
    const error = (columna: string, mensaje: string) =>
      errores.push({ pestana: PESTANAS.productos, fila: f.fila, columna, clave, mensaje });
    const aviso = (columna: string, mensaje: string) =>
      avisos.push({ pestana: PESTANAS.productos, fila: f.fila, columna, clave, mensaje });

    const codigo = f.codigo;
    if (!codigo) error(C.codigo, 'está vacío');
    else if (!/^[A-Za-z0-9_-]+$/.test(codigo)) error(C.codigo, `«${codigo}» solo puede llevar letras, números y guiones, sin espacios`);

    if (!f.nombre) error(C.nombre, 'está vacío');

    const marca = enLista(f.marca, listas.marcas, C.marca, 'Marcas', error);
    const categoria = enLista(f.categoria, listas.categorias, C.categoria, 'Categorías', error);
    const subcategoria = f.subcategoria
      ? enLista(f.subcategoria, listas.subcategorias, C.subcategoria, 'Subcategorías', error)
      : null;

    if (!f.presentacion) aviso(C.presentacion, 'está vacía: la tarjeta saldrá sin presentación');

    const unidadesPorCaja = enteroOpcional(f.unidadesPorCaja, C.unidadesPorCaja, error);
    const precio = enteroOpcional(f.precio, C.precio, error);
    if (precio !== null && precio > PRECIO_SOSPECHOSO) {
      aviso(C.precio, `${precio} parece demasiado alto para un precio al público; revísalo`);
    }

    const activo = siNo(f.activo, C.activo, error);
    const etiquetaEspecial = etiqueta(f.etiquetaEspecial, listas.etiquetasEspeciales, C.etiquetaEspecial, error);
    const vigenteHasta = fechaOpcional(f.vigenteHasta, C.vigenteHasta, error);

    resultado.push({
      fila: f.fila,
      codigo,
      nombre: f.nombre,
      marca: marca ?? f.marca,
      categoria: categoria ?? f.categoria,
      subcategoria,
      presentacion: f.presentacion,
      unidadesPorCaja,
      precio,
      descripcion: f.descripcion,
      imagen: f.imagen,
      activo: activo ?? false,
      etiquetaEspecial,
      vigenteHasta,
      codigoCompartido: contiene(f.observaciones, MARCA_CODIGO_COMPARTIDO),
    });
  }

  validarCodigosRepetidos(resultado, errores);
  return resultado;
}

/**
 * Un código SAP repetido es casi siempre una fila copiada por descuido, así
 * que es error... salvo que TODAS las filas del código lleven "CÓDIGO
 * COMPARTIDO" en Observaciones y tengan nombres distintos: hoy hay dos parejas
 * reales (Monticello Spaghetti Integral / n°5, Zenú Atún en aceite / en agua)
 * que comparten código y precio.
 */
function validarCodigosRepetidos(productos: ProductoHoja[], errores: Problema[]): void {
  const porCodigo = new Map<string, ProductoHoja[]>();
  for (const p of productos) {
    if (!p.codigo) continue;
    const grupo = porCodigo.get(p.codigo) ?? [];
    grupo.push(p);
    porCodigo.set(p.codigo, grupo);
  }
  for (const [codigo, grupo] of porCodigo) {
    if (grupo.length < 2) continue;
    const filas = grupo.map((p) => p.fila).join(', ');
    const nombres = new Set(grupo.map((p) => normalizar(p.nombre)));
    for (const p of grupo) {
      let mensaje: string | null = null;
      if (!grupo.every((q) => q.codigoCompartido)) {
        mensaje = `el código ${codigo} se repite en las filas ${filas}; si es a propósito, escribe «${MARCA_CODIGO_COMPARTIDO}» en Observaciones de TODAS`;
      } else if (nombres.size < grupo.length) {
        mensaje = `las filas ${filas} comparten el código ${codigo} y el mismo nombre: parece una fila duplicada`;
      }
      if (mensaje) errores.push({ pestana: PESTANAS.productos, fila: p.fila, columna: COLUMNAS_PRODUCTOS.codigo, clave: codigo, mensaje });
    }
  }
}

// ---------------------------------------------------------------------------
// Ofertas laborales
// ---------------------------------------------------------------------------

/** El ID va en la URL (/empleos/<id>/): minúsculas, números y guiones. */
const ID_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validarOfertas(
  filas: FilaCruda<ClaveOferta>[],
  listas: Listas,
  errores: Problema[],
  avisos: Problema[],
): OfertaHoja[] {
  const C = COLUMNAS_OFERTAS;
  const resultado: OfertaHoja[] = [];

  for (const f of filas) {
    const clave = f.id || `fila ${f.fila}`;
    const error = (columna: string, mensaje: string) =>
      errores.push({ pestana: PESTANAS.ofertas, fila: f.fila, columna, clave, mensaje });
    const aviso = (columna: string, mensaje: string) =>
      avisos.push({ pestana: PESTANAS.ofertas, fila: f.fila, columna, clave, mensaje });

    if (!f.id) error(C.id, 'está vacío');
    else if (!ID_VALIDO.test(f.id)) error(C.id, `«${f.id}» va en la dirección de la página: solo minúsculas, números y guiones (ej. vendedor-tat)`);

    if (!f.cargo) error(C.cargo, 'está vacío');

    const tipoContrato = enLista(f.tipoContrato, listas.tiposContrato, C.tipoContrato, 'Tipo de contrato', error);
    const ciudad = enLista(f.ciudad, listas.ciudades, C.ciudad, 'Ciudades', error);

    const descripcion = lineas(f.descripcion);
    if (descripcion.length === 0) error(C.descripcion, 'está vacía: la página de la oferta la necesita');
    const requisitos = lineas(f.requisitos);
    if (requisitos.length === 0) aviso(C.requisitos, 'está vacía: la oferta saldrá sin requisitos');

    const whatsappExtra = whatsapp(f.whatsappExtra, C.whatsappExtra, error);
    const activa = siNo(f.activa, C.activa, error);
    const publicadaEl = fechaOpcional(f.publicadaEl, C.publicadaEl, error);
    const cierraEl = fechaOpcional(f.cierraEl, C.cierraEl, error);
    if (publicadaEl && cierraEl && cierraEl < publicadaEl) {
      error(C.cierraEl, `${cierraEl} es anterior a «${C.publicadaEl}» (${publicadaEl})`);
    }

    resultado.push({
      fila: f.fila,
      id: f.id,
      cargo: f.cargo,
      area: f.area,
      tipoContrato: tipoContrato ?? f.tipoContrato,
      ciudad: ciudad ?? f.ciudad,
      descripcion,
      requisitos,
      ofrecemos: lineas(f.ofrecemos),
      salario: f.salario,
      whatsappExtra,
      imagen: f.imagen,
      activa: activa ?? false,
      publicadaEl,
      cierraEl,
    });
  }

  repetidos(resultado, (o) => o.id, C.id, 'el ID', errores);
  // Dos ofertas activas con el mismo cargo confundirían al formulario de
  // postulación, que identifica la vacante por el cargo.
  repetidos(resultado.filter((o) => o.activa), (o) => normalizar(o.cargo), C.cargo, 'el cargo', errores);
  return resultado;
}

function repetidos(ofertas: OfertaHoja[], valorDe: (o: OfertaHoja) => string, columna: string, que: string, errores: Problema[]): void {
  const grupos = new Map<string, OfertaHoja[]>();
  for (const o of ofertas) {
    const v = valorDe(o);
    if (!v) continue;
    grupos.set(v, [...(grupos.get(v) ?? []), o]);
  }
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const filas = grupo.map((o) => o.fila).join(', ');
    for (const o of grupo) {
      errores.push({ pestana: PESTANAS.ofertas, fila: o.fila, columna, clave: o.id, mensaje: `${que} se repite en las filas ${filas}` });
    }
  }
}

// ---------------------------------------------------------------------------
// Celdas
// ---------------------------------------------------------------------------

type Anotar = (columna: string, mensaje: string) => void;

function enLista(valor: string, lista: string[], columna: string, nombreLista: string, error: Anotar): string | null {
  if (!valor) {
    error(columna, 'está vacía');
    return null;
  }
  const canonico = buscarEnLista(valor, lista);
  if (canonico === null) {
    error(columna, `«${valor}» no está en la columna ${nombreLista} de la pestaña Listas`);
  }
  return canonico;
}

/**
 * Entero positivo o celda vacía. Rechaza $, puntos, comas y decimales.
 *
 * No se intenta "arreglar" un punto: en Colombia "22.000" son veinte mil, pero
 * en la API "22.5" es un decimal, y adivinar cuál quiso decir quien escribió
 * publicaría un precio mil veces menor. Una celda con formato de número llega
 * de Google como "22000" sin separadores, así que exigir solo dígitos no
 * molesta a quien usa la hoja bien.
 */
function enteroOpcional(valor: string, columna: string, error: Anotar): number | null {
  if (!valor) return null;
  if (!/^-?\d+$/.test(valor)) {
    error(columna, `debe ser un número entero sin $, puntos ni comas; dice «${valor}»`);
    return null;
  }
  const n = Number(valor);
  if (n <= 0) {
    error(columna, `debe ser mayor que 0; dice «${valor}»`);
    return null;
  }
  return n;
}

function siNo(valor: string, columna: string, error: Anotar): boolean | null {
  const n = normalizar(valor);
  if (n === 'si') return true;
  if (n === 'no') return false;
  error(columna, valor ? `solo admite Sí o No; dice «${valor}»` : 'está vacía: escribe Sí o No');
  return null;
}

/**
 * Etiqueta especial: vacía = no es especial; "Sí" = especial sin distintivo;
 * cualquier otro texto = ese distintivo, y tiene que estar en Listas.
 */
function etiqueta(valor: string, lista: string[], columna: string, error: Anotar): string | null {
  if (!valor) return null;
  if (normalizar(valor) === 'si') return '';
  if (normalizar(valor) === 'no') return null;
  const canonico = buscarEnLista(valor, lista);
  if (canonico === null) {
    error(columna, `«${valor}» no está en la columna Etiqueta especial de la pestaña Listas (o escribe Sí)`);
    return null;
  }
  return canonico;
}

function fechaOpcional(valor: string, columna: string, error: Anotar): string | null {
  if (!valor) return null;
  const fecha = parsearFecha(valor);
  if (fecha === null) error(columna, `«${valor}» no es una fecha válida; usa AAAA-MM-DD (ej. 2026-09-30)`);
  return fecha;
}

/**
 * Un celular colombiano: 10 dígitos que empiezan por 3, con o sin el 57
 * delante. Se guarda como lo espera el sitio: número con indicativo para el
 * enlace de WhatsApp y texto con espacios para mostrarlo.
 */
function whatsapp(valor: string, columna: string, error: Anotar): { numero: string; texto: string } | null {
  if (!valor) return null;
  let digitos = valor.replace(/\D/g, '');
  if (digitos.length === 12 && digitos.startsWith('57')) digitos = digitos.slice(2);
  if (digitos.length !== 10 || !digitos.startsWith('3')) {
    error(columna, `«${valor}» no parece un celular colombiano (10 dígitos, empieza por 3)`);
    return null;
  }
  return { numero: `57${digitos}`, texto: `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}` };
}

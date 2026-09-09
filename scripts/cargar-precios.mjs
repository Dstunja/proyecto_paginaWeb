/**
 * Carga la lista de precios del proveedor y genera src/data/precios-lista.ts.
 *
 * DE DÓNDE SALE EL ARCHIVO
 * ------------------------
 * Nutresa entrega un "infolista" con extensión .xls que en realidad es HTML:
 * una tabla exportada desde Excel. No hay que convertirlo a nada, se lee tal
 * cual. Trae una fila por PRODUCTO x FUERZA DE VENTAS x LISTA, así que las
 * ~49.000 filas del archivo se reducen a ~1.000 códigos SAP.
 *
 * QUÉ COLUMNA SE PUBLICA
 * ----------------------
 * `Valor + IVA`: el precio con IVA al que la tienda compra. Es el precio que
 * el sitio muestra, porque el armador de pedidos es para el tendero y ese es
 * el valor que él va a pagar -no el PSP, que es lo que él le cobra al
 * consumidor-. `Valor_Lista` es esa misma cifra sin IVA y no se usa.
 *
 * CÓMO SE ELIGE UN PRECIO ENTRE VARIAS FILAS
 * ------------------------------------------
 * 1. Se descartan las filas fuera de vigencia: solo cuentan las que hoy están
 *    entre `Fecha Inicial` y `Fecha Final`.
 * 2. Se descartan las filas con valor 0. Un 0 en esta lista no es un precio,
 *    es un dato que falta; promediarlo hundiría el precio del producto. Esto
 *    es lo que rescata decenas de referencias que, colapsando el archivo sin
 *    mirar, saldrían en 0.
 * 3. De las que quedan se toma la MODA -el precio que más se repite entre las
 *    fuerzas de ventas-. Casi todas las referencias traen un único valor; en
 *    las pocas que difieren, la diferencia es de décimas y la moda es el
 *    precio de la mayoría de los canales, que es el representativo.
 *
 *     node scripts/cargar-precios.mjs [ruta del .xls]
 *
 * Sin argumento toma el .xls más reciente de src/data/. Ese archivo es
 * información interna del proveedor y está en .gitignore: al repositorio solo
 * sube el resultado, que son los precios de las referencias del catálogo.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { productos } from '../src/data/productos.ts';

const RAIZ = process.cwd();
const DATOS = join(RAIZ, 'src/data');
const SALIDA = join(DATOS, 'precios-lista.ts');

/** El .xls indicado, o el más reciente que haya en src/data/. */
function archivoDeEntrada() {
  const dado = process.argv[2];
  if (dado) return dado;
  const candidatos = readdirSync(DATOS)
    .filter((f) => /^infolista.*\.xlsx?$/i.test(f))
    .sort();
  if (!candidatos.length) {
    console.error('No hay ningún infolista*.xls en src/data/. Pasa la ruta como argumento.');
    process.exit(1);
  }
  return join(DATOS, candidatos.at(-1));
}

const ENTRADA = archivoDeEntrada();

/*
 * El archivo viene en cp1252 (viene de Excel en Windows). Leerlo como UTF-8
 * parte los acentos: "Maíz" quedaría como "Ma?z" y "Zenú" como "Zen?".
 */
const html = readFileSync(ENTRADA).toString('latin1');

const filas = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
if (filas.length < 2) {
  console.error(`${ENTRADA} no parece la tabla esperada: ${filas.length} filas.`);
  process.exit(1);
}

const celdasDe = (fila) =>
  [...fila.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, c]) =>
    c
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim(),
  );

const cabecera = celdasDe(filas[0]);
const col = Object.fromEntries(cabecera.map((c, i) => [c, i]));
for (const necesaria of ['Pro_Cod', 'Valor + IVA', 'Fecha Inicial', 'Fecha Final', 'Producto']) {
  if (col[necesaria] === undefined) {
    console.error(`Falta la columna "${necesaria}". Cabecera leída: ${cabecera.join(' | ')}`);
    process.exit(1);
  }
}

/** '10,781.40' -> 10781.4. Miles con coma y decimales con punto. */
const numero = (v) => {
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

const hoy = new Date().toISOString().slice(0, 10);

/** { SAP: { valores: [precios vigentes > 0], nombre } } */
const porSap = new Map();
let filasLeidas = 0;
let fueraDeVigencia = 0;
let enCero = 0;

for (const fila of filas.slice(1)) {
  const c = celdasDe(fila);
  if (c.length < cabecera.length) continue;
  filasLeidas += 1;

  if (!(c[col['Fecha Inicial']] <= hoy && hoy <= c[col['Fecha Final']])) {
    fueraDeVigencia += 1;
    continue;
  }
  const valor = numero(c[col['Valor + IVA']]);
  if (!valor || valor <= 0) {
    enCero += 1;
    continue;
  }

  const sap = c[col['Pro_Cod']].trim();
  if (!sap) continue;
  const entrada = porSap.get(sap) ?? { valores: [], nombre: c[col['Producto']] };
  entrada.valores.push(valor);
  porSap.set(sap, entrada);
}

/** El valor que más se repite; ante empate, el mayor. */
function moda(valores) {
  const cuenta = new Map();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor = null;
  let mejorN = -1;
  for (const [v, n] of cuenta) {
    if (n > mejorN || (n === mejorN && v > mejor)) {
      mejor = v;
      mejorN = n;
    }
  }
  return mejor;
}

const lista = new Map();
for (const [sap, { valores }] of porSap) lista.set(sap, Math.round(moda(valores)));

/* Al archivo generado solo bajan los códigos que EXISTEN en el catálogo. La
   lista del proveedor cubre todo su portafolio nacional; meter los ~450
   códigos que este catálogo no vende engordaría el bundle del navegador con
   datos que nadie va a leer, y publicaría precios de referencias que la
   empresa ni siquiera distribuye. */
const delCatalogo = new Map();
for (const p of productos) {
  const codigo = p.codigo?.trim();
  if (!codigo || p.codigoParcial) continue;
  const precio = lista.get(codigo);
  if (precio) delCatalogo.set(codigo, precio);
}

const fecha = (ENTRADA.match(/(\d{4})(\d{2})(\d{2})/) ?? []).slice(1).join('-') || hoy;
const entradas = [...delCatalogo].sort(([a], [b]) => a.localeCompare(b));

const salida = `// GENERADO por scripts/cargar-precios.mjs — no editar a mano.
// Fuente: infolista del proveedor con fecha ${fecha}.
//
// Precio CON IVA al que la tienda compra, por código SAP. Es el valor que
// muestra el armador de pedidos: quien lo usa es el tendero, y este es el
// precio que él va a pagar. Solo están las referencias de este catálogo; la
// lista completa del proveedor es información interna y no entra al
// repositorio (ver .gitignore).
//
// Para actualizarlo: deja el nuevo infolista en src/data/ y corre
// \`npm run precios:cargar\`.

/** Fecha de la lista de la que salieron estos precios ('2026-09-04'). */
export const LISTA_FECHA = '${fecha}';

/** { 'código SAP': precio con IVA en pesos enteros }. ${entradas.length} referencias. */
export const LISTA_PROVEEDOR: Record<string, number> = {
${entradas.map(([sap, v]) => `  '${sap}': ${v},`).join('\n')}
};
`;

writeFileSync(SALIDA, salida);

const conCodigo = productos.filter((p) => p.codigo?.trim() && !p.codigoParcial);
console.log(`Archivo leído: ${ENTRADA}`);
console.log(`  filas de datos: ${filasLeidas}`);
console.log(`  descartadas por vigencia: ${fueraDeVigencia}`);
console.log(`  descartadas por venir en 0: ${enCero}`);
console.log(`  códigos SAP con precio útil: ${lista.size}`);
console.log('');
console.log(`Catálogo: ${productos.length} referencias`);
console.log(`  con código SAP completo: ${conCodigo.length}`);
console.log(`  CON precio en la lista:   ${delCatalogo.size}`);
console.log(`  SIN precio en la lista:   ${productos.length - delCatalogo.size}`);
console.log('');
console.log(`Escrito ${SALIDA} con ${entradas.length} precios.`);

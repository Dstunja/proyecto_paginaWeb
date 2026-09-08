/**
 * Genera src/data/preciosLista.ts a partir del export `infolista.xls` de SAP.
 *
 *   node scripts/extraer-precios-lista.mjs [ruta del .xls]
 *
 * Por defecto lee docs/catalogo-fuente/infolista20260904.xls. Esa carpeta está
 * en .gitignore: el export trae el maestro de precios completo de Nutresa y no
 * puede subirse al repositorio. Lo que sí se commitea es su SALIDA, que es un
 * recorte -solo las referencias del catálogo que no tienen PSP- y solo la
 * columna que el sitio muestra.
 *
 * QUÉ COLUMNA SE TOMA
 * -------------------
 * `Valor + IVA`, no `Valor_Lista`. Son los dos precios de lista que trae el
 * export; el sitio publica el que incluye IVA porque es el que se compara con
 * lo que se paga. En los productos excluidos de IVA -casi todas las especias
 * Badia- las dos columnas traen la misma cifra.
 *
 * NO se calcula ningún precio por unidad. El export no trae el factor de
 * conversión UMB→UMV, así que dividir el precio entre las unidades del empaque
 * daría una cifra inventada; en su lugar se publica el precio tal cual y, al
 * lado, la presentación por la que se vende cuando el nombre de SAP la declara.
 *
 * CÓMO SE ELIGE LA CIFRA CUANDO HAY VARIAS
 * ----------------------------------------
 * Un código aparece muchas veces, una por fuerza de ventas y lista de precios.
 * Casi siempre todas dicen lo mismo; ocho referencias (Comarrico, Doria y
 * Monticello) traen dos cifras distintas. El desempate va en este orden:
 *
 *   1. Se descartan las filas que todavía no rigen (`Fecha Inicial` posterior
 *      a la fecha del export) y las vencidas (`Fecha Final` anterior). Cuatro
 *      de esas ocho se resuelven aquí: la otra lista lleva `3000-01-01`, un
 *      marcador de "pendiente de entrar en vigor".
 *   2. Se prefiere `Tipo de precio` = "1000 - Total Compañía" sobre las listas
 *      de subcanal u oficina de ventas. Es la que aplica a todo el país, que
 *      es lo que corresponde a una página pública. Aquí se resuelven las tres
 *      pastas Doria y el aceite Monticello.
 *   3. Si aún quedan varias, gana la de `Fecha Inicial` más reciente.
 *   4. Si sigue habiendo empate, la referencia se queda SIN precio. Hoy no
 *      cae ninguna en este caso, pero es la salida segura: antes de publicar
 *      una cifra elegida al azar, no se publica ninguna.
 *
 * QUÉ QUEDA FUERA
 * ---------------
 *   - Las referencias que ya tienen PSP: el PSP manda siempre y es el precio
 *     que de verdad ve el consumidor.
 *   - Las de código vacío o parcial (`codigoParcial`), que no identifican una
 *     referencia única.
 *   - Los combos "CMU", mecánicas internas con vigencia. Ya estaban fuera del
 *     catálogo por esa razón y no vuelven a entrar por la puerta del precio.
 *   - Los códigos que el catálogo le da a DOS referencias distintas. Hoy son
 *     dos: el deck repitió 1080263 en el Spaghetti Integral y en el n°5, y
 *     1082110 en el atún en aceite y en el atún en agua. Una de las dos tiene
 *     mal el código y no hay forma de saber cuál, así que ninguna lleva cifra.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLS = process.argv[2] ?? path.join(RAIZ, 'docs/catalogo-fuente/infolista20260904.xls');
const DESTINO = path.join(RAIZ, 'src/data/preciosLista.ts');

/**
 * Fecha de corte para decidir qué precios rigen: la del export, no la de hoy.
 * Va fija para que el archivo generado sea reproducible -volver a correr el
 * script el mes que viene sobre el mismo .xls tiene que dar lo mismo-.
 */
const CORTE = '2026-09-04';

/** El nombre de SAP declara las unidades del empaque: "BADIA 42.5g x 12 UND". */
const UNIDADES = /\bx\s*(\d+)\s*und\b/i;

// ---------------------------------------------------------------------------
// 1. Leer el export
// ---------------------------------------------------------------------------

/*
 * `infolista.xls` no es un binario de Excel: es la tabla en HTML que exporta
 * SAP, guardada con extensión .xls, en latin1 y sin saltos de línea útiles.
 * Por eso se lee entero y se trocea con expresiones regulares en vez de con
 * una librería de hojas de cálculo.
 */
const crudo = fs.readFileSync(XLS, 'latin1');
const filas = crudo.match(/<tr>.*?<\/tr>/gs) ?? [];
if (filas.length < 2) {
  console.error(`[precios-lista] ${XLS} no parece el export de SAP: no tiene filas.`);
  process.exit(1);
}

const celdas = (fila) =>
  [...fila.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((m) =>
    m[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim(),
  );

const CABECERA = celdas(filas[0]);
const col = (nombre) => {
  const i = CABECERA.indexOf(nombre);
  if (i === -1) {
    console.error(`[precios-lista] el export no trae la columna "${nombre}".`);
    process.exit(1);
  }
  return i;
};
const C_COD = col('Pro_Cod');
const C_NOMBRE = col('Producto');
const C_VALOR = col('Valor + IVA');
const C_INI = col('Fecha Inicial');
const C_FIN = col('Fecha Final');
const C_TIPO = col('Tipo de precio');

/** Candidatos por código: una entrada por cifra distinta, con sus atributos. */
const porCodigo = new Map();

for (let i = 1; i < filas.length; i++) {
  const c = celdas(filas[i]);
  if (c.length <= C_TIPO) continue;

  const codigo = c[C_COD];
  const valor = Number(String(c[C_VALOR]).replace(/,/g, ''));
  if (!codigo || !Number.isFinite(valor) || valor <= 0) continue;

  // Regla 1: fuera lo que no rige a la fecha del export.
  if (c[C_INI] && c[C_INI] > CORTE) continue;
  if (c[C_FIN] && c[C_FIN] < CORTE) continue;

  const reg = porCodigo.get(codigo) ?? { nombre: c[C_NOMBRE], candidatos: new Map() };
  const cand = reg.candidatos.get(valor) ?? { valor, totalCompania: false, desde: '' };
  if (/^1000\b/.test(c[C_TIPO])) cand.totalCompania = true;
  if (c[C_INI] > cand.desde) cand.desde = c[C_INI];
  reg.candidatos.set(valor, cand);
  porCodigo.set(codigo, reg);
}

/** Aplica las reglas 2 y 3; devuelve `null` si no hay ganador claro (regla 4). */
function elegir(registro) {
  let candidatos = [...registro.candidatos.values()];
  if (candidatos.length === 1) return candidatos[0].valor;

  const total = candidatos.filter((c) => c.totalCompania);
  if (total.length > 0) candidatos = total;
  if (candidatos.length === 1) return candidatos[0].valor;

  const masReciente = candidatos.reduce((a, c) => (c.desde > a ? c.desde : a), '');
  candidatos = candidatos.filter((c) => c.desde === masReciente);
  return candidatos.length === 1 ? candidatos[0].valor : null;
}

// ---------------------------------------------------------------------------
// 2. Cruzar con el catálogo
// ---------------------------------------------------------------------------

/*
 * src/data/productos.ts es TypeScript, pero el array de productos es un
 * literal de objetos sin nada de TS dentro, así que se recorta y se evalúa.
 * Es un script de mantenimiento que corre a mano sobre un archivo del propio
 * repositorio; no hace falta montar un compilador para leerlo.
 */
const fuente = fs.readFileSync(path.join(RAIZ, 'src/data/productos.ts'), 'utf8');
const ENCABEZADO = 'export const productos: Producto[] = ';
const desde = fuente.indexOf(ENCABEZADO);
const hasta = fuente.indexOf('\n];', desde);
if (desde === -1 || hasta === -1) {
  console.error('[precios-lista] no encontré el array `productos` en src/data/productos.ts.');
  process.exit(1);
}
const productos = eval(fuente.slice(desde + ENCABEZADO.length, hasta + 2));

/*
 * Códigos que el catálogo usa en más de una referencia. El precio se busca POR
 * CÓDIGO, así que un código repetido devolvería la misma cifra para dos
 * productos distintos cuando, como mucho, uno de los dos la tiene bien.
 */
const vecesUsado = new Map();
for (const p of productos) {
  const codigo = (p.codigo ?? '').trim();
  if (!codigo || p.codigoParcial) continue;
  vecesUsado.set(codigo, (vecesUsado.get(codigo) ?? 0) + 1);
}

const entradas = [];
let sinPsp = 0;
let conUnidades = 0;
let fueraCmu = 0;
let repetidos = 0;
let ambiguos = 0;
let sinPrecio = 0;

for (const p of productos) {
  if (typeof p.precio === 'number') continue; // ya tiene PSP: manda el PSP
  sinPsp++;

  const codigo = (p.codigo ?? '').trim();
  if (!codigo || p.codigoParcial) {
    sinPrecio++;
    continue;
  }

  if ((vecesUsado.get(codigo) ?? 0) > 1) {
    console.warn(
      `[precios-lista] ${codigo} lo usan ${vecesUsado.get(codigo)} referencias del catálogo; ninguna lleva cifra.`,
    );
    repetidos++;
    sinPrecio++;
    continue;
  }

  const registro = porCodigo.get(codigo);
  if (!registro) {
    sinPrecio++;
    continue;
  }

  if (/^CMU/i.test(registro.nombre)) {
    fueraCmu++;
    sinPrecio++;
    continue;
  }

  const valor = elegir(registro);
  if (valor === null) {
    console.warn(`[precios-lista] ${codigo} tiene precios empatados; queda sin cifra.`);
    ambiguos++;
    sinPrecio++;
    continue;
  }

  const m = UNIDADES.exec(registro.nombre);
  if (m) conUnidades++;
  entradas.push({ codigo, valor, unidades: m ? Number(m[1]) : null, nombre: registro.nombre });
}

entradas.sort((a, b) => a.codigo.localeCompare(b.codigo));

// ---------------------------------------------------------------------------
// 3. Escribir el archivo de datos
// ---------------------------------------------------------------------------

const lineas = entradas.map((e) => {
  const unidades = e.unidades !== null ? `, unidades: ${e.unidades}` : '';
  return `  '${e.codigo}': { valor: ${e.valor}${unidades} },`;
});

const salida = `// GENERADO por scripts/extraer-precios-lista.mjs — no editar a mano.
// Fuente: ${path.basename(XLS)} (export de precios de SAP), columna "Valor + IVA",
// precios vigentes al ${CORTE}. Volver a generar con:
//     node scripts/extraer-precios-lista.mjs <ruta del .xls>

/**
 * Precio de lista de una referencia, tal como viene del export de SAP.
 *
 * NO es un precio por unidad y NO se divide por nada: \`valor\` es la cifra del
 * maestro, y \`unidades\` -cuando el nombre de SAP la declara- dice por cuántas
 * unidades se vende. El sitio los muestra uno al lado del otro y deja que sea
 * el asesor quien cierre el precio final.
 */
export interface PrecioLista {
  /** Pesos colombianos, IVA incluido. Puede traer decimales; se redondea al pintar. */
  valor: number;
  /** Unidades del empaque, solo si el nombre de SAP trae el patrón "x N UND". */
  unidades?: number;
}

/**
 * Por CÓDIGO SAP, igual que src/data/precios.ts y por la misma razón: el \`id\`
 * del producto se deriva del nombre y cambiaría con cualquier corrección de
 * texto, mientras que el código es el identificador estable.
 *
 * Solo están las referencias SIN PSP: donde hay PSP, manda el PSP.
 */
export const PRECIOS_LISTA: Record<string, PrecioLista> = {
${lineas.join('\n')}
};
`;

fs.writeFileSync(DESTINO, salida, 'utf8');

console.log(`[precios-lista] ${path.relative(RAIZ, DESTINO)} escrito.`);
console.log(`  referencias sin PSP:            ${sinPsp}`);
console.log(`  con precio de lista:            ${entradas.length}`);
console.log(`  ...de esas, con presentación:   ${conUnidades}`);
console.log(`  combos CMU descartados:         ${fueraCmu}`);
console.log(`  con código SAP repetido:        ${repetidos}`);
console.log(`  empatados (sin cifra):          ${ambiguos}`);
console.log(`  siguen en "Precio a consultar": ${sinPrecio}`);

/**
 * Llena el campo `imagen` de src/data/productos.ts con las fotos que ya están
 * en src/assets/productos/, cruzando por CÓDIGO SAP.
 *
 * Es el segundo paso de scripts/descargar-fotos.mjs: ese deja el archivo
 * nombrado con el código SAP, y este lo conecta al producto. Van separados
 * porque bajar fotos toca la red y esto toca el maestro de productos; poder
 * repetir lo segundo sin repetir lo primero hace la diferencia cuando una
 * descarga se cae a la mitad.
 *
 * SOLO CONECTA LO QUE ES INEQUÍVOCO. Si dos referencias comparten el mismo
 * código SAP -en el catálogo de hoy pasa con 1080263 (Monticello Spaghetti) y
 * 1082110 (Zenú atún), que el deck dejó repetidos-, no se toca ninguna de las
 * dos: el archivo es uno solo y no hay forma de saber a cuál de las dos
 * corresponde. Ponerle la misma foto a las dos sería inventar el dato.
 *
 * Tampoco pisa un `imagen` que ya esté puesto: las fotos curadas a mano de
 * /img/innovacion/ mandan sobre las del fabricante.
 *
 *     node scripts/conectar-fotos.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { productos } from '../src/data/productos.ts';

const MAESTRO = join(process.cwd(), 'src/data/productos.ts');
const DESTINO = join(process.cwd(), 'src/assets/productos');

/** { '2034008': '2034008.png' } — el archivo que le toca a cada código SAP. */
const porCodigo = new Map();
for (const archivo of readdirSync(DESTINO)) {
  porCodigo.set(archivo.replace(/\.[a-z0-9]+$/i, ''), archivo);
}

/** Cuántas referencias usan cada código, para no conectar los repetidos. */
const vecesUsado = new Map();
for (const p of productos) {
  const codigo = p.codigo?.trim();
  if (codigo) vecesUsado.set(codigo, (vecesUsado.get(codigo) ?? 0) + 1);
}

let texto = readFileSync(MAESTRO, 'utf8');
const conectadas = [];
const repetidas = [];

for (const p of productos) {
  const codigo = p.codigo?.trim();
  if (!codigo || p.codigoParcial || p.imagen) continue;

  const archivo = porCodigo.get(codigo);
  if (!archivo) continue;

  if (vecesUsado.get(codigo) > 1) {
    repetidas.push(p);
    continue;
  }

  // La entrada es una línea sola y `imagen` va de última, así que basta con
  // colgarla del cierre. Se ancla en el `id`, que sí es único, y no en el
  // código: así una línea mal formada falla ruidosamente en vez de editar otra.
  const ancla = `{ id: ${JSON.stringify(p.id)},`;
  const inicio = texto.indexOf(ancla);
  if (inicio === -1) {
    console.log(`  ¡sin ancla! ${codigo} ${p.nombre}`);
    continue;
  }
  // El maestro está guardado con saltos de Windows, así que el cierre de la
  // línea se busca con una expresión regular que acepta CRLF y LF por igual:
  // buscarlo como texto plano fallaba en silencio y no conectaba ninguna foto.
  const cierre = /\s\},\r?\n/g;
  cierre.lastIndex = inicio;
  const encontrado = cierre.exec(texto);
  if (!encontrado) {
    console.log(`  ¡sin cierre! ${codigo} ${p.nombre}`);
    continue;
  }
  const fin = encontrado.index;

  texto = texto.slice(0, fin) + `, imagen: ${JSON.stringify(archivo)}` + texto.slice(fin);
  conectadas.push({ codigo, archivo, nombre: p.nombre, marca: p.marca });
}

if (conectadas.length) writeFileSync(MAESTRO, texto);

console.log(`Fotos conectadas: ${conectadas.length}`);
for (const c of conectadas) console.log(`  ${c.codigo} -> ${c.archivo}  ${c.marca} — ${c.nombre}`);
if (repetidas.length) {
  console.log(`\nNo conectadas por código SAP repetido: ${repetidas.length}`);
  for (const p of repetidas) console.log(`  ${p.codigo}  ${p.marca} — ${p.nombre}`);
}

/**
 * Descarga la hoja "Catálogo DST" y la valida SIN compilar el sitio, para
 * comprobar antes de publicar que el build va a pasar.
 *
 * Uso:
 *   npm run verificar:hoja                      (lee HOJA_CATALOGO_URL del entorno o de .env)
 *   npm run verificar:hoja -- archivo:../hoja-exportada
 *   npm run verificar:hoja -- --fecha 2026-10-01   (simula otro "hoy" para las vigencias)
 *
 * Sale con código 1 si hay errores de validación: son los mismos que
 * detendrían el build. Los avisos no cambian el código de salida.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { interpretarOrigen, leerTablasDeCarpeta } from '../src/lib/hoja/origen.ts';
import { cargarDesdeTablas, ErrorHoja, formatearProblemas, resumirCarga } from '../src/lib/hoja/cargar.ts';
import { parsearFecha } from '../src/lib/hoja/vigencia.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const iFecha = args.indexOf('--fecha');
const fecha = iFecha >= 0 ? args[iFecha + 1] : undefined;
const posicionales = args.filter((a, i) => !a.startsWith('--') && (iFecha < 0 || i !== iFecha + 1));
const valorUrl = posicionales[0] ?? process.env.HOJA_CATALOGO_URL ?? leerDeDotEnv('HOJA_CATALOGO_URL');

const hoy = fecha ? parsearFecha(fecha) : undefined;
if (fecha && !hoy) {
  console.error(`--fecha «${fecha}» no es una fecha válida (AAAA-MM-DD).`);
  process.exit(2);
}

let origen;
try {
  origen = interpretarOrigen(valorUrl);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}

if (origen.tipo === 'ninguno') {
  console.error('No hay hoja que verificar: define HOJA_CATALOGO_URL o pásala como argumento (archivo:<carpeta> o enlace de Google Sheets).');
  process.exit(2);
}

let tablas;
if (origen.tipo === 'archivo') {
  console.log(`Leyendo los CSV de ${resolve(origen.carpeta)}…`);
  tablas = await leerTablasDeCarpeta(resolve(origen.carpeta));
} else {
  // TODO(fase de conexión): lectura con la cuenta de servicio (src/lib/hoja/google.ts).
  console.error(`La lectura de Google Sheets (hoja ${origen.idHoja}) todavía no está conectada; usa archivo:<carpeta> mientras tanto.`);
  process.exit(2);
}

try {
  const carga = cargarDesdeTablas(tablas, hoy ? { hoy } : {});
  console.log(resumirCarga(carga));
  if (carga.avisos.length) {
    console.log(`\n${carga.avisos.length} aviso${carga.avisos.length === 1 ? '' : 's'} (no detienen el build):`);
    console.log(formatearProblemas(carga.avisos));
  }
  console.log('\nSin errores: el build pasaría con estos datos.');
} catch (e) {
  if (!(e instanceof ErrorHoja)) throw e;
  console.error(e.message);
  console.error('\nCorrige esas filas en la hoja y vuelve a correr npm run verificar:hoja.');
  process.exit(1);
}

/** Lee una variable de .env sin cargar todo el archivo en el entorno. */
function leerDeDotEnv(nombre) {
  const ruta = join(RAIZ, '.env');
  if (!existsSync(ruta)) return undefined;
  const linea = readFileSync(ruta, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(`${nombre}=`));
  return linea ? linea.slice(linea.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : undefined;
}

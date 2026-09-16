/**
 * Exporta el catálogo y las vacantes actuales a los CSV de la hoja
 * "Catálogo DST", más las fotos renombradas para la carpeta de Drive.
 *
 * Uso:
 *   npm run exportar:hoja                       (escribe en ../hoja-exportada, fuera del repo)
 *   npm run exportar:hoja -- --salida <carpeta>
 *
 * Deja en la carpeta:
 *   Productos.csv, Ofertas laborales.csv, Listas.csv   fila 1 títulos, fila 2
 *                     ayuda, datos desde la 3: el mismo formato de la hoja. Para
 *                     pegar en una hoja que ya tiene las dos primeras filas,
 *                     copiar desde la fila 3.
 *   fotos-para-drive/  las fotos con el nombre que espera la carpeta de Drive.
 *   informe.txt        lo que no cabe en la hoja y hay que resolver a mano.
 *
 * Al terminar vuelve a leer los CSV como si fueran la hoja y los valida, así
 * que si aquí sale "sin errores" la hoja quedará bien al pegarlos.
 *
 * Corre con `node --experimental-strip-types` porque importa los .ts de
 * src/data/ y src/lib/hoja/ directamente (package.json ya pone la bandera).
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { productos, MARCAS, CATEGORIAS, SUBCATEGORIAS } from '../src/data/productos.ts';
import { vacantes } from '../src/data/vacantes.ts';
import { especialesDelMes } from '../src/data/especiales.ts';
import { PRECIOS_SUGERIDOS, PRECIOS_ACTUALIZADOS } from '../src/data/precios.ts';
import { exportar } from '../src/lib/hoja/exportar.ts';
import { escribirCsv } from '../src/lib/hoja/csv.ts';
import { ARCHIVOS_CSV, leerTablasDeCarpeta } from '../src/lib/hoja/origen.ts';
import { cargarDesdeTablas, ErrorHoja, formatearProblemas, resumirCarga } from '../src/lib/hoja/cargar.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONES = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];

const args = process.argv.slice(2);
const iSalida = args.indexOf('--salida');
const salida = resolve(iSalida >= 0 ? args[iSalida + 1] : join(RAIZ, '..', 'hoja-exportada'));
const carpetaFotos = join(salida, 'fotos-para-drive');

const resultado = exportar({
  productos,
  marcas: MARCAS,
  categorias: CATEGORIAS,
  subcategorias: SUBCATEGORIAS,
  vacantes,
  especiales: especialesDelMes,
  preciosManuales: PRECIOS_SUGERIDOS,
  preciosActualizados: PRECIOS_ACTUALIZADOS,
});

await mkdir(carpetaFotos, { recursive: true });
await writeFile(join(salida, ARCHIVOS_CSV.productos), escribirCsv(resultado.tablas.productos));
await writeFile(join(salida, ARCHIVOS_CSV.ofertas), escribirCsv(resultado.tablas.ofertas));
await writeFile(join(salida, ARCHIVOS_CSV.listas), escribirCsv(resultado.tablas.listas));

// Las fotos: el origen puede no tener la extensión escrita en los datos (el
// sitio las busca por nombre), así que se prueba con todas.
const informe = [...resultado.informe];
let copiadas = 0;
for (const foto of resultado.fotos) {
  const origen = localizar(join(RAIZ, foto.origen));
  if (!origen) {
    informe.push(`Foto no encontrada, no se copió (hoy el sitio muestra un marcador en su lugar): ${foto.origen} → ${foto.nombre}.`);
    continue;
  }
  const ext = origen.slice(origen.lastIndexOf('.')).toLowerCase();
  await copyFile(origen, join(carpetaFotos, foto.nombre + ext));
  copiadas++;
}

// Ida y vuelta: leer lo recién escrito como si fuera la hoja.
let veredicto;
try {
  const carga = cargarDesdeTablas(await leerTablasDeCarpeta(salida));
  veredicto = resumirCarga(carga);
  if (carga.avisos.length) veredicto += `\n  Avisos:\n${formatearProblemas(carga.avisos)}`;
} catch (e) {
  veredicto = e instanceof ErrorHoja ? e.message : `Error al releer los CSV: ${e.message}`;
  process.exitCode = 1;
}

await writeFile(
  join(salida, 'informe.txt'),
  [
    `Exportación de ${new Date().toISOString()}`,
    `Productos: ${resultado.tablas.productos.length - 2} filas. Ofertas: ${resultado.tablas.ofertas.length - 2} filas. Fotos copiadas: ${copiadas}.`,
    '',
    'PENDIENTES Y AVISOS',
    ...informe.map((l) => `- ${l}`),
    '',
    'RELECTURA DE LOS CSV COMO SI FUERAN LA HOJA',
    veredicto,
    '',
  ].join('\n'),
  'utf8',
);

console.log(`Exportado en ${salida}`);
console.log(`  ${resultado.tablas.productos.length - 2} productos, ${resultado.tablas.ofertas.length - 2} ofertas, ${copiadas} fotos.`);
console.log(`  ${informe.length} notas en informe.txt.`);
console.log(veredicto);

function localizar(ruta) {
  if (existsSync(ruta)) return ruta;
  const sinExt = ruta.replace(/\.[a-z0-9]+$/i, '');
  return EXTENSIONES.map((e) => sinExt + e).find(existsSync) ?? null;
}

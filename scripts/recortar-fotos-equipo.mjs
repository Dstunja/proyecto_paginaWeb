/**
 * Recorta las fotos del equipo directivo a un cuadrado centrado en la cara.
 *
 *   node scripts/recortar-fotos-equipo.mjs            (escribe los .webp)
 *   node scripts/recortar-fotos-equipo.mjs --revisar  (no escribe, solo informa)
 *   npm run fotos:equipo
 *
 * POR QUÉ EXISTE
 * --------------
 * Las fotos llegan como verticales de celular (960x1280), y la tarjeta de
 * /nosotros/ las muestra en un círculo de 112 px. Si se sube el vertical tal
 * cual, `object-fit: cover` recorta por el centro geométrico de la imagen, que
 * en una foto de medio cuerpo cae en el pecho: la cara queda arriba, cortada
 * por el borde del círculo. El recorte hay que decidirlo a mano mirando cada
 * foto, y eso es lo que guarda la tabla RECORTES de abajo.
 *
 * Los originales NO están en el repositorio: son fotos del personal y viven en
 * `recursos/fotos-equipo/`, que .gitignore excluye. Lo que se publica es solo
 * el .webp ya recortado. Por eso el script existe aunque solo se ejecute una
 * vez por foto: deja escrito el recorte exacto, así que si mañana hay que
 * regenerar el .webp (otro tamaño, otra calidad) no hay que volver a decidir
 * el encuadre a ojo.
 *
 * CÓMO SE ELIGIERON LOS NÚMEROS
 * -----------------------------
 * Dos reglas, para que las fotos se lean como un juego y no como dos fotos
 * sueltas de tamaños distintos:
 *
 *   - El alto de la cabeza (coronilla -> mentón) ocupa un 40 % del lado del
 *     cuadrado. Es lo que iguala el "zoom" entre una foto tomada de cerca y
 *     otra de más lejos.
 *   - La línea de los ojos cae al 40 % de la altura del recorte. Un poco por
 *     encima del centro, que es donde el ojo espera encontrarla; centrada del
 *     todo, la cara se ve hundida dentro del círculo.
 *
 * Al pasar de 40 % de cabeza hacia arriba la foto se vuelve un primer plano y
 * se pierden los hombros, que son los que dan el aire de retrato corporativo.
 *
 * EDITAR AQUÍ: para añadir una foto, deja el original en
 * `recursos/fotos-equipo/` y agrega su fila a RECORTES. Para encontrar los
 * números, mide sobre el original (en píxeles, origen arriba a la izquierda) la
 * coronilla, el mentón, la línea de los ojos y el eje vertical de la cara:
 *
 *   lado      = (mentón - coronilla) / 0.40
 *   arriba    = ojos - lado * 0.40
 *   izquierda = ejeDeLaCara - lado / 2
 *
 * Después revisa el resultado: el círculo de la tarjeta recorta las esquinas
 * del cuadrado, así que lo que se ve es menos de lo que muestra el .webp.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

/** Originales sin recortar. Fuera del repositorio a propósito (.gitignore). */
const ORIGENES = 'recursos/fotos-equipo';

/** Destino publicado: lo que src/data/equipo.ts referencia por su ruta. */
const DESTINO = 'public/img/equipo';

/**
 * Lado del cuadrado final, en píxeles.
 *
 * La tarjeta muestra el círculo a 112 px (`h-28 w-28` en src/pages/nosotros.astro),
 * así que 480 cubre de sobra hasta una pantalla 4x. No hay copia @2x porque a
 * 112 px de ancho ningún navegador llegaría a pedirla: el archivo de 480 ya es
 * la versión grande. Si algún día el avatar crece, subir este número y volver
 * a ejecutar el script es todo lo que hace falta.
 */
const LADO = 480;

/** Calidad de WebP. 86 deja las dos fotos en ~20 KB sin artefactos en la piel. */
const CALIDAD = 86;

/**
 * Recortes medidos a mano sobre cada original.
 *
 * `izquierda` y `arriba` son la esquina superior izquierda de la ventana de
 * recorte dentro del original; `lado` es el ancho y alto de esa ventana (es
 * cuadrada). Las dos fotos vienen a 960x1280.
 */
const RECORTES = [
  {
    // Erica Abril — Talento Humano.
    // Coronilla 318, mentón 600 (cabeza 282 -> lado 705); ojos 470; eje 510.
    original: 'erica-abril.jpeg',
    salida: 'erica-abril.webp',
    izquierda: 158,
    arriba: 188,
    lado: 705,
  },
  {
    // Camilo Acero — Líder Comercial. Tomada de algo más lejos que la anterior,
    // así que el recorte es más estrecho para igualar el tamaño de la cabeza.
    // Coronilla 268, mentón 490 (cabeza 222 -> lado 555); ojos 390; eje 475.
    original: 'camilo-acero.jpeg',
    salida: 'camilo-acero.webp',
    izquierda: 197,
    arriba: 168,
    lado: 555,
  },
];

const soloRevisar = process.argv.includes('--revisar');

/**
 * Comprueba que la ventana de recorte cabe dentro del original.
 *
 * Es la equivocación fácil al copiar una fila de RECORTES: si los números se
 * salen del borde, sharp falla con un «extract_area» que no dice qué foto era.
 */
function validarRecorte(recorte, ancho, alto) {
  const { izquierda, arriba, lado } = recorte;
  const problemas = [];
  if (izquierda < 0 || arriba < 0) problemas.push('la esquina cae fuera de la imagen');
  if (izquierda + lado > ancho) problemas.push(`se sale por la derecha (${izquierda + lado} > ${ancho})`);
  if (arriba + lado > alto) problemas.push(`se sale por abajo (${arriba + lado} > ${alto})`);
  return problemas;
}

async function procesar(recorte) {
  const rutaOriginal = join(ORIGENES, recorte.original);
  const rutaSalida = join(DESTINO, recorte.salida);

  if (!existsSync(rutaOriginal)) {
    console.log(`  · ${recorte.salida.padEnd(20)} SIN ORIGINAL (${rutaOriginal})`);
    return { saltada: true };
  }

  const entrada = sharp(rutaOriginal);
  const { width, height } = await entrada.metadata();
  const problemas = validarRecorte(recorte, width, height);
  if (problemas.length > 0) {
    console.log(`  ✗ ${recorte.salida.padEnd(20)} ${problemas.join('; ')}`);
    return { error: true };
  }

  const { izquierda, arriba, lado } = recorte;
  // `rotate()` sin argumentos aplica la orientación del EXIF y la descarta, para
  // que una foto de celular guardada de lado no salga girada. sharp no copia el
  // resto de metadatos salvo que se le pida con withMetadata(), así que el .webp
  // sale sin EXIF: ni orientación, ni fecha, ni GPS.
  const salida = await entrada
    .rotate()
    .extract({ left: izquierda, top: arriba, width: lado, height: lado })
    .resize(LADO, LADO)
    .webp({ quality: CALIDAD })
    .toBuffer();

  const kb = (salida.length / 1024).toFixed(1);
  if (soloRevisar) {
    console.log(`  · ${recorte.salida.padEnd(20)} ${lado}x${lado} -> ${LADO}x${LADO}  ${kb} KB (no escrito)`);
    return { revisada: true };
  }

  mkdirSync(dirname(rutaSalida), { recursive: true });
  // Se escriben los bytes del buffer tal cual. Pasarlos otra vez por
  // `sharp(salida).toFile(...)` parece equivalente pero NO lo es: descomprime
  // el WebP y lo vuelve a comprimir con la calidad por defecto (80), así que
  // la foto quedaría con dos codificaciones encima y CALIDAD no serviría de
  // nada.
  writeFileSync(rutaSalida, salida);
  console.log(`  ✓ ${recorte.salida.padEnd(20)} ${lado}x${lado} -> ${LADO}x${LADO}  ${kb} KB`);
  return { escrita: true };
}

console.log(
  soloRevisar
    ? `Revisando ${RECORTES.length} foto(s) del equipo (no se escribe nada):`
    : `Recortando ${RECORTES.length} foto(s) del equipo a ${LADO}x${LADO} WebP:`,
);

const resultados = [];
for (const recorte of RECORTES) resultados.push(await procesar(recorte));

const conError = resultados.filter((r) => r.error).length;
const sinOriginal = resultados.filter((r) => r.saltada).length;

if (sinOriginal > 0) {
  console.log(
    `\n${sinOriginal} foto(s) sin original. Los originales no están en el repositorio:\n` +
      `déjalos en ${ORIGENES}/ (ver la cabecera de este archivo).`,
  );
}
if (conError > 0) {
  console.error(`\n${conError} recorte(s) con números inválidos. No se escribió nada de esos.`);
  process.exit(1);
}

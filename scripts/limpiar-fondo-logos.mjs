/**
 * Quita el fondo opaco de los logotipos de marca que no lo traen recortado.
 *
 *   node scripts/limpiar-fondo-logos.mjs            (reescribe los archivos)
 *   node scripts/limpiar-fondo-logos.mjs --revisar  (no escribe, solo informa)
 *
 * POR QUÉ EXISTE
 * --------------
 * Los logotipos de src/assets/marcas/ vienen de fuentes distintas y la mayoría
 * son recortes sobre fondo blanco, no logotipos con transparencia. En la franja
 * del inicio, que va sobre el gris de marca (#F5F7FA), ese blanco se veía como
 * un recuadro alrededor de cada logo.
 *
 * La solución general NO es este script: es `mix-blend-mode: multiply` en
 * .logo-marca (src/styles/global.css). Multiplicar por el fondo hace que el
 * blanco puro desaparezca solo, sin tocar ni un archivo, y sigue funcionando si
 * mañana cambia el color de la sección.
 *
 * Este script es para los pocos casos donde el multiply no basta porque el
 * fondo NO es blanco puro: al multiplicar quedan como un recuadro sucio. Se
 * midieron los 31 archivos y solo tres fallaban:
 *
 *   - benet.png      fondo gris azulado (#E9EDF1)  -> se limpia aquí
 *   - gol.webp       fondo morado                   -> se limpia aquí
 *   - santander.webp fondo marrón con texto BLANCO  -> NO se puede limpiar
 *
 * Santander queda fuera a propósito: su texto es blanco sobre marrón, así que
 * al quitarle el fondo el logotipo se volvería invisible sobre una sección
 * clara. Ese se muestra como placa opaca (.logo-marca--placa), sin blend.
 *
 * LOS DOS MÉTODOS
 * ---------------
 * `inundacion` — relleno por inundación desde el borde. Solo borra el fondo
 * CONECTADO al marco, así que un color que también aparezca dentro del dibujo
 * se conserva. Es el método seguro para fondos claros, porque muchos logotipos
 * llevan blanco propio que no queremos perder.
 *
 * `croma` — alfa proporcional a la distancia al color de fondo, con una rampa
 * entre dos umbrales. Es el que sirve cuando el fondo es un color saturado y
 * además desparejo: el morado de Gol es un degradado con ruido de compresión,
 * y la inundación dejaba un fleco sucio alrededor de las letras porque no
 * llegaba a los píxeles intermedios. La rampa los resuelve con alfa parcial.
 *
 * El color de fondo no se escribe a mano: se toma como la media de las cuatro
 * esquinas del archivo.
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CARPETA = join(process.cwd(), 'src', 'assets', 'marcas');
const soloRevisar = process.argv.includes('--revisar');

/**
 * Qué archivo se limpia y con qué método.
 *
 * EDITAR AQUÍ: si algún logotipo nuevo llega con fondo de color, agrégalo a
 * esta lista. Antes conviene comprobar que de verdad hace falta: si su fondo
 * es blanco puro, el multiply ya lo resuelve y no hay que tocar el archivo.
 */
const TRABAJOS = [
  {
    archivo: 'benet.png',
    metodo: 'inundacion',
    // El fondo está a 22 de distancia como mucho; el azul del texto, mucho más
    // lejos. Con este margen entra el ruido del degradado y no las letras.
    tolerancia: 22,
    salida: 'png',
  },
  {
    archivo: 'gol.webp',
    metodo: 'croma',
    // Por debajo de 30 es fondo seguro; por encima de 75, dibujo seguro. En
    // medio queda el contorno verde oscuro de las letras, que se conserva con
    // alfa parcial en vez de recortarse en seco.
    dentro: 30,
    fuera: 75,
    // Se guarda en WebP y NO en PNG por dos razones: el mismo dibujo en PNG
    // pesa 288 KB frente a 29 KB, y conservar la extensión evita que queden
    // gol.png y gol.webp a la vez, que en el import.meta.glob de
    // src/lib/imagenes.ts se pelearían por la misma clave 'gol'.
    salida: 'webp',
  },
];

/** Media de las cuatro esquinas: el color de fondo del archivo. */
function colorDeFondo(datos, ancho, alto) {
  const esquinas = [0, ancho - 1, (alto - 1) * ancho, alto * ancho - 1];
  return [0, 1, 2].map((canal) =>
    Math.round(esquinas.reduce((suma, i) => suma + datos[i * 4 + canal], 0) / esquinas.length),
  );
}

/** Borra el fondo conectado al borde y suaviza el filo del recorte. */
function inundacionDesdeElBorde(datos, ancho, alto, referencia, tolerancia) {
  const distancia = (i) =>
    Math.max(
      Math.abs(datos[i * 4] - referencia[0]),
      Math.abs(datos[i * 4 + 1] - referencia[1]),
      Math.abs(datos[i * 4 + 2] - referencia[2]),
    );

  const esFondo = new Uint8Array(ancho * alto);
  const pila = [];
  for (let x = 0; x < ancho; x++) pila.push(x, (alto - 1) * ancho + x);
  for (let y = 0; y < alto; y++) pila.push(y * ancho, y * ancho + ancho - 1);

  while (pila.length) {
    const i = pila.pop();
    if (esFondo[i] || distancia(i) > tolerancia) continue;
    esFondo[i] = 1;
    const x = i % ancho;
    const y = (i / ancho) | 0;
    if (x > 0) pila.push(i - 1);
    if (x < ancho - 1) pila.push(i + 1);
    if (y > 0) pila.push(i - ancho);
    if (y < alto - 1) pila.push(i + ancho);
  }

  // El píxel que toca el fondo recibe alfa parcial: sin esto el recorte deja
  // un filo dentado en lugar del suavizado que traía el archivo.
  for (let i = 0; i < ancho * alto; i++) {
    if (esFondo[i]) {
      datos[i * 4 + 3] = 0;
      continue;
    }
    const d = distancia(i);
    if (d >= tolerancia) continue;
    const vecinos = [i - 1, i + 1, i - ancho, i + ancho];
    if (vecinos.some((j) => j >= 0 && j < ancho * alto && esFondo[j])) {
      datos[i * 4 + 3] = Math.round(255 * (d / tolerancia));
    }
  }

  return esFondo.reduce((suma, v) => suma + v, 0);
}

/** Alfa proporcional a lo lejos que está cada píxel del color de fondo. */
function descarteCromatico(datos, ancho, alto, referencia, dentro, fuera) {
  let borrados = 0;
  for (let i = 0; i < ancho * alto; i++) {
    const d = Math.hypot(
      datos[i * 4] - referencia[0],
      datos[i * 4 + 1] - referencia[1],
      datos[i * 4 + 2] - referencia[2],
    );
    const opacidad = Math.min(1, Math.max(0, (d - dentro) / (fuera - dentro)));
    datos[i * 4 + 3] = Math.round(datos[i * 4 + 3] * opacidad);
    if (opacidad === 0) borrados++;
  }
  return borrados;
}

for (const trabajo of TRABAJOS) {
  const ruta = join(CARPETA, trabajo.archivo);
  const { data, info } = await sharp(readFileSync(ruta))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: ancho, height: alto } = info;

  const referencia = colorDeFondo(data, ancho, alto);
  const borrados =
    trabajo.metodo === 'inundacion'
      ? inundacionDesdeElBorde(data, ancho, alto, referencia, trabajo.tolerancia)
      : descarteCromatico(data, ancho, alto, referencia, trabajo.dentro, trabajo.fuera);

  const imagen = sharp(data, { raw: { width: ancho, height: alto, channels: 4 } });
  const salida =
    trabajo.salida === 'webp'
      ? await imagen.webp({ quality: 95, alphaQuality: 100 }).toBuffer()
      : await imagen.png({ compressionLevel: 9 }).toBuffer();

  const antes = readFileSync(ruta).length;
  console.log(
    `${trabajo.archivo.padEnd(16)} ${trabajo.metodo.padEnd(11)} ` +
      `fondo rgb(${referencia.join(',')}) ` +
      `transparente ${((borrados / (ancho * alto)) * 100).toFixed(1)}% ` +
      `${(antes / 1024).toFixed(1)} KB -> ${(salida.length / 1024).toFixed(1)} KB`,
  );

  if (!soloRevisar) writeFileSync(ruta, salida);
}

console.log(soloRevisar ? '\n(--revisar: no se escribió nada)' : '\nListo.');

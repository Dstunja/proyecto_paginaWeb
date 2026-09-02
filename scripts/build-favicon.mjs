/**
 * Genera los íconos del sitio a partir del isotipo de la marca
 * (public/LOGO-removebg-preview.png):
 *
 *   public/favicon.ico        16 + 32 + 48 px (PNG dentro del contenedor ICO)
 *   public/apple-touch-icon.png   180 px, sobre fondo blanco de marca
 *   public/icon-192.png / icon-512.png  para instalación en móviles
 *
 *   npm run favicon
 *
 * Usa Playwright para redimensionar (mismo navegador que ya se usa para la
 * tarjeta Open Graph), así no hace falta ninguna librería de imágenes.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'public', 'LOGO-removebg-preview.png');
const base64 = readFileSync(origen).toString('base64');

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.setContent('<body></body>');

/** Redimensiona el isotipo y devuelve el PNG como Buffer. */
async function redimensionar(tamano, fondo) {
  const dataUrl = await pagina.evaluate(
    async ({ base64, tamano, fondo }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = tamano;
      canvas.height = tamano;
      const ctx = canvas.getContext('2d');

      if (fondo) {
        ctx.fillStyle = fondo;
        ctx.fillRect(0, 0, tamano, tamano);
      }

      // El isotipo se dibuja centrado, con un pequeño margen.
      const margen = Math.round(tamano * (fondo ? 0.12 : 0.02));
      const util = tamano - margen * 2;
      const escala = Math.min(util / img.width, util / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (tamano - w) / 2, (tamano - h) / 2, w, h);

      return canvas.toDataURL('image/png');
    },
    { base64, tamano, fondo },
  );

  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

/** Empaqueta varios PNG en un único archivo .ico. */
function construirIco(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // tipo: ícono
  cabecera.writeUInt16LE(imagenes.length, 4);

  let offset = 6 + imagenes.length * 16;
  const entradas = [];

  for (const { tamano, datos } of imagenes) {
    const entrada = Buffer.alloc(16);
    entrada.writeUInt8(tamano >= 256 ? 0 : tamano, 0);
    entrada.writeUInt8(tamano >= 256 ? 0 : tamano, 1);
    entrada.writeUInt8(0, 2); // paleta
    entrada.writeUInt8(0, 3); // reservado
    entrada.writeUInt16LE(1, 4); // planos
    entrada.writeUInt16LE(32, 6); // bits por píxel
    entrada.writeUInt32LE(datos.length, 8);
    entrada.writeUInt32LE(offset, 12);
    entradas.push(entrada);
    offset += datos.length;
  }

  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.datos)]);
}

const paraIco = [];
for (const tamano of [16, 32, 48]) {
  paraIco.push({ tamano, datos: await redimensionar(tamano, null) });
}
writeFileSync(join(raiz, 'public', 'favicon.ico'), construirIco(paraIco));

// Apple exige un ícono opaco: va sobre blanco.
writeFileSync(join(raiz, 'public', 'apple-touch-icon.png'), await redimensionar(180, '#ffffff'));
writeFileSync(join(raiz, 'public', 'icon-192.png'), await redimensionar(192, '#ffffff'));
writeFileSync(join(raiz, 'public', 'icon-512.png'), await redimensionar(512, '#ffffff'));

await navegador.close();
console.log('Íconos generados: favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png');

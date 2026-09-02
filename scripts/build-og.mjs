/**
 * Genera la tarjeta Open Graph (public/og.png, 1200x630) que se ve al compartir
 * el sitio en WhatsApp, Facebook o X.
 *
 * Abre un navegador headless con Playwright, pinta una tarjeta HTML con la
 * identidad real de la marca (isotipo, paleta y tipografías self-hosted) y la
 * fotografía. No depende de ningún servicio externo.
 *
 *   npm run og
 *
 * Requiere el navegador de Playwright una sola vez:
 *   npx playwright install chromium
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

function base64(ruta) {
  const completa = join(raiz, ruta);
  if (!existsSync(completa)) {
    throw new Error(`No se encontró ${ruta}. ¿Corriste npm install?`);
  }
  return readFileSync(completa).toString('base64');
}

const montserrat = base64(
  'node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2',
);
const poppins = base64('node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2');
const isotipo = base64('public/LOGO-removebg-preview.png');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Montserrat';
    src: url(data:font/woff2;base64,${montserrat}) format('woff2-variations');
    font-weight: 400 900;
  }
  @font-face {
    font-family: 'Poppins';
    src: url(data:font/woff2;base64,${poppins}) format('woff2');
    font-weight: 400;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column;
    justify-content: space-between; padding: 64px 70px;
    background: #0d2c84; color: #fff;
    font-family: 'Poppins', system-ui, sans-serif;
    position: relative; overflow: hidden;
  }
  body::after {
    content: ''; position: absolute; right: -140px; top: -140px;
    width: 460px; height: 460px; border-radius: 50%; background: #1e88e5; opacity: .28;
  }
  body::before {
    content: ''; position: absolute; left: -80px; bottom: -160px;
    width: 340px; height: 340px; border-radius: 50%; background: #ffffff; opacity: .05;
  }
  .marca { display: flex; align-items: center; gap: 18px; position: relative; z-index: 1; }
  .marca img { width: 66px; height: 66px; object-fit: contain; background: #fff; border-radius: 16px; padding: 8px; }
  .marca .nombre { font-family: 'Montserrat'; font-weight: 700; font-size: 27px; line-height: 1.1; }
  .marca .sub {
    display: flex; align-items: center; gap: 10px; margin-top: 6px;
    font-size: 15px; color: rgba(255,255,255,.75);
  }
  .marca .sub i { display: block; width: 26px; height: 3px; background: #f5a623; }
  h1 {
    font-family: 'Montserrat'; font-weight: 700; font-size: 60px; line-height: 1.08;
    letter-spacing: -.015em; max-width: 21ch; position: relative; z-index: 1;
  }
  h1 span { color: #f5a623; }
  .cifras { display: flex; gap: 46px; position: relative; z-index: 1; }
  .cifra strong {
    font-family: 'Montserrat'; font-weight: 700; font-size: 42px; display: block; line-height: 1;
  }
  .cifra small { font-size: 17px; color: rgba(255,255,255,.72); }
  .pie { font-size: 19px; color: rgba(255,255,255,.72); position: relative; z-index: 1; }
</style>
</head>
<body>
  <div class="marca">
    <img src="data:image/png;base64,${isotipo}" alt="">
    <div>
      <div class="nombre">Distribuciones</div>
      <div class="sub"><i></i>Santiago De Tunja S.A.S</div>
    </div>
  </div>

  <h1>Las marcas que mueven tu negocio, <span>más cerca de ti.</span></h1>

  <div class="cifras">
    <div class="cifra"><strong>21</strong><small>años de experiencia</small></div>
    <div class="cifra"><strong>+7.600</strong><small>puntos de venta</small></div>
    <div class="cifra"><strong>87</strong><small>municipios</small></div>
    <div class="cifra"><strong>3</strong><small>departamentos</small></div>
  </div>

  <div class="pie">dstunja.com</div>
</body>
</html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
await pagina.setContent(html, { waitUntil: 'load' });
await pagina.evaluate(() => document.fonts.ready);

writeFileSync(join(raiz, 'public', 'og.png'), await pagina.screenshot({ type: 'png' }));
await navegador.close();

console.log('Tarjeta Open Graph generada en public/og.png');

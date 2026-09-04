/**
 * Verificación del buscador "¿Llegamos a tu municipio?" con un navegador de
 * verdad, sobre el sitio YA COMPILADO en dist/.
 *
 * Comprueba, en móvil (375 px) y escritorio (1280 px):
 *
 *   1. El bloque existe en el inicio, encima del mapa, con su título.
 *   2. Al escribir aparecen sugerencias y son tolerantes a tildes y mayúsculas
 *      ("CHIQUINQUIRA" encuentra "Chiquinquirá").
 *   3. Un municipio cubierto responde "Sí, llegamos a {Municipio}, {Depto}" con
 *      el botón "Arma tu pedido", cuya ruta respeta el `base`.
 *   4. Uno que no está responde "Aún no llegamos a …" con enlace a WhatsApp.
 *   5. Sin días de ruta cargados no se inventa ninguno: no aparece "Ruta:".
 *   6. En la tarjeta del mapa ya no queda un segundo campo de búsqueda.
 *
 * Uso:
 *   npm run build
 *   node scripts/verificar-cobertura.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = join(process.cwd(), 'dist');
const BASE = '/proyecto_paginaWeb';
const PUERTO = 4323;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};

function servir() {
  return new Promise((listo) => {
    const servidor = createServer(async (peticion, respuesta) => {
      let ruta = decodeURIComponent(new URL(peticion.url, 'http://x').pathname);
      if (ruta.startsWith(BASE)) ruta = ruta.slice(BASE.length);
      if (ruta.endsWith('/')) ruta += 'index.html';
      if (ruta === '') ruta = '/index.html';

      const archivo = normalize(join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ)) {
        respuesta.writeHead(403).end();
        return;
      }

      try {
        const info = await stat(archivo);
        if (info.isDirectory()) throw new Error('directorio');
        const cuerpo = await readFile(archivo);
        respuesta.writeHead(200, {
          'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
        });
        respuesta.end(cuerpo);
      } catch {
        respuesta.writeHead(404, { 'content-type': 'text/plain' }).end('404');
      }
    });
    servidor.listen(PUERTO, () => listo(servidor));
  });
}

const resultados = [];
const comprobar = (descripcion, ok, detalle = '') => {
  resultados.push({ descripcion, ok, detalle });
  console.log(`${ok ? '  OK  ' : ' FALLA'}  ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
};

const url = (camino) => `http://localhost:${PUERTO}${BASE}${camino}`;

async function revisar(navegador, etiqueta, viewport) {
  console.log(`\n=== ${etiqueta} (${viewport.width}px) ===\n`);
  const contexto = await navegador.newContext({ viewport });
  const pagina = await contexto.newPage();

  await pagina.goto(url('/'), { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(400);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

  const caja = pagina.locator('[data-buscador-cobertura]');
  const campo = pagina.locator('[data-campo-cobertura]');
  const sugerencias = pagina.locator('[data-sugerencias]');
  const respuesta = pagina.locator('[data-respuesta]');

  await caja.scrollIntoViewIfNeeded();
  comprobar(`${etiqueta}: el bloque "¿Llegamos a tu municipio?" está en el inicio`, await caja.isVisible());

  // ---- 6. Un solo buscador -------------------------------------------------
  comprobar(
    `${etiqueta}: la tarjeta del mapa ya no tiene su propio campo de búsqueda`,
    (await pagina.locator('#buscar-municipio').count()) === 0,
  );

  // ---- 2. Autocompletado tolerante ----------------------------------------
  await campo.fill('CHIQUINQUIRA');
  await pagina.waitForTimeout(200);
  const textoSug = (await sugerencias.textContent()) ?? '';
  comprobar(
    `${etiqueta}: "CHIQUINQUIRA" sugiere Chiquinquirá (sin tilde y en mayúsculas)`,
    (await sugerencias.isVisible()) && /Chiquinquir/.test(textoSug),
    textoSug.replace(/\s+/g, ' ').trim().slice(0, 60),
  );

  // ---- 3. Municipio cubierto ----------------------------------------------
  await pagina.locator('[data-sugerencia]').first().click();
  await pagina.waitForTimeout(300);
  const textoOk = (await respuesta.textContent()) ?? '';
  comprobar(
    `${etiqueta}: responde "Sí, llegamos a Chiquinquirá, Boyacá"`,
    /Sí, llegamos a Chiquinquirá, Boyacá/.test(textoOk),
    textoOk.replace(/\s+/g, ' ').trim().slice(0, 70),
  );

  const hrefPedido = await respuesta.locator('a').first().getAttribute('href');
  comprobar(
    `${etiqueta}: el CTA "Arma tu pedido" respeta el base del sitio`,
    hrefPedido === `${BASE}/pedido/`,
    hrefPedido ?? '(sin href)',
  );

  // ---- 5. Ningún día de ruta inventado ------------------------------------
  comprobar(
    `${etiqueta}: sin días de ruta cargados no se muestra ninguno`,
    !/Ruta:/.test(textoOk),
  );

  // ---- 4. Municipio fuera de cobertura ------------------------------------
  await campo.fill('Cartagena');
  await pagina.keyboard.press('Enter');
  await pagina.waitForTimeout(300);
  const textoNo = (await respuesta.textContent()) ?? '';
  const hrefWa = await respuesta.locator('a').first().getAttribute('href');
  comprobar(
    `${etiqueta}: un municipio fuera de la red responde "Aún no llegamos"`,
    /Aún no llegamos a Cartagena/.test(textoNo),
    textoNo.replace(/\s+/g, ' ').trim().slice(0, 70),
  );
  comprobar(
    `${etiqueta}: y ofrece escribir por WhatsApp`,
    (hrefWa ?? '').startsWith('https://wa.me/'),
    hrefWa ?? '(sin href)',
  );

  await contexto.close();
}

const servidor = await servir();
const navegador = await chromium.launch();

try {
  await revisar(navegador, 'Móvil', { width: 375, height: 720 });
  await revisar(navegador, 'Escritorio', { width: 1280, height: 800 });
} finally {
  await navegador.close();
  servidor.close();
}

const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallas.length === 0 ? 0 : 1);

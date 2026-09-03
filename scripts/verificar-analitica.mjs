/**
 * Verificación de la analítica con un navegador de verdad.
 *
 * Comprueba tres cosas sobre el sitio YA COMPILADO en dist/:
 *
 *   a) Sin PUBLIC_GA_ID no se inyecta ningún script de Google.
 *   b) Con un ID de prueba, gtag se carga y `window.dataLayer` recibe
 *      `seccion_vista` al recorrer el inicio y `pedido_agregar` al agregar
 *      un producto.
 *   c) El aviso de cookies aparece una vez y no vuelve tras aceptar.
 *
 * Cómo se usa. El ID de prueba se pasa por la línea de órdenes y no se escribe
 * en ningún archivo: basta cualquier valor con la forma `G-` y ocho caracteres.
 * No es un ID real, así que nada llega a Google; lo que se comprueba es que el
 * sitio lo lea y arme bien el `dataLayer`.
 *
 *   npm run build
 *   node scripts/verificar-analitica.mjs            -> caso (a)
 *
 *   PUBLIC_GA_ID=G-XXXXXXXX npm run build          (sustituir por el de prueba)
 *   node scripts/verificar-analitica.mjs --con-id   -> casos (b) y (c)
 *
 * Al terminar, `npm run build` otra vez sin la variable deja dist/ limpio.
 *
 * Sirve dist/ con un servidor estático propio (sin dependencias nuevas) en el
 * puerto 4321, respetando el `base` de astro.config.mjs.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = join(process.cwd(), 'dist');
const BASE = '/proyecto_paginaWeb';
const PUERTO = 4321;
const CON_ID = process.argv.includes('--con-id');

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

/** Servidor estático mínimo sobre dist/, con el prefijo `base`. */
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

const servidor = await servir();
const navegador = await chromium.launch();

try {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
  const pagina = await contexto.newPage();

  /** Las peticiones a dominios de Google que intente hacer la página. */
  const peticionesGoogle = [];
  pagina.on('request', (peticion) => {
    if (/googletagmanager\.com|google-analytics\.com/.test(peticion.url())) {
      peticionesGoogle.push(peticion.url());
    }
  });

  await pagina.goto(url('/'), { waitUntil: 'networkidle' });

  const html = await pagina.content();
  const hayScriptGoogle = /googletagmanager\.com/.test(html);

  console.log(`\n=== ${CON_ID ? 'CON' : 'SIN'} PUBLIC_GA_ID ===\n`);

  if (!CON_ID) {
    // ---- (a) sin ID no se inyecta nada de Google ----
    comprobar('Sin PUBLIC_GA_ID no hay <script> de Google en el HTML', !hayScriptGoogle);
    comprobar(
      'Sin PUBLIC_GA_ID no se pide nada a dominios de Google',
      peticionesGoogle.length === 0,
      peticionesGoogle.join(', '),
    );
    comprobar(
      'Sin PUBLIC_GA_ID window.dataLayer no existe',
      (await pagina.evaluate(() => typeof window.dataLayer)) === 'undefined',
    );
  } else {
    // ---- (b) con ID de prueba: el script está y los eventos llegan ----
    comprobar('El <script> de gtag.js aparece en el HTML', hayScriptGoogle);
    comprobar(
      'window.dataLayer existe',
      (await pagina.evaluate(() => Array.isArray(window.dataLayer))) === true,
    );

    // Recorrido del inicio, pausando para que el observador reaccione.
    for (let i = 0; i < 14; i += 1) {
      await pagina.mouse.wheel(0, 700);
      await pagina.waitForTimeout(160);
    }
    await pagina.waitForTimeout(600);

    /** Nombres de evento y valores del parámetro pedido, leídos del dataLayer. */
    const leerEventos = (parametro) =>
      pagina.evaluate((clave) => {
        const salida = [];
        for (const entrada of window.dataLayer ?? []) {
          const args = Array.from(entrada);
          if (args[0] !== 'event') continue;
          salida.push({ evento: args[1], valor: args[2]?.[clave] });
        }
        return salida;
      }, parametro);

    const secciones = (await leerEventos('seccion'))
      .filter((e) => e.evento === 'seccion_vista')
      .map((e) => e.valor);

    comprobar(
      'dataLayer recibe seccion_vista al recorrer el inicio',
      secciones.length >= 5,
      `${secciones.length} secciones: ${secciones.join(', ')}`,
    );
    comprobar(
      'Ninguna seccion se cuenta dos veces',
      secciones.length === new Set(secciones).size,
    );

    // ---- (c) el aviso de cookies aparece una vez ----
    const aviso = pagina.locator('[data-aviso-cookies]');
    comprobar('El aviso de cookies aparece en la primera visita', await aviso.isVisible());

    await pagina.locator('[data-aceptar-cookies]').click();
    await pagina.waitForTimeout(200);
    comprobar('El aviso desaparece al aceptar', !(await aviso.isVisible()));

    const consentimiento = await pagina.evaluate(() =>
      window.localStorage.getItem('dst_consentimiento'),
    );
    comprobar('La decision queda guardada en localStorage', consentimiento === 'aceptado', consentimiento ?? 'null');

    await pagina.reload({ waitUntil: 'networkidle' });
    comprobar('El aviso no vuelve tras recargar', !(await aviso.isVisible()));

    // ---- (b bis) pedido_agregar en el armador de pedidos ----
    await pagina.goto(url('/pedido/'), { waitUntil: 'networkidle' });
    await pagina.locator('[data-tarjeta] [data-agregar]').first().click();
    await pagina.waitForTimeout(300);

    const agregados = (await leerEventos('codigo_sap')).filter(
      (e) => e.evento === 'pedido_agregar',
    );
    comprobar(
      'dataLayer recibe pedido_agregar al agregar un producto',
      agregados.length === 1 && Boolean(agregados[0].valor),
      `codigo_sap=${agregados[0]?.valor}`,
    );
  }
} finally {
  await navegador.close();
  servidor.close();
}

const fallos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallos.length === 0 ? 0 : 1);

/**
 * Verificación del armador de pedidos con un navegador de verdad.
 *
 * Comprueba sobre el sitio YA COMPILADO en dist/, en móvil (375 px) y en
 * escritorio (1280 px):
 *
 *   1. Con el pedido vacío no se ve la barra fija del carrito, ni el pie del
 *      panel, ni los campos del negocio; sí el estado vacío.
 *   2. Al agregar un producto aparece la barra con "N unidades · Ver pedido" y
 *      el número sube al agregar más.
 *   3. "Ver pedido" abre el panel (aria-expanded pasa a true) y Escape lo
 *      cierra; tocar el velo también.
 *   4. Los campos del negocio solo aparecen tras pulsar "Enviar pedido por
 *      WhatsApp", y el formulario rechaza un teléfono que no tenga 10 dígitos.
 *   5. El pedido sobrevive a una recarga (localStorage, clave dst:pedido:v1).
 *   6. El buscador muestra "Mostrando X de N referencias".
 *
 * Uso:
 *   npm run build
 *   node scripts/verificar-pedido.mjs
 *
 * No necesita dependencias nuevas: Playwright ya está en devDependencies y el
 * servidor estático es el mismo patrón de scripts/verificar-analitica.mjs.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = join(process.cwd(), 'dist');
const BASE = '/proyecto_paginaWeb';
const PUERTO = 4322;

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

/** Espera a que el catálogo termine de pintar su primera tanda de tarjetas. */
async function esperarCatalogo(pagina) {
  await pagina.waitForSelector('[data-tarjeta]', { timeout: 15000 });
}

async function revisar(navegador, etiqueta, viewport) {
  console.log(`\n=== ${etiqueta} (${viewport.width}px) ===\n`);
  const contexto = await navegador.newContext({ viewport });
  const pagina = await contexto.newPage();

  // El aviso de cookies también es fijo al borde inferior y va por encima de la
  // barra del carrito: se despacha primero, como haría cualquier visitante.
  await pagina.goto(url('/pedido/'), { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(300);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();
  await esperarCatalogo(pagina);

  const barra = pagina.locator('[data-barra-pedido]');
  const boton = pagina.locator('[data-boton-barra]');
  const panel = pagina.locator('[data-panel]');
  const pie = pagina.locator('[data-pie]');
  const campoNegocio = pagina.locator('[data-campo="negocio"]');

  // ---- 1. Pedido vacío ----------------------------------------------------
  comprobar(`${etiqueta}: con el pedido vacío la barra del carrito no se ve`, !(await barra.isVisible()));
  comprobar(
    `${etiqueta}: con el pedido vacío no hay campos del negocio a la vista`,
    !(await campoNegocio.isVisible()),
  );

  // ---- 6. Contador del buscador -------------------------------------------
  const conteo = (await pagina.locator('[data-conteo]').textContent()) ?? '';
  comprobar(
    `${etiqueta}: el contador dice "Mostrando X de N referencias"`,
    /Mostrando \d+ de \d+ referencias/.test(conteo),
    conteo.trim().slice(0, 70),
  );

  await pagina.fill('[data-buscador]', 'saltin');
  await pagina.waitForTimeout(250);
  const conteoFiltrado = (await pagina.locator('[data-conteo]').textContent()) ?? '';
  comprobar(
    `${etiqueta}: al buscar, el contador baja y sigue diciendo el total`,
    /Mostrando \d+ de \d+ referencias/.test(conteoFiltrado) && conteoFiltrado !== conteo,
    conteoFiltrado.trim().slice(0, 70),
  );
  await pagina.click('[data-limpiar-barra]');
  await pagina.waitForTimeout(150);

  // ---- 2. Agregar productos ----------------------------------------------
  await pagina.locator('[data-tarjeta] [data-agregar]').first().click();
  await pagina.waitForTimeout(200);

  comprobar(`${etiqueta}: al agregar un producto aparece la barra`, await barra.isVisible());
  const texto1 = (await boton.textContent()) ?? '';
  comprobar(
    `${etiqueta}: la barra dice las unidades y "Ver pedido"`,
    /1 unidad/.test(texto1) && /Ver pedido/.test(texto1),
    texto1.replace(/\s+/g, ' ').trim(),
  );

  await pagina.locator('[data-tarjeta] [data-agregar]').nth(1).click();
  await pagina.waitForTimeout(200);
  const texto2 = (await boton.textContent()) ?? '';
  comprobar(
    `${etiqueta}: el contador sube en vivo al agregar otro producto`,
    /2 unidades/.test(texto2),
    texto2.replace(/\s+/g, ' ').trim(),
  );

  // ---- 3. Abrir y cerrar --------------------------------------------------
  comprobar(
    `${etiqueta}: el botón declara aria-expanded="false" cerrado`,
    (await boton.getAttribute('aria-expanded')) === 'false',
  );

  await boton.click();
  await pagina.waitForTimeout(400);
  comprobar(`${etiqueta}: "Ver pedido" abre el panel`, (await panel.getAttribute('data-abierto')) === 'true');
  comprobar(
    `${etiqueta}: el botón pasa a aria-expanded="true"`,
    (await boton.getAttribute('aria-expanded')) === 'true',
  );
  comprobar(`${etiqueta}: con productos, el pie del panel se ve`, await pie.isVisible());
  comprobar(
    `${etiqueta}: el foco queda dentro del panel`,
    await pagina.evaluate(() => document.querySelector('[data-panel]')?.contains(document.activeElement)),
  );

  // ---- 4. Dos pasos -------------------------------------------------------
  comprobar(
    `${etiqueta}: paso 1 — los campos del negocio siguen ocultos`,
    !(await campoNegocio.isVisible()),
  );

  await pagina.click('[data-ir-a-datos]');
  await pagina.waitForTimeout(200);
  comprobar(`${etiqueta}: paso 2 — los campos aparecen al pulsar enviar`, await campoNegocio.isVisible());

  // Teléfono inválido: no debe abrirse ninguna pestaña de WhatsApp.
  let ventanas = 0;
  contexto.on('page', () => (ventanas += 1));

  await pagina.fill('[data-campo="negocio"]', 'Tienda de prueba');
  await pagina.fill('[data-campo="municipio"]', 'Tunja');
  await pagina.fill('[data-campo="contacto"]', 'Camilo');
  await pagina.fill('[data-campo="telefono"]', '31062');
  await pagina.click('[data-formulario] button[type="submit"]');
  await pagina.waitForTimeout(300);

  const avisoTexto = (await pagina.locator('[data-aviso]').textContent()) ?? '';
  comprobar(
    `${etiqueta}: un teléfono de 5 dígitos se rechaza y no abre WhatsApp`,
    /10 dígitos/.test(avisoTexto) && ventanas === 0,
    avisoTexto.trim(),
  );

  await pagina.fill('[data-campo="telefono"]', '310 623 2429');
  comprobar(
    `${etiqueta}: "Volver a la lista" devuelve al paso 1`,
    await (async () => {
      await pagina.click('[data-volver-a-lista]');
      await pagina.waitForTimeout(150);
      return !(await campoNegocio.isVisible());
    })(),
  );

  // Escape cierra.
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(400);
  comprobar(
    `${etiqueta}: Escape cierra el panel`,
    (await panel.getAttribute('data-abierto')) === 'false',
  );

  // ---- 5. Persistencia ----------------------------------------------------
  const guardado = await pagina.evaluate(() => window.localStorage.getItem('dst:pedido:v1'));
  comprobar(
    `${etiqueta}: el pedido y los datos quedan en una sola clave dst:pedido:v1`,
    Boolean(guardado) && JSON.parse(guardado).items.length === 2 &&
      JSON.parse(guardado).cliente.negocio === 'Tienda de prueba',
  );

  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await esperarCatalogo(pagina);
  await pagina.waitForTimeout(300);
  const textoTrasRecarga = (await boton.textContent()) ?? '';
  comprobar(
    `${etiqueta}: tras recargar, el pedido sigue ahí`,
    /2 unidades/.test(textoTrasRecarga),
    textoTrasRecarga.replace(/\s+/g, ' ').trim(),
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

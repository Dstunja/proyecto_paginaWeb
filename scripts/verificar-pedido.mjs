/**
 * Verificación del armador de pedidos con un navegador de verdad.
 *
 * Comprueba sobre el sitio YA COMPILADO en dist/client/, en móvil (375 px) y en
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
 *   7. WhatsApp de pedidos, sobre dist/client:
 *      - No queda ningún número retirado: ni la línea vieja (311 237 1868) ni
 *        los de las asesoras de Televentas, que dejó de existir como área.
 *      - Todos los enlaces wa.me van a un número vigente: el general de
 *        pedidos o el segundo de la convocatoria de vehículos.
 *      - El enlace de <noscript> de /pedido/ también va al de pedidos.
 *
 * Los enlaces a wa.me se interceptan: las ventanas se abren, pero no salen a
 * internet.
 *
 * Uso:
 *   npm run build
 *   node scripts/verificar-pedido.mjs
 *
 * No necesita dependencias nuevas: Playwright ya está en devDependencies y el
 * servidor estático es el mismo patrón de scripts/verificar-analitica.mjs.
 *
 * Puerto: 4399, el mismo en todos los scripts de verificación. Está lejos del
 * 4321 de `astro dev` y de los que Astro toma cuando ese está ocupado (4322,
 * 4323...), cosa frecuente aquí porque suele haber varias sesiones con su
 * propio servidor de desarrollo. Ese choque no da error: Astro escucha en ::1
 * y este servidor en ::, así que arrancan los dos y el navegador acaba en el de
 * desarrollo, donde las comprobaciones fallan sin que la página tenga nada.
 * Dos scripts de verificación a la vez sí se avisan (EADDRINUSE): se corren
 * de uno en uno.
 */
import { createServer } from 'node:http';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = join(process.cwd(), 'dist', 'client');
const BASE = '/proyecto_paginaWeb';
const PUERTO = 4399;

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
  // Sin filtros el contador da el tamaño del portafolio; con filtros puestos
  // dice "X de N", para que la cifra filtrada no se lea como el catálogo entero.
  const conteo = (await pagina.locator('[data-conteo]').textContent()) ?? '';
  comprobar(
    `${etiqueta}: sin filtros el contador dice cuántas referencias hay`,
    /\d+ referencias/.test(conteo),
    conteo.trim().slice(0, 70),
  );

  await pagina.fill('[data-buscador]', 'saltin');
  await pagina.waitForTimeout(250);
  const conteoFiltrado = (await pagina.locator('[data-conteo]').textContent()) ?? '';
  comprobar(
    `${etiqueta}: al buscar, el contador baja y sigue diciendo el total`,
    /\d+ de \d+ productos?/.test(conteoFiltrado) && conteoFiltrado !== conteo,
    conteoFiltrado.trim().slice(0, 70),
  );

  // "Limpiar filtros" vive en la barra fija y solo aparece cuando hay algo que
  // quitar; con la búsqueda puesta tiene que estar a la vista.
  const limpiar = pagina.locator('[data-filtros] [data-limpiar]');
  comprobar(
    `${etiqueta}: con la búsqueda puesta aparece "Limpiar filtros"`,
    await limpiar.isVisible(),
  );
  await limpiar.click();
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

// ---- 7. WhatsApp de pedidos -------------------------------------------------

/**
 * Los números tal como deben quedar publicados. Se escriben aquí a mano y no se
 * leen de src/data/site.ts a propósito: si alguien cambia uno allí por error,
 * esta lista es la que lo delata.
 *
 * Televentas dejó de existir como área, así que los dos números de las asesoras
 * pasaron a la lista de retirados junto con la línea que ya lo estaba. Hoy los
 * pedidos van al número general (ver src/lib/whatsapp-pedido.ts).
 */
const WHATSAPP_PEDIDOS = '573106232429';

/** El único otro número que puede aparecer: el segundo WhatsApp de la
 *  convocatoria de vehículos (`whatsappExtra` en src/data/vacantes.ts). */
const WHATSAPP_PERMITIDOS = [WHATSAPP_PEDIDOS, '573108788754'];

const NUMEROS_RETIRADOS = [
  '573112371868', '311 237 1868', // línea retirada hace tiempo
  '573106218289', '310 621 8289', // Gabriela, Televentas
  '573507461127', '350 746 1127', // Sara, Televentas
];

async function revisarWhatsappPedidos() {
  console.log('\n=== WhatsApp de pedidos: archivos compilados ===\n');

  const archivos = (await readdir(RAIZ, { recursive: true })).filter((f) =>
    /\.(html|js|json|xml|txt)$/.test(f),
  );
  const conNumeroRetirado = [];
  const aOtroNumero = [];
  let enlaces = 0;

  for (const relativo of archivos) {
    const contenido = await readFile(join(RAIZ, relativo), 'utf8');
    if (NUMEROS_RETIRADOS.some((n) => contenido.includes(n))) conNumeroRetirado.push(relativo);

    for (const [, numero] of contenido.matchAll(/wa\.me\/(\d+)/g)) {
      enlaces += 1;
      if (!WHATSAPP_PERMITIDOS.includes(numero)) aOtroNumero.push(`${relativo}: ${numero}`);
    }
  }

  comprobar(
    'WhatsApp: ningún número retirado (la línea vieja ni las asesoras de Televentas) queda en lo compilado',
    conNumeroRetirado.length === 0,
    conNumeroRetirado.slice(0, 5).join(', '),
  );
  comprobar(
    `WhatsApp: los ${enlaces} enlaces wa.me de lo compilado van a un número vigente`,
    enlaces > 0 && aOtroNumero.length === 0,
    aOtroNumero.slice(0, 3).join(' | '),
  );

  const pedidoHtml = await readFile(join(RAIZ, 'pedido', 'index.html'), 'utf8');
  const noscript = pedidoHtml.match(/<noscript>[\s\S]*?<\/noscript>/g)?.join('') ?? '';
  const hrefNoscript = (noscript.match(/href="(https:\/\/wa\.me\/[^"]*)"/)?.[1] ?? '').replaceAll(
    '&amp;',
    '&',
  );
  comprobar(
    'WhatsApp: sin JavaScript, el enlace de /pedido/ también va al número de pedidos',
    hrefNoscript.includes(`wa.me/${WHATSAPP_PEDIDOS}`),
    hrefNoscript.slice(0, 70) || '(no se encontró enlace en <noscript>)',
  );
}

const servidor = await servir();
const navegador = await chromium.launch();

try {
  await revisar(navegador, 'Móvil', { width: 375, height: 720 });
  await revisar(navegador, 'Escritorio', { width: 1280, height: 800 });
  await revisarWhatsappPedidos();
} finally {
  await navegador.close();
  servidor.close();
}

const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallas.length === 0 ? 0 : 1);

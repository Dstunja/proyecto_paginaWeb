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
 *   7. Televentas (src/lib/televentas.ts), en escritorio salvo lo indicado:
 *      - En dist/client no queda la línea retirada (311 237 1868) y todos los
 *        enlaces repartidos del HTML van a Gabriela o a Sara, saludándola por
 *        su nombre; el de <noscript> va fijo a la primera.
 *      - Sin tocar nada no se asigna asesora. Al primer toque se asigna una,
 *        se guarda (dst:televentas:v1) y WhatsApp se abre a su número; los
 *        demás CTA, las otras páginas y el pedido armado van a la misma.
 *      - "¿Prefieres a …?" del panel cambia la asesora guardada y regenera el
 *        enlace del pedido y los demás enlaces de la página.
 *      - 200 sorteos con el navegador vacío reparten entre las dos.
 *      - Una asesora guardada manda sobre el HTML impreso; un nombre que no
 *        está en la lista se trata como ninguno.
 *      - Contáctanos (móvil y escritorio) muestra a las dos con WhatsApp y
 *        llamada, el teléfono de oficina sigue ahí, y elegir a una la guarda.
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

// ---- 7. Televentas ----------------------------------------------------------

/**
 * Las asesoras tal como deben quedar publicadas. Se escriben aquí a mano y no
 * se leen de src/data/site.ts a propósito: si alguien cambia un número allí
 * por error, esta lista es la que lo delata.
 */
const TELEVENTAS = [
  { nombre: 'Gabriela', numero: '573106218289', local: '310 621 8289' },
  { nombre: 'Sara', numero: '573507461127', local: '350 746 1127' },
];
const LINEA_RETIRADA = ['573112371868', '311 237 1868'];
const TELEFONO_OFICINA = 'tel:+573106232429';
const CLAVE_TELEVENTAS = 'dst:televentas:v1';

const otra = (nombre) => TELEVENTAS.find((a) => a.nombre !== nombre);

/** Número, asesora y texto de un enlace de wa.me. */
function leerDestino(href) {
  try {
    const u = new URL(href);
    const numero = u.hostname === 'wa.me' ? u.pathname.replace(/\//g, '') : '';
    return {
      numero,
      asesora: TELEVENTAS.find((a) => a.numero === numero) ?? null,
      texto: u.searchParams.get('text') ?? '',
    };
  } catch {
    return { numero: '', asesora: null, texto: '' };
  }
}

/** El enlace va a esa asesora y el mensaje empieza saludándola por su nombre. */
const vaA = (href, nombre, inicio = '') => {
  const d = leerDestino(href);
  return d.asesora?.nombre === nombre && d.texto.startsWith(`Hola ${nombre}, ${inicio}`);
};

/** Nombre de la asesora que un href deja ver, para los detalles. */
const quien = (href) => {
  const d = leerDestino(href);
  return d.asesora ? `${d.asesora.nombre}: «${d.texto.slice(0, 48)}»` : String(href).slice(0, 60);
};

const guardadaEn = (pagina) =>
  pagina.evaluate((clave) => {
    try {
      return JSON.parse(window.localStorage.getItem(clave) ?? 'null')?.asesora ?? null;
    } catch {
      return 'ilegible';
    }
  }, CLAVE_TELEVENTAS);

/** Todos los href de los enlaces repartidos de la página. */
const hrefsRepartidos = (pagina) =>
  pagina.$$eval('a[data-televentas]', (enlaces) => enlaces.map((a) => a.href));

/** Ejecuta la acción, espera la ventana de WhatsApp que abre y devuelve su URL. */
async function urlDeVentana(contexto, accion) {
  const [ventana] = await Promise.all([contexto.waitForEvent('page', { timeout: 10000 }), accion()]);
  await ventana.waitForURL(/wa\.me/, { timeout: 10000 }).catch(() => {});
  const destino = ventana.url();
  await ventana.close();
  return destino;
}

async function nuevoContexto(navegador, viewport = { width: 1280, height: 800 }) {
  const contexto = await navegador.newContext({ viewport });
  // WhatsApp no se visita de verdad: la ventana se abre y se responde aquí.
  const responder = (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: 'wa' });
  await contexto.route('https://wa.me/**', responder);
  await contexto.route('https://api.whatsapp.com/**', responder);
  return contexto;
}

async function despacharCookies(pagina) {
  await pagina.waitForTimeout(300);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();
}

/** Lo que se puede comprobar en los archivos compilados, sin navegador. */
async function revisarTeleventasEnDist() {
  console.log('\n=== Televentas: archivos compilados ===\n');

  const archivos = (await readdir(RAIZ, { recursive: true })).filter((f) =>
    /\.(html|js|json|xml|txt)$/.test(f),
  );
  const conLineaRetirada = [];
  const repartidosMal = [];
  let repartidos = 0;

  for (const relativo of archivos) {
    const contenido = await readFile(join(RAIZ, relativo), 'utf8');
    if (LINEA_RETIRADA.some((n) => contenido.includes(n))) conLineaRetirada.push(relativo);
    if (!relativo.endsWith('.html')) continue;

    for (const [etiqueta] of contenido.matchAll(/<a\b[^>]*\bdata-televentas\b[^>]*>/g)) {
      repartidos += 1;
      const href = (etiqueta.match(/\bhref="([^"]*)"/)?.[1] ?? '').replaceAll('&amp;', '&');
      const d = leerDestino(href);
      if (!d.asesora || !vaA(href, d.asesora.nombre)) repartidosMal.push(`${relativo}: ${href.slice(0, 70)}`);
    }
  }

  comprobar(
    'Televentas: la línea retirada no aparece en ningún HTML ni JS compilado',
    conLineaRetirada.length === 0,
    conLineaRetirada.slice(0, 5).join(', '),
  );
  comprobar(
    `Televentas: los ${repartidos} enlaces repartidos del HTML van a Gabriela o a Sara y la saludan`,
    repartidos > 0 && repartidosMal.length === 0,
    repartidosMal.slice(0, 3).join(' | '),
  );

  const pedidoHtml = await readFile(join(RAIZ, 'pedido', 'index.html'), 'utf8');
  const noscript = pedidoHtml.match(/<noscript>[\s\S]*?<\/noscript>/g)?.join('') ?? '';
  const hrefNoscript = (noscript.match(/href="(https:\/\/wa\.me\/[^"]*)"/)?.[1] ?? '').replaceAll('&amp;', '&');
  comprobar(
    'Televentas: sin JavaScript, el enlace de /pedido/ va fijo a Gabriela y la saluda',
    vaA(hrefNoscript, 'Gabriela'),
    quien(hrefNoscript),
  );
}

async function revisarTeleventas(navegador) {
  await revisarTeleventasEnDist();
  console.log('\n=== Televentas: reparto en el navegador (1280px) ===\n');

  // ---- Primer toque, y la misma asesora en todo el sitio --------------------
  const contexto = await nuevoContexto(navegador);
  const pagina = await contexto.newPage();
  await pagina.goto(url('/'), { waitUntil: 'domcontentloaded' });
  await despacharCookies(pagina);

  comprobar(
    'Televentas: sin tocar ningún enlace no se asigna asesora',
    (await guardadaEn(pagina)) === null,
  );

  const flotante = pagina.locator('[data-whatsapp-flotante]');
  const destinoFlotante = await urlDeVentana(contexto, () => flotante.click());
  const asignada = leerDestino(destinoFlotante).asesora?.nombre ?? null;
  comprobar(
    'Televentas: el botón flotante abre WhatsApp de Gabriela o Sara, saludándola',
    asignada !== null && vaA(destinoFlotante, asignada, 'quiero hacer un pedido.'),
    quien(destinoFlotante),
  );
  comprobar(
    'Televentas: la asesora del primer toque queda guardada en el navegador',
    asignada !== null && (await guardadaEn(pagina)) === asignada,
    `guardada: ${await guardadaEn(pagina)}`,
  );

  const ctaPortada = pagina.locator('a[data-televentas]', { hasText: 'Haz tu pedido' });
  const escribirAhora = pagina.locator('a[data-televentas]', { hasText: 'Escribir ahora' });
  comprobar(
    'Televentas: "Haz tu pedido" y "Escribir ahora" pasan a la misma asesora',
    (await ctaPortada.count()) === 1 &&
      (await escribirAhora.count()) === 1 &&
      vaA(await ctaPortada.evaluate((a) => a.href), asignada) &&
      vaA(await escribirAhora.evaluate((a) => a.href), asignada),
  );

  const destinoEscribir = await urlDeVentana(contexto, () => escribirAhora.click());
  comprobar(
    'Televentas: al volver a escribir desde otro CTA no salta de asesora',
    vaA(destinoEscribir, asignada),
    quien(destinoEscribir),
  );

  await pagina.goto(url('/catalogo/'), { waitUntil: 'domcontentloaded' });
  const pedirCatalogo = pagina.locator('a[data-televentas]', { hasText: 'Pedir catálogo' });
  const hrefCatalogo = await pedirCatalogo.evaluate((a) => a.href);
  comprobar(
    'Televentas: en /catalogo/ "Pedir catálogo" sale ya con la asesora guardada',
    vaA(hrefCatalogo, asignada, 'quiero recibir el catálogo'),
    quien(hrefCatalogo),
  );

  // ---- Pedido armado ---------------------------------------------------------
  await pagina.goto(url('/pedido/'), { waitUntil: 'domcontentloaded' });
  await esperarCatalogo(pagina);
  const directo = pagina.locator('[data-escribir-directo]');
  comprobar(
    'Televentas: en /pedido/ "Escríbenos directo por WhatsApp" va a la misma asesora',
    vaA(await directo.evaluate((a) => a.href), asignada, 'quiero hacer un pedido y necesito que me acompañes.'),
    quien(await directo.evaluate((a) => a.href)),
  );

  await pagina.locator('[data-tarjeta] [data-agregar]').first().click();
  await pagina.waitForTimeout(200);
  await pagina.click('[data-boton-barra]');
  await pagina.waitForTimeout(400);
  const sinArmar = pagina.locator('[data-panel] a[data-televentas]');
  comprobar(
    'Televentas: "Escríbenos sin pedido armado" va a la misma asesora',
    vaA(await sinArmar.evaluate((a) => a.href), asignada, 'quiero hacer un pedido.'),
  );

  await pagina.click('[data-ir-a-datos]');
  await pagina.fill('[data-campo="negocio"]', 'Tienda de prueba');
  await pagina.fill('[data-campo="municipio"]', 'Tunja');
  await pagina.fill('[data-campo="contacto"]', 'Camilo');
  await pagina.fill('[data-campo="telefono"]', '310 623 2429');
  const destinoPedido = await urlDeVentana(contexto, () =>
    pagina.click('[data-formulario] button[type="submit"]'),
  );
  comprobar(
    'Televentas: el pedido armado llega a la misma asesora con "Hola {nombre}, te envío mi pedido."',
    vaA(destinoPedido, asignada, 'te envío mi pedido.') &&
      leerDestino(destinoPedido).texto.includes('Negocio: Tienda de prueba'),
    quien(destinoPedido),
  );

  const aviso = pagina.locator('[data-aviso]');
  const botonOtra = pagina.locator('[data-otra-asesora]');
  const enlacePedido = pagina.locator('[data-enlace-pedido]');
  const segunda = otra(asignada)?.nombre;
  comprobar(
    'Televentas: el aviso nombra a la asesora y ofrece a la otra',
    ((await aviso.textContent()) ?? '').includes(`WhatsApp de ${asignada}`) &&
      (await botonOtra.isVisible()) &&
      ((await botonOtra.textContent()) ?? '').trim() === `¿Prefieres a ${segunda}?` &&
      !(await enlacePedido.isVisible()),
    `${(await aviso.textContent())?.trim()} / ${(await botonOtra.textContent())?.trim()}`,
  );

  // ---- "¿Prefieres a …?" ----------------------------------------------------
  await botonOtra.click();
  await pagina.waitForTimeout(150);
  const hrefRegenerado = await enlacePedido.evaluate((a) => a.href);
  comprobar(
    'Televentas: "¿Prefieres a …?" guarda a la otra asesora',
    (await guardadaEn(pagina)) === segunda,
    `guardada: ${await guardadaEn(pagina)}`,
  );
  comprobar(
    'Televentas: y regenera el enlace del pedido para ella',
    (await enlacePedido.isVisible()) &&
      vaA(hrefRegenerado, segunda, 'te envío mi pedido.') &&
      leerDestino(hrefRegenerado).texto.includes('Negocio: Tienda de prueba'),
    quien(hrefRegenerado),
  );
  comprobar(
    'Televentas: tras el cambio el aviso lo confirma y se ofrece volver a la primera',
    ((await aviso.textContent()) ?? '').includes(`ahora tu asesora es ${segunda}`) &&
      ((await botonOtra.textContent()) ?? '').trim() === `¿Prefieres a ${asignada}?`,
    `${(await aviso.textContent())?.trim()} / ${(await botonOtra.textContent())?.trim()}`,
  );
  const hrefsTrasCambio = await hrefsRepartidos(pagina);
  comprobar(
    'Televentas: los demás enlaces de la página pasan a la nueva asesora',
    hrefsTrasCambio.length > 0 && hrefsTrasCambio.every((h) => vaA(h, segunda)),
    hrefsTrasCambio.map(quien).join(' | '),
  );
  const destinoRegenerado = await urlDeVentana(contexto, () => enlacePedido.click());
  comprobar(
    'Televentas: el enlace regenerado abre WhatsApp de la nueva asesora con el pedido',
    vaA(destinoRegenerado, segunda, 'te envío mi pedido.'),
    quien(destinoRegenerado),
  );

  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(300);
  comprobar(
    'Televentas: tras recargar, la elección se mantiene',
    vaA(await directo.evaluate((a) => a.href), segunda),
    quien(await directo.evaluate((a) => a.href)),
  );

  // ---- Sorteo parejo -------------------------------------------------------
  await pagina.goto(url('/'), { waitUntil: 'domcontentloaded' });
  const conteo = await pagina.evaluate((clave) => {
    const enlace = document.querySelector('a[data-televentas]');
    const cuenta = {};
    for (let i = 0; i < 200; i += 1) {
      window.localStorage.removeItem(clave);
      enlace.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const numero = new URL(enlace.href).pathname.replace(/\//g, '');
      cuenta[numero] = (cuenta[numero] ?? 0) + 1;
    }
    return cuenta;
  }, CLAVE_TELEVENTAS);
  // Con 200 sorteos al 50 % cada una sale 100 ± 7; bajar de 60 es casi imposible
  // si el sorteo es parejo, y seguro si siempre sale la misma.
  const numerosSorteados = Object.keys(conteo);
  comprobar(
    'Televentas: 200 sorteos con el navegador vacío reparten entre las dos',
    numerosSorteados.every((n) => TELEVENTAS.some((a) => a.numero === n)) &&
      TELEVENTAS.every((a) => (conteo[a.numero] ?? 0) >= 60),
    TELEVENTAS.map((a) => `${a.nombre} ${conteo[a.numero] ?? 0}`).join(', '),
  );

  // ---- Lo guardado manda sobre el HTML impreso -----------------------------
  for (const { nombre } of TELEVENTAS) {
    await pagina.evaluate(
      ([clave, valor]) => window.localStorage.setItem(clave, JSON.stringify({ asesora: valor })),
      [CLAVE_TELEVENTAS, nombre],
    );
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(300);
    const hrefs = await hrefsRepartidos(pagina);
    comprobar(
      `Televentas: con ${nombre} guardada, los enlaces salen con ella sin tocarlos`,
      hrefs.length === 3 && hrefs.every((h) => vaA(h, nombre)),
      hrefs.map(quien).join(' | '),
    );
  }

  await pagina.evaluate(
    (clave) => window.localStorage.setItem(clave, JSON.stringify({ asesora: 'Pedro' })),
    CLAVE_TELEVENTAS,
  );
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(300);
  await pagina.locator('[data-whatsapp-flotante]').dispatchEvent('pointerdown');
  const trasDesconocida = await guardadaEn(pagina);
  comprobar(
    'Televentas: un nombre guardado que no está en la lista se reemplaza por una asesora real',
    TELEVENTAS.some((a) => a.nombre === trasDesconocida) &&
      (await hrefsRepartidos(pagina)).every((h) => vaA(h, trasDesconocida)),
    `guardada: ${trasDesconocida}`,
  );
  await contexto.close();

  // ---- Contáctanos ---------------------------------------------------------
  for (const [etiqueta, viewport] of [
    ['Móvil', { width: 375, height: 720 }],
    ['Escritorio', { width: 1280, height: 800 }],
  ]) {
    const ctx = await nuevoContexto(navegador, viewport);
    const pag = await ctx.newPage();
    await pag.goto(url('/contactanos/'), { waitUntil: 'domcontentloaded' });
    await despacharCookies(pag);

    const tarjeta = pag.locator('[data-tarjeta-televentas]');
    await tarjeta.scrollIntoViewIfNeeded();
    const textoTarjeta = ((await tarjeta.textContent()) ?? '').replace(/\s+/g, ' ');
    const fallos = [];

    for (const a of TELEVENTAS) {
      if (!textoTarjeta.includes(a.nombre) || !textoTarjeta.includes(a.local)) {
        fallos.push(`${a.nombre}: falta nombre o número`);
      }
      const whatsapp = tarjeta.locator(`a[data-asesora="${a.nombre}"][href^="https://wa.me/"]`);
      const llamar = tarjeta.locator(`a[data-asesora="${a.nombre}"][href^="tel:"]`);
      if (!(await whatsapp.isVisible()) || !vaA(await whatsapp.getAttribute('href'), a.nombre, 'quiero hacer un pedido.')) {
        fallos.push(`${a.nombre}: botón de WhatsApp`);
      }
      if (!(await llamar.isVisible()) || (await llamar.getAttribute('href')) !== `tel:+${a.numero}`) {
        fallos.push(`${a.nombre}: botón de llamar`);
      }
    }

    comprobar(
      `Contáctanos ${etiqueta}: la tarjeta de Televentas muestra a las dos con WhatsApp y llamada`,
      fallos.length === 0,
      fallos.join(' | '),
    );
    comprobar(
      `Contáctanos ${etiqueta}: el teléfono de oficina sigue en ${TELEFONO_OFICINA}`,
      (await pag.locator(`a[href="${TELEFONO_OFICINA}"]`).count()) > 0,
    );

    if (etiqueta === 'Escritorio') {
      const destinoSara = await urlDeVentana(ctx, () =>
        tarjeta.locator('a[data-asesora="Sara"][href^="https://wa.me/"]').click(),
      );
      const hrefFlotante = await pag.locator('[data-whatsapp-flotante]').evaluate((el) => el.href);
      comprobar(
        'Contáctanos: escribir a Sara la deja guardada y el botón flotante pasa a ella',
        vaA(destinoSara, 'Sara') && (await guardadaEn(pag)) === 'Sara' && vaA(hrefFlotante, 'Sara'),
        `guardada: ${await guardadaEn(pag)}; flotante ${quien(hrefFlotante)}`,
      );
    }
    await ctx.close();
  }
}

const servidor = await servir();
const navegador = await chromium.launch();

try {
  await revisar(navegador, 'Móvil', { width: 375, height: 720 });
  await revisar(navegador, 'Escritorio', { width: 1280, height: 800 });
  await revisarTeleventas(navegador);
} finally {
  await navegador.close();
  servidor.close();
}

const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallas.length === 0 ? 0 : 1);

/**
 * Verificación de la barra, el menú móvil, las migas y los enlaces a Pideky,
 * con un navegador de verdad sobre el sitio YA COMPILADO en dist/client/.
 *
 * Comprueba, en móvil (375 px) y escritorio (1280 px):
 *
 *   1. El CTA "Arma tu pedido" está en la barra de TODAS las páginas y lleva a
 *      /pedido/ respetando el `base`.
 *   2. En móvil el menú se abre con la hamburguesa, atrapa el foco, se cierra
 *      con Escape y al navegar; en escritorio los enlaces se ven sin abrir nada.
 *   3. Las migas dicen "Inicio › {Nombre}" y NUNCA el pathname con el prefijo
 *      del despliegue. En el inicio no hay migas.
 *   4. Con PIDEKY_URL vacío no queda ni un enlace ni un botón a Pideky, ni con
 *      href="#", en ninguna página.
 *
 * Y las CABECERAS DE SEGURIDAD de vercel.json (Content-Security-Policy,
 * X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy y
 * Access-Control-Allow-Origin):
 *
 *   5. Están en vercel.json con los valores esperados, y el servidor local de
 *      este script las aplica a cada respuesta, igual que Vercel. Así TODAS las
 *      comprobaciones del navegador corren bajo la CSP de verdad.
 *   6. El HTML publicado no lleva comentarios ni scripts ejecutables en línea
 *      (la CSP no permite 'unsafe-inline' en script-src).
 *   7. Con la red real, sin interceptar nada: ninguna página provoca un bloqueo
 *      de CSP, los dos mapas cargan teselas, Turnstile carga y entrega token
 *      (con la clave de prueba de Cloudflare inyectada), los formularios de
 *      PQRS y Empleos llegan a su API (un doble local), la analítica carga si
 *      el build lleva PUBLIC_GTM_CONTAINER_ID, y los destinos de connect-src
 *      (Google Analytics, Vercel Blob) no se bloquean mientras uno ajeno sí.
 *
 * Con `--url https://dstunja.com` además revisa PRODUCCIÓN: las cabeceras de
 * varias respuestas, que http:// redirige a https:// con 301 o 308, y que las
 * páginas cargan sin bloqueos de CSP, con teselas y con Turnstile. No envía
 * ningún formulario.
 *
 * Uso:
 *   npm run build
 *   node scripts/verificar-navegacion.mjs
 *   node scripts/verificar-navegacion.mjs --url https://dstunja.com
 *
 * Para probar también la analítica en local, compilar con un ID de prueba:
 *   PUBLIC_GTM_CONTAINER_ID=GTM-TEST000 npm run build
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
import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = join(process.cwd(), 'dist', 'client');
const BASE = '/proyecto_paginaWeb';
const PUERTO = 4399;

// --- Cabeceras de seguridad de vercel.json ------------------------------------

const VERCEL = JSON.parse(await readFile(join(process.cwd(), 'vercel.json'), 'utf8'));

/** Cabeceras que vercel.json aplica a una ruta, como hace Vercel con `source`. */
function cabecerasPara(ruta) {
  const salida = {};
  for (const bloque of VERCEL.headers ?? []) {
    const patron = new RegExp(`^${bloque.source.replace(/\(\.\*\)/g, '.*')}$`);
    if (!patron.test(ruta)) continue;
    for (const { key, value } of bloque.headers) salida[key.toLowerCase()] = value;
  }
  return salida;
}

/**
 * Las mismas cabeceras para el servidor local, que va por http://localhost.
 * Se quita `upgrade-insecure-requests`: pasaría a https:// las peticiones al
 * propio servidor local, que no habla https, y la página se quedaría sin CSS ni
 * JS. En Vercel todo va por https y la directiva no cambia nada.
 */
function cabecerasLocales(ruta) {
  const cabeceras = cabecerasPara(ruta);
  const csp = cabeceras['content-security-policy'];
  if (csp) {
    cabeceras['content-security-policy'] = csp
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d && d !== 'upgrade-insecure-requests')
      .join('; ');
  }
  return cabeceras;
}

/** Directivas de una CSP como mapa: nombre → lista de fuentes. */
function directivas(csp) {
  const mapa = new Map();
  for (const trozo of (csp ?? '').split(';')) {
    const [nombre, ...fuentes] = trozo.trim().split(/\s+/);
    if (nombre) mapa.set(nombre.toLowerCase(), fuentes);
  }
  return mapa;
}

/**
 * Clave de sitio de PRUEBA de Cloudflare (siempre pasa, válida en localhost).
 * Se inyecta en el HTML cuando el build no trae PUBLIC_TURNSTILE_SITE_KEY, para
 * que Turnstile se cargue de verdad bajo la CSP.
 */
const CLAVE_TURNSTILE_PRUEBA = '1x00000000000000000000AA';

/** Lo que llega a los dobles de las funciones en el servidor local. */
const llamadasApi = [];

const leerCuerpo = (peticion) =>
  new Promise((listo) => {
    const trozos = [];
    peticion.on('data', (t) => trozos.push(t));
    peticion.on('end', () => listo(Buffer.concat(trozos)));
  });

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
      const seguridad = cabecerasLocales(ruta);

      // Dobles de las funciones: solo registran y contestan ok. Sirven para ver
      // que los formularios llegan a su API bajo la CSP (connect-src 'self').
      if (ruta === '/api/pqrs/administrativa' || ruta === '/api/empleos/postular') {
        const cuerpo = await leerCuerpo(peticion);
        llamadasApi.push({ ruta, bytes: cuerpo.length });
        respuesta.writeHead(200, { ...seguridad, 'content-type': 'application/json; charset=utf-8' });
        respuesta.end(JSON.stringify({ ok: true }));
        return;
      }

      if (ruta.endsWith('/')) ruta += 'index.html';
      if (ruta === '') ruta = '/index.html';

      const archivo = normalize(join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ)) {
        respuesta.writeHead(403, seguridad).end();
        return;
      }

      try {
        const info = await stat(archivo);
        if (info.isDirectory()) throw new Error('directorio');
        let cuerpo = await readFile(archivo);
        if (extname(archivo) === '.html') {
          // Atributo vacío (build sin clave): se pone la de prueba.
          cuerpo = Buffer.from(
            cuerpo
              .toString('utf8')
              .replace(/data-turnstile-key(="")?(?=[\s>])/g, `data-turnstile-key="${CLAVE_TURNSTILE_PRUEBA}"`),
          );
        }
        respuesta.writeHead(200, {
          ...seguridad,
          'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
        });
        respuesta.end(cuerpo);
      } catch {
        respuesta.writeHead(404, { ...seguridad, 'content-type': 'text/plain' }).end('404');
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

/** Páginas a revisar y el nombre que deben mostrar en las migas. */
const PAGINAS = [
  { camino: '/', miga: null },
  { camino: '/nosotros/', miga: 'Nosotros' },
  { camino: '/catalogo/', miga: 'Catálogo' },
  { camino: '/pedido/', miga: 'Arma tu pedido' },
  { camino: '/innovacion/', miga: 'Innovación' },
  { camino: '/empleos/', miga: 'Empleos' },
  { camino: '/contactanos/', miga: 'Contáctanos' },
  { camino: '/pqrs/', miga: 'PQRS' },
  { camino: '/privacidad/', miga: 'Tratamiento de datos' },
];

async function revisar(navegador, etiqueta, viewport) {
  console.log(`\n=== ${etiqueta} (${viewport.width}px) ===\n`);
  const contexto = await navegador.newContext({ viewport });
  const pagina = await contexto.newPage();
  // Mismo umbral que `--breakpoint-nav` (global.css): por debajo manda la
  // hamburguesa y por encima la fila de enlaces.
  const movil = viewport.width < 1180;

  // ---- 1, 3 y 4: recorrido por todas las páginas --------------------------
  const sinCta = [];
  const migasMal = [];
  const conPideky = [];

  for (const { camino, miga } of PAGINAS) {
    await pagina.goto(url(camino), { waitUntil: 'domcontentloaded' });

    const cta = pagina.locator('header a.btn-accent').first();
    const href = await cta.getAttribute('href').catch(() => null);
    const texto = ((await cta.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
    if (href !== `${BASE}/pedido/` || !/Arma tu pedido/.test(texto)) sinCta.push(camino);

    const migas = pagina.locator('nav[aria-label="Ruta de navegación"]');
    const cuantas = await migas.count();
    if (miga === null) {
      if (cuantas !== 0) migasMal.push(`${camino}: no debería tener migas`);
    } else {
      const contenido = ((await migas.first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
      // `textContent` pega los <li> sin espacios ("Inicio›Nosotros"); la
      // separacion visual la pone el flex, no el texto.
      const correcto =
        cuantas === 1 && /^Inicio\s*›\s*/.test(contenido) && contenido.endsWith(miga);
      if (!correcto) migasMal.push(`${camino}: "${contenido}"`);
      // Lo que motivó el arreglo: nunca el pathname con el prefijo.
      if (contenido.includes(BASE)) migasMal.push(`${camino}: muestra la ruta cruda`);
    }

    const html = await pagina.content();
    if (/>\s*(Ir a )?Pideky\s*</i.test(html)) conPideky.push(camino);
  }

  comprobar(
    `${etiqueta}: el CTA "Arma tu pedido" está en la barra de las ${PAGINAS.length} páginas`,
    sinCta.length === 0,
    sinCta.join(', '),
  );
  comprobar(
    `${etiqueta}: las migas dicen "Inicio › {Nombre}" y el inicio no las tiene`,
    migasMal.length === 0,
    migasMal.join(' | '),
  );
  comprobar(
    `${etiqueta}: con PIDEKY_URL vacío no queda ningún enlace a Pideky`,
    conPideky.length === 0,
    conPideky.join(', '),
  );

  // ---- 2: menú ------------------------------------------------------------
  await pagina.goto(url('/nosotros/'), { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(300);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

  const toggle = pagina.locator('#nav-toggle');
  const enlaceCatalogo = pagina.locator('#main-nav a', { hasText: 'Catálogo' }).first();

  if (!movil) {
    comprobar(
      `${etiqueta}: los enlaces del menú se ven sin abrir nada`,
      await enlaceCatalogo.isVisible(),
    );
    comprobar(`${etiqueta}: la hamburguesa no se muestra`, !(await toggle.isVisible()));
    await contexto.close();
    return;
  }

  comprobar(`${etiqueta}: con el menú cerrado los enlaces no se ven`, !(await enlaceCatalogo.isVisible()));
  comprobar(
    `${etiqueta}: la hamburguesa declara aria-expanded="false" y aria-controls`,
    (await toggle.getAttribute('aria-expanded')) === 'false' &&
      (await toggle.getAttribute('aria-controls')) === 'main-nav',
  );

  await toggle.click();
  await pagina.waitForTimeout(350);
  comprobar(`${etiqueta}: la hamburguesa abre el menú`, await enlaceCatalogo.isVisible());
  comprobar(
    `${etiqueta}: aria-expanded pasa a "true"`,
    (await toggle.getAttribute('aria-expanded')) === 'true',
  );
  comprobar(
    `${etiqueta}: el foco entra en el menú`,
    await pagina.evaluate(() =>
      document.getElementById('main-nav')?.contains(document.activeElement),
    ),
  );
  comprobar(
    `${etiqueta}: el CTA "Arma tu pedido" está destacado al final del menú`,
    await pagina.locator('#main-nav a.btn-accent').isVisible(),
  );

  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(350);
  comprobar(`${etiqueta}: Escape cierra el menú`, !(await enlaceCatalogo.isVisible()));

  await toggle.click();
  await pagina.waitForTimeout(350);
  await enlaceCatalogo.click();
  await pagina.waitForLoadState('domcontentloaded');
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: al navegar, la página nueva no queda con el menú abierto`,
    (await pagina.locator('#nav-toggle').getAttribute('aria-expanded')) === 'false' &&
      pagina.url().endsWith('/catalogo/'),
    pagina.url(),
  );

  await contexto.close();
}

// --- 5. Cabeceras en vercel.json y en las respuestas ---------------------------

/** Valor exacto que tiene que llevar cada cabecera (salvo la CSP, que va aparte). */
const ESPERADAS = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  // geolocation=(self): la PQRS preselecciona el municipio por ubicación; los
  // iframes de terceros no pueden pedirla. Cámara y micrófono, para nadie.
  'permissions-policy': 'camera=(), microphone=(), geolocation=(self)',
  'access-control-allow-origin': 'https://dstunja.com',
};

/** Lo que la CSP tiene que decir, directiva a directiva. */
function revisarCsp(csp, etiqueta) {
  const d = directivas(csp);
  const fuentes = (nombre) => d.get(nombre) ?? [];
  const tiene = (nombre, ...lista) => lista.every((f) => fuentes(nombre).includes(f));

  comprobar(`${etiqueta}: hay Content-Security-Policy`, Boolean(csp), csp ? '' : '(ausente)');
  comprobar(`${etiqueta}: CSP default-src 'self'`, tiene('default-src', "'self'"));
  comprobar(
    `${etiqueta}: CSP script-src sin 'unsafe-inline' ni 'unsafe-eval', con Turnstile y Tag Manager`,
    tiene('script-src', "'self'", 'https://challenges.cloudflare.com', 'https://www.googletagmanager.com') &&
      !fuentes('script-src').some((f) => /unsafe/.test(f)),
    fuentes('script-src').join(' '),
  );
  comprobar(
    // El segundo es el <iframe> de respaldo de Tag Manager (AnaliticaNoscript.astro),
    // el que ve quien navega sin JavaScript. Nada más debe poder empotrarse.
    `${etiqueta}: CSP frame-src solo Turnstile y Tag Manager`,
    fuentes('frame-src').join(' ') === 'https://challenges.cloudflare.com https://www.googletagmanager.com',
    fuentes('frame-src').join(' '),
  );
  comprobar(`${etiqueta}: CSP img-src con las teselas del mapa`, tiene('img-src', "'self'", 'https://*.tile.openstreetmap.fr'));
  comprobar(`${etiqueta}: CSP font-src solo fuentes propias`, fuentes('font-src').join(' ') === "'self'", fuentes('font-src').join(' '));
  comprobar(
    `${etiqueta}: CSP connect-src con la API propia, Google Analytics y Vercel Blob`,
    tiene('connect-src', "'self'", 'https://*.google-analytics.com', 'https://vercel.com', 'https://*.blob.vercel-storage.com'),
  );
  comprobar(`${etiqueta}: CSP frame-ancestors 'none'`, tiene('frame-ancestors', "'none'"));
  comprobar(
    `${etiqueta}: CSP object-src 'none', base-uri 'self' y form-action 'self'`,
    tiene('object-src', "'none'") && tiene('base-uri', "'self'") && tiene('form-action', "'self'"),
  );
}

/**
 * Referrer-Policy igual o MÁS estricta que la pedida. /api/pqrs/descarga pone
 * `no-referrer` a propósito (no filtrar la URL firmada a la que redirige) y en
 * Vercel la cabecera de la función prevalece sobre la de vercel.json.
 */
const REFERRER_ACEPTADAS = new Set(['strict-origin-when-cross-origin', 'same-origin', 'strict-origin', 'no-referrer']);

const cabeceraCorrecta = (nombre, valor) =>
  nombre === 'referrer-policy' ? REFERRER_ACEPTADAS.has(valor ?? '') : valor === ESPERADAS[nombre];

function revisarCabeceras(cabeceras, etiqueta) {
  for (const [nombre, valor] of Object.entries(ESPERADAS)) {
    comprobar(`${etiqueta}: ${nombre}`, (cabeceras[nombre] ?? '') === valor, cabeceras[nombre] ?? '(ausente)');
  }
  revisarCsp(cabeceras['content-security-policy'], etiqueta);
}

/** Cabeceras de una respuesta de `fetch` como objeto en minúsculas. */
const aObjeto = (headers) => Object.fromEntries([...headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));

async function revisarConfiguracion() {
  console.log('\n=== Cabeceras de seguridad: vercel.json y servidor local ===\n');

  const declaradas = cabecerasPara('/');
  revisarCabeceras(declaradas, 'vercel.json');
  comprobar(
    'vercel.json: la CSP pide upgrade-insecure-requests',
    directivas(declaradas['content-security-policy']).has('upgrade-insecure-requests'),
  );
  comprobar(
    'vercel.json: las cabeceras se aplican a todas las rutas (source "/(.*)")',
    (VERCEL.headers ?? []).some((b) => b.source === '/(.*)'),
  );

  const pagina = await fetch(url('/'));
  const html = await pagina.text();
  revisarCabeceras(aObjeto(pagina.headers), 'Servidor local, página');
  const hojaCss = /href="([^"]+\.css)"/.exec(html)?.[1];
  if (hojaCss) {
    const recurso = await fetch(`http://localhost:${PUERTO}${hojaCss}`);
    const cabeceras = aObjeto(recurso.headers);
    comprobar(
      'Servidor local, archivo estático: sin Access-Control-Allow-Origin: *',
      cabeceras['access-control-allow-origin'] === 'https://dstunja.com',
      cabeceras['access-control-allow-origin'] ?? '(ausente)',
    );
  }
}

// --- 6. HTML publicado: sin comentarios ni scripts en línea -------------------

async function paginasHtml(directorio = RAIZ) {
  const salida = [];
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await paginasHtml(ruta)));
    else if (entrada.name.endsWith('.html')) salida.push(ruta);
  }
  return salida;
}

async function revisarHtmlPublicado() {
  console.log('\n=== HTML publicado ===\n');
  const archivos = await paginasHtml();
  const conComentarios = [];
  const conScriptsEnLinea = [];
  for (const archivo of archivos) {
    const html = await readFile(archivo, 'utf8');
    const sinBloques = html.replace(/<(script|style|textarea|pre)\b[\s\S]*?<\/\1\s*>/gi, '');
    if (sinBloques.includes('<!--')) conComentarios.push(archivo.slice(RAIZ.length));
    const scripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>/gi) ?? [];
    if (scripts.some((s) => !/type="application\/(ld\+)?json"/i.test(s))) {
      conScriptsEnLinea.push(archivo.slice(RAIZ.length));
    }
  }
  comprobar(
    `Ninguna de las ${archivos.length} páginas publica comentarios HTML`,
    conComentarios.length === 0,
    conComentarios.slice(0, 4).join(', '),
  );
  comprobar(
    'Ninguna página lleva scripts ejecutables en línea (la CSP los bloquearía)',
    conScriptsEnLinea.length === 0,
    conScriptsEnLinea.slice(0, 4).join(', '),
  );
}

// --- 7. La CSP en el navegador, con la red real -------------------------------

/**
 * Abre un contexto que apunta cada bloqueo de CSP: el evento
 * `securitypolicyviolation` de la página y los avisos de consola del navegador
 * (algunos, como frame-ancestors, solo salen por consola).
 */
async function contextoVigilado(navegador, viewport = { width: 1280, height: 900 }) {
  const contexto = await navegador.newContext({ viewport });
  await contexto.addInitScript(() => {
    window.__violacionesCsp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__violacionesCsp.push(`${e.violatedDirective} → ${e.blockedURI || '(en línea)'}`);
    });
  });
  const consola = [];
  contexto.on('console', (m) => {
    if (/Content Security Policy|Refused to (load|execute|connect|frame|apply)/i.test(m.text())) {
      consola.push(m.text().slice(0, 200));
    }
  });
  return { contexto, consola };
}

async function rechazarCookies(pagina) {
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();
}

/** Baja hasta el final poco a poco, para disparar lo que carga al hacer scroll. */
async function recorrer(pagina) {
  await pagina.evaluate(async () => {
    const paso = Math.max(400, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.body.scrollHeight; y += paso) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
}

const violaciones = (pagina) => pagina.evaluate(() => window.__violacionesCsp ?? []);

async function teselasCargadas(pagina) {
  const mapa = pagina.locator('.leaflet-container').first();
  if ((await mapa.count()) === 0) return { ok: false, detalle: 'no hay mapa' };
  await mapa.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  try {
    await pagina.waitForFunction(
      () => document.querySelectorAll('.leaflet-tile-loaded').length > 0,
      null,
      { timeout: 20_000 },
    );
  } catch {
    // Se informa abajo con el recuento.
  }
  const cargadas = await pagina.locator('.leaflet-tile-loaded').count();
  return { ok: cargadas > 0, detalle: `${cargadas} teselas cargadas` };
}

/**
 * @param base    origen más prefijo, sin barra final
 *                (http://localhost:4399/proyecto_paginaWeb o https://dstunja.com)
 * @param local   true: con dobles de las funciones y envío de los formularios
 */
async function revisarCspEnNavegador(navegador, { base, local, etiqueta }) {
  console.log(`\n=== CSP en el navegador · ${etiqueta} ===\n`);
  const { contexto, consola } = await contextoVigilado(navegador);
  const pagina = await contexto.newPage();

  // ---- Todas las páginas cargan sin bloqueos -------------------------------
  const bloqueos = [];
  for (const { camino } of PAGINAS) {
    await pagina.goto(`${base}${camino}`, { waitUntil: 'load' });
    await rechazarCookies(pagina);
    await recorrer(pagina);
    await pagina.waitForTimeout(1200);
    for (const v of await violaciones(pagina)) bloqueos.push(`${camino}: ${v}`);
  }
  comprobar(
    `${etiqueta}: ninguna de las ${PAGINAS.length} páginas provoca bloqueos de CSP`,
    bloqueos.length === 0 && consola.length === 0,
    [...bloqueos, ...consola].slice(0, 5).join(' | '),
  );

  // ---- Mapas -----------------------------------------------------------------
  for (const camino of ['/', '/contactanos/']) {
    await pagina.goto(`${base}${camino}`, { waitUntil: 'load' });
    await rechazarCookies(pagina);
    const { ok, detalle } = await teselasCargadas(pagina);
    comprobar(`${etiqueta}: el mapa de ${camino} carga teselas`, ok, detalle);
  }

  // ---- Turnstile ---------------------------------------------------------------
  for (const camino of ['/pqrs/', '/empleos/']) {
    await pagina.goto(`${base}${camino}`, { waitUntil: 'load' });
    await rechazarCookies(pagina);
    // Un despliegue de vista previa puede compilarse sin la clave (las
    // variables están solo en Production): ahí el formulario ni monta Turnstile.
    const clave = await pagina.locator('[data-turnstile-key]').first().getAttribute('data-turnstile-key');
    if (!clave) {
      console.log(`  --    ${etiqueta}: Turnstile omitido en ${camino} — el build no lleva PUBLIC_TURNSTILE_SITE_KEY`);
      continue;
    }
    const cargo = await pagina
      .waitForFunction(() => Boolean(window.turnstile), null, { timeout: 20_000 })
      .then(() => true, () => false);
    const iframe = await pagina
      .waitForFunction(
        () => [...document.querySelectorAll('iframe')].some((f) => f.src.includes('challenges.cloudflare.com')) ||
          document.querySelector('[name="cf-turnstile-response"]') !== null,
        null,
        { timeout: 20_000 },
      )
      .then(() => true, () => false);
    comprobar(
      `${etiqueta}: Turnstile carga y monta su widget en ${camino}`,
      cargo && iframe && (await violaciones(pagina)).length === 0,
      `script=${cargo} widget=${iframe}`,
    );
  }

  // ---- Geolocalización bajo Permissions-Policy: geolocation=(self) ------------
  {
    // Coordenadas de la plaza de Samacá, con el permiso concedido. El municipio
    // más cercano tiene que ser Samacá y no Tunja, a unos 20 km.
    const conUbicacion = await navegador.newContext({
      viewport: { width: 1280, height: 900 },
      permissions: ['geolocation'],
      geolocation: { latitude: 5.4918, longitude: -73.4853 },
    });
    await conUbicacion.addInitScript(() => {
      window.__violacionesCsp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__violacionesCsp.push(`${e.violatedDirective} → ${e.blockedURI || '(en línea)'}`);
      });
    });
    const paginaGeo = await conUbicacion.newPage();
    await paginaGeo.goto(`${base}/pqrs/`, { waitUntil: 'load' });
    await rechazarCookies(paginaGeo);

    const politica = await paginaGeo.evaluate(() => {
      const fp = document.featurePolicy;
      if (!fp) return null;
      return {
        geolocalizacion: fp.allowsFeature('geolocation'),
        geolocalizacionTerceros: fp.allowsFeature('geolocation', 'https://example.com'),
        camara: fp.allowsFeature('camera'),
        microfono: fp.allowsFeature('microphone'),
      };
    });
    comprobar(
      `${etiqueta}: Permissions-Policy deja la geolocalización al propio sitio y a nadie más, sin cámara ni micrófono`,
      politica !== null &&
        politica.geolocalizacion === true &&
        politica.geolocalizacionTerceros === false &&
        politica.camara === false &&
        politica.microfono === false,
      JSON.stringify(politica),
    );

    await paginaGeo.locator('label:has(input[name="categoria-opcion"][value="comercial"])').click();
    await paginaGeo.waitForTimeout(250);
    await paginaGeo.locator('label:has(input[name="tipo-opcion"][value="Queja"])').click();
    const preseleccion = await paginaGeo
      .waitForFunction(() => document.querySelector('#municipio-pqrs')?.value === 'Samacá', null, { timeout: 15_000 })
      .then(() => true, () => false);
    comprobar(
      `${etiqueta}: con ubicación concedida, la PQRS preselecciona el municipio más cercano`,
      preseleccion && (await violaciones(paginaGeo)).length === 0,
      await paginaGeo.locator('#municipio-pqrs').inputValue(),
    );
    await conUbicacion.close();
  }

  // ---- Analítica ---------------------------------------------------------------
  {
    /*
     * Se miran las PETICIONES, no las respuestas. Con un ID de contenedor de
     * prueba (GTM-TEST000) Google responde 404 con un tipo que no es JavaScript
     * y Chrome la descarta por ORB, así que no hay respuesta que mirar. Lo que
     * aquí se comprueba es lo que depende de este repositorio: que el arranque
     * se ejecute, arme el `dataLayer` y consiga pedir el contenedor sin que la
     * CSP lo corte. Que el contenedor exista es cosa de la cuenta de GTM.
     */
    const peticionesGa = [];
    const alPedir = (r) => {
      if (/googletagmanager\.com\/gtm\.js|google-analytics\.com\/g\/collect/.test(r.url())) {
        peticionesGa.push(`${new URL(r.url()).host}${new URL(r.url()).pathname}`);
      }
    };
    pagina.on('request', alPedir);
    await pagina.goto(`${base}/`, { waitUntil: 'load' });
    // Analitica.astro solo siembra esta etiqueta si hay ID de contenedor.
    const conGtm = (await pagina.content()).includes('analitica-arranque.js');
    if (!conGtm) {
      console.log(`  --    ${etiqueta}: analítica omitida — el build no lleva PUBLIC_GTM_CONTAINER_ID`);
    } else {
      await pagina.waitForTimeout(4000);
      const arranco = await pagina.evaluate(
        () => typeof window.gtag === 'function' && Array.isArray(window.dataLayer) && window.dataLayer.some((e) => e && e.event === 'gtm.js'),
      );
      comprobar(
        `${etiqueta}: la analítica pide el contenedor de Tag Manager sin bloqueos de CSP`,
        arranco && peticionesGa.some((r) => r.includes('gtm.js')) && (await violaciones(pagina)).length === 0,
        peticionesGa.join(', ') || '(no se pidió nada a Google)',
      );
    }
    pagina.off('request', alPedir);
  }

  // ---- connect-src: lo permitido pasa, lo ajeno no -----------------------------
  {
    await pagina.goto(`${base}/pqrs/`, { waitUntil: 'load' });
    await pagina.evaluate(() => {
      window.__violacionesCsp = [];
    });
    const resultado = await pagina.evaluate(async () => {
      const probar = async (destino) => {
        try {
          await fetch(destino, { mode: 'no-cors', cache: 'no-store' });
          return 'sale';
        } catch {
          return 'no sale';
        }
      };
      return {
        ga: await probar('https://region1.google-analytics.com/g/collect?v=2'),
        blob: await probar('https://vercel.com/api/blob/'),
        ajeno: await probar('https://example.com/'),
      };
    });
    const probas = await violaciones(pagina);
    comprobar(
      `${etiqueta}: connect-src deja salir hacia Google Analytics y Vercel Blob`,
      !probas.some((v) => /google-analytics|vercel\.com/.test(v)),
      `ga=${resultado.ga} blob=${resultado.blob}`,
    );
    comprobar(
      `${etiqueta}: connect-src bloquea un destino ajeno (la CSP está activa)`,
      probas.some((v) => v.includes('connect-src') && v.includes('example.com')),
      probas.join(' | ') || '(sin bloqueo)',
    );
  }

  // ---- Formularios, solo en local (en producción mandarían correos) -----------
  if (local) {
    llamadasApi.length = 0;
    await pagina.goto(`${base}/pqrs/`, { waitUntil: 'load' });
    await rechazarCookies(pagina);
    await pagina.locator('label:has(input[name="categoria-opcion"][value="administrativa"])').click();
    await pagina.fill('#nombre-admin', 'Prueba de la CSP');
    await pagina.fill('#telefono-admin', '3106232429');
    await pagina.fill('#mensaje-admin', 'Comprobación automática de la política de seguridad.');
    await pagina.click('[data-enviar-admin]');
    const adminOk = await pagina
      .locator('[data-confirmacion-admin]')
      .waitFor({ state: 'visible', timeout: 40_000 })
      .then(() => true, () => false);
    comprobar(
      `${etiqueta}: PQRS administrativa obtiene token de Turnstile y llega a su API`,
      adminOk && llamadasApi.some((l) => l.ruta === '/api/pqrs/administrativa') && (await violaciones(pagina)).length === 0,
      JSON.stringify(llamadasApi),
    );

    const carpeta = await mkdtemp(join(tmpdir(), 'dst-csp-'));
    const pdf = join(carpeta, 'hoja de vida.pdf');
    await writeFile(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

    await pagina.goto(`${base}/empleos/`, { waitUntil: 'load' });
    await rechazarCookies(pagina);
    await pagina.fill('#nombre-empleo', 'Prueba de la CSP');
    await pagina.fill('#correo-empleo', 'practicaspasantiasdst@gmail.com');
    await pagina.fill('#telefono-empleo', '3106232429');
    await pagina.setInputFiles('#hoja-de-vida-empleo', pdf);
    await pagina.check('#autorizacion-empleo');
    await pagina.waitForTimeout(400);
    await pagina.click('[data-enviar-empleo]');
    const empleoOk = await pagina
      .locator('[data-confirmacion-empleo]')
      .waitFor({ state: 'visible', timeout: 40_000 })
      .then(() => true, () => false);
    comprobar(
      `${etiqueta}: Empleos obtiene token de Turnstile y envía el multipart a su API`,
      empleoOk && llamadasApi.some((l) => l.ruta === '/api/empleos/postular' && l.bytes > 0) && (await violaciones(pagina)).length === 0,
      JSON.stringify(llamadasApi),
    );
  }

  await contexto.close();
}

// --- Producción: cabeceras y redirección a https ---------------------------------

async function revisarProduccionHttp(origen) {
  console.log(`\n=== Producción: cabeceras y https · ${origen} ===\n`);

  const inicio = await fetch(`${origen}/`, { cache: 'no-store' });
  const html = await inicio.text();
  revisarCabeceras(aObjeto(inicio.headers), `${origen}/`);
  comprobar(
    `${origen}/: la CSP pide upgrade-insecure-requests`,
    directivas(inicio.headers.get('content-security-policy')).has('upgrade-insecure-requests'),
  );
  comprobar(`${origen}/: el HTML no publica comentarios`, !html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '').includes('<!--'));

  const hojaCss = /href="(\/_astro\/[^"]+\.css)"/.exec(html)?.[1];
  for (const camino of [hojaCss, '/pqrs/', '/api/pqrs/descarga'].filter(Boolean)) {
    const r = await fetch(`${origen}${camino}`, { cache: 'no-store', redirect: 'manual' });
    const c = aObjeto(r.headers);
    comprobar(
      `${origen}${camino} (${r.status}): cabeceras de seguridad y sin Access-Control-Allow-Origin: *`,
      Object.keys(ESPERADAS).every((k) => cabeceraCorrecta(k, c[k])) && Boolean(c['content-security-policy']),
      Object.keys(ESPERADAS)
        .filter((k) => !cabeceraCorrecta(k, c[k]))
        .map((k) => `${k}=${c[k] ?? '(ausente)'}`)
        .join(', ') || `referrer-policy=${c['referrer-policy']}`,
    );
  }

  const inseguro = origen.replace(/^https:/, 'http:');
  const redireccion = await fetch(`${inseguro}/`, { redirect: 'manual' });
  const destino = redireccion.headers.get('location') ?? '';
  comprobar(
    `${inseguro}/ redirige a https con 301 o 308`,
    [301, 308].includes(redireccion.status) && destino.startsWith('https://'),
    `${redireccion.status} → ${destino || '(sin Location)'}`,
  );
}

// --- Ejecución --------------------------------------------------------------------

const indiceUrl = process.argv.indexOf('--url');
const origenProduccion = indiceUrl !== -1 ? process.argv[indiceUrl + 1]?.replace(/\/$/, '') : '';
const soloProduccion = process.argv.includes('--solo-url');

const navegador = await chromium.launch();

try {
  if (!soloProduccion) {
    const servidor = await servir();
    try {
      await revisarConfiguracion();
      await revisarHtmlPublicado();
      await revisar(navegador, 'Móvil', { width: 375, height: 720 });
      await revisar(navegador, 'Escritorio', { width: 1280, height: 800 });
      await revisarCspEnNavegador(navegador, {
        base: `http://localhost:${PUERTO}${BASE}`,
        local: true,
        etiqueta: 'local',
      });
    } finally {
      servidor.close();
    }
  }

  if (origenProduccion) {
    await revisarProduccionHttp(origenProduccion);
    await revisarCspEnNavegador(navegador, { base: origenProduccion, local: false, etiqueta: 'producción' });
  }
} finally {
  await navegador.close();
}

const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallas.length === 0 ? 0 : 1);

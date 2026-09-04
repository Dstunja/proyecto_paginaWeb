/**
 * Verificación de la barra, el menú móvil, las migas y los enlaces a Pideky,
 * con un navegador de verdad sobre el sitio YA COMPILADO en dist/.
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
 * Uso:
 *   npm run build
 *   node scripts/verificar-navegacion.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = join(process.cwd(), 'dist');
const BASE = '/proyecto_paginaWeb';
const PUERTO = 4324;

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
  const movil = viewport.width < 1100;

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

/**
 * Verificación del formulario de PQRS con un navegador de verdad y archivos de
 * verdad, sobre el sitio YA COMPILADO en dist/.
 *
 * Se comprueban dos cosas distintas:
 *
 * A) EL CAMPO DE SOPORTE, que no toca la red:
 *   1. Solo existe para Queja y Reclamo. Con Petición, Sugerencia o
 *      Felicitación está oculto y el input deshabilitado.
 *   2. Al cambiar a un tipo sin soporte se limpia lo seleccionado.
 *   3. Un archivo válido de cada formato se acepta y se lista con su tamaño.
 *   4. Se rechazan el formato no permitido, la doble extensión, el contenido
 *      que no corresponde a la extensión y el exceso de peso.
 *   5. No se pueden adjuntar más de 3 archivos.
 *
 * B) LA RADICACIÓN, interceptando las llamadas con `page.route()`:
 *   6. Sin adjuntos: se llama a POST /api/pqrs y sale la pantalla con el
 *      radicado, la fecha y el botón de copiar.
 *   7. Con adjuntos: se llama a POST /api/pqrs/token con el sessionId, el tipo
 *      y el token de Turnstile, y con una ruta bajo pqrs/pendientes/{sessionId}/.
 *   8. Un 400 del servidor se muestra tal cual y NO abre el gestor de correo.
 *   9. Si la API no contesta, se cae al respaldo por correo con un aviso que
 *      dice que así no queda radicada.
 *
 * El script de Cloudflare Turnstile también se intercepta: se sirve un doble
 * que devuelve un token de mentira. Así la prueba no depende de la red ni de
 * tener claves reales.
 *
 * Uso:
 *   npm run build
 *   node scripts/verificar-pqrs.mjs
 *
 * Sin dependencias nuevas: Playwright ya está en devDependencies. Los archivos
 * de prueba se generan en el directorio temporal del sistema, no en el
 * repositorio.
 */
import { createServer } from 'node:http';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { crc32 } from 'node:zlib';
import { chromium } from 'playwright';

// Con el adaptador de Vercel el sitio estatico queda en dist/client.
const RAIZ = join(process.cwd(), 'dist', 'client');
const PUERTO = 4323;

/**
 * Prefijo con el que compila `npm run build` fuera de Vercel (el espejo de
 * GitHub Pages). Las paginas piden sus assets como
 * "/proyecto_paginaWeb/_astro/...", asi que el servidor de aqui tiene que
 * quitarselo; si no, el CSS y el JS dan 404, la pagina se pinta sin estilos y
 * TODAS las comprobaciones del DOM fallan sin que el formulario tenga nada
 * malo. Es lo mismo que hace scripts/verificar-navegacion.mjs.
 */
const BASE = '/proyecto_paginaWeb';

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

// --- Archivos de prueba -----------------------------------------------------

/** ZIP mínimo con una entrada almacenada, para hacer un .docx creíble. */
function zipConUnaEntrada(nombreEntrada, contenido) {
  const nombre = Buffer.from(nombreEntrada, 'utf8');
  const datos = Buffer.from(contenido, 'utf8');
  const suma = crc32(datos);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(suma, 14);
  local.writeUInt32LE(datos.length, 18);
  local.writeUInt32LE(datos.length, 22);
  local.writeUInt16LE(nombre.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(suma, 16);
  central.writeUInt32LE(datos.length, 20);
  central.writeUInt32LE(datos.length, 24);
  central.writeUInt16LE(nombre.length, 28);

  const inicioCentral = local.length + nombre.length + datos.length;
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(1, 8);
  fin.writeUInt16LE(1, 10);
  fin.writeUInt32LE(central.length + nombre.length, 12);
  fin.writeUInt32LE(inicioCentral, 16);

  return Buffer.concat([local, nombre, datos, central, nombre, fin]);
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);
const OLE2 = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.alloc(1024),
]);

async function prepararArchivos() {
  const carpeta = await mkdtemp(join(tmpdir(), 'dst-pqrs-'));
  const ruta = (nombre) => join(carpeta, nombre);

  const docx = zipConUnaEntrada(
    'word/document.xml',
    '<?xml version="1.0"?><w:document xmlns:w="x"><w:body/></w:document>',
  );
  const pngEnorme = Buffer.concat([PNG_1X1, Buffer.alloc(6 * 1024 * 1024)]);

  const archivos = {
    pngValido: ruta('foto-del-producto.png'),
    pdfValido: ruta('factura de compra.pdf'),
    docxValido: ruta('descripcion.docx'),
    docValido: ruta('carta.doc'),
    texto: ruta('notas.txt'),
    dobleExtension: ruta('factura.exe.pdf'),
    pdfFalso: ruta('soporte.pdf'),
    pesado: ruta('escaneo-gigante.png'),
    extra1: ruta('extra-1.png'),
    extra2: ruta('extra-2.png'),
  };

  await Promise.all([
    writeFile(archivos.pngValido, PNG_1X1),
    writeFile(archivos.pdfValido, PDF_MINIMO),
    writeFile(archivos.docxValido, docx),
    writeFile(archivos.docValido, OLE2),
    writeFile(archivos.texto, 'Esto es un archivo de texto plano.\n'),
    writeFile(archivos.dobleExtension, PDF_MINIMO),
    writeFile(archivos.pdfFalso, 'MZ Esto no es un PDF, es texto plano disfrazado.\n'),
    writeFile(archivos.pesado, pngEnorme),
    writeFile(archivos.extra1, PNG_1X1),
    writeFile(archivos.extra2, PNG_1X1),
  ]);

  return archivos;
}

// --- Dobles de red ----------------------------------------------------------

/**
 * Doble del script de Turnstile.
 *
 * Implementa la parte de la API que usa src/lib/turnstile-cliente.ts: render
 * devuelve un id, execute llama al callback con un token de mentira. Se sirve
 * en lugar del script de Cloudflare para que la prueba no necesite red.
 */
const TURNSTILE_FALSO = `
  (function () {
    var callbacks = {};
    var contador = 0;
    window.turnstile = {
      render: function (contenedor, opciones) {
        var id = 'widget-' + ++contador;
        callbacks[id] = opciones.callback;
        return id;
      },
      execute: function (id) {
        var cb = callbacks[id];
        if (cb) setTimeout(function () { cb('token-de-prueba-' + Date.now()); }, 10);
      },
      reset: function () {},
      remove: function () {},
    };
    if (window.alTurnstileListo) window.alTurnstileListo();
  })();
`;

/** Instala los dobles y devuelve el registro de lo que se pidió. */
async function instalarDobles(pagina, plan) {
  const registro = { token: [], radicar: [] };

  await pagina.route('https://challenges.cloudflare.com/**', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'text/javascript', body: TURNSTILE_FALSO }),
  );

  await pagina.route('**/api/pqrs/token', async (ruta) => {
    registro.token.push(JSON.parse(ruta.request().postData() ?? '{}'));
    // Se responde con un error para no tener que remedar todo el protocolo de
    // subida de Vercel Blob: lo que se está comprobando aquí es que el
    // navegador PIDE el token con los datos correctos.
    await ruta.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, errores: ['Subida rechazada por la prueba.'] }),
    });
  });

  await pagina.route('**/api/pqrs', async (ruta) => {
    registro.radicar.push(JSON.parse(ruta.request().postData() ?? '{}'));
    if (plan.radicar === 'caida') {
      await ruta.abort('connectionrefused');
      return;
    }
    if (plan.radicar === 'error') {
      await ruta.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, errores: ['El municipio es obligatorio.'] }),
      });
      return;
    }
    await ruta.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        radicado: 'PQRS-20260907-A7K2M9',
        fecha: '7 de septiembre de 2026, 9:15',
      }),
    });
  });

  // Chromium no emite ningún evento observable al abrir un mailto:, así que el
  // formulario marca `data-respaldo="correo"` en su raíz antes de navegar y eso
  // es lo que se comprueba.

  return registro;
}

async function rellenarFormulario(pagina, tipo = 'Queja') {
  await pagina.selectOption('#tipo-pqrs', tipo);
  await pagina.fill('#nombre-pqrs', 'Cristian Amaya');
  await pagina.fill('#telefono-pqrs', '3106232429');
  await pagina.fill('#correo-pqrs', 'practicaspasantiasdst@gmail.com');
  await pagina.fill('#municipio-pqrs', 'Tunja');
  await pagina.fill('#descripcion-pqrs', 'Prueba automática del formulario de PQRS.');
  await pagina.check('#autorizacion-pqrs');
}

// --- A) El campo de soporte -------------------------------------------------

async function revisarCampo(navegador, archivos, etiqueta, viewport) {
  console.log(`\n=== A) Campo de soporte · ${etiqueta} (${viewport.width}px) ===\n`);
  const contexto = await navegador.newContext({ viewport });
  const pagina = await contexto.newPage();
  await instalarDobles(pagina, { radicar: 'ok' });

  await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(300);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

  const bloque = pagina.locator('[data-adjuntos]');
  const entrada = pagina.locator('[data-adjuntos] [data-entrada]');
  const lista = pagina.locator('[data-adjuntos] [data-lista]');
  const error = pagina.locator('[data-adjuntos] [data-error]');
  const tipo = pagina.locator('#tipo-pqrs');

  const adjuntar = async (...rutas) => {
    await entrada.setInputFiles(rutas);
    await pagina.waitForTimeout(400);
  };

  // ---- 1. Solo para Queja y Reclamo ---------------------------------------
  comprobar(
    `${etiqueta}: con "Petición" el campo de soporte no se ve`,
    !(await bloque.isVisible()),
  );
  comprobar(`${etiqueta}: con "Petición" el input está deshabilitado`, await entrada.isDisabled());

  for (const sinSoporte of ['Sugerencia', 'Felicitación']) {
    await tipo.selectOption(sinSoporte);
    await pagina.waitForTimeout(150);
    comprobar(
      `${etiqueta}: con "${sinSoporte}" el campo sigue oculto y deshabilitado`,
      !(await bloque.isVisible()) && (await entrada.isDisabled()),
    );
  }

  for (const conSoporte of ['Queja', 'Reclamo']) {
    await tipo.selectOption(conSoporte);
    await pagina.waitForTimeout(150);
    comprobar(
      `${etiqueta}: con "${conSoporte}" el campo aparece y queda habilitado`,
      (await bloque.isVisible()) && !(await entrada.isDisabled()),
    );
  }

  // ---- Ayuda y accept ------------------------------------------------------
  const ayuda = (await pagina.locator('[data-adjuntos] [data-ayuda]').textContent()) ?? '';
  comprobar(
    `${etiqueta}: el texto de ayuda enumera formatos y peso máximo`,
    ayuda.trim() === 'Formatos permitidos: PDF, Word (.doc, .docx), JPG, PNG. Máximo 5 MB.',
    ayuda.trim(),
  );
  const accept = await entrada.getAttribute('accept');
  comprobar(
    `${etiqueta}: el accept del input lista las seis extensiones`,
    accept === '.pdf,.doc,.docx,.jpg,.jpeg,.png',
    accept ?? '(sin accept)',
  );

  // ---- 3. Archivos válidos -------------------------------------------------
  await adjuntar(archivos.pngValido);
  comprobar(
    `${etiqueta}: un PNG válido se acepta y aparece en la lista`,
    (await lista.locator('li').count()) === 1 && !(await error.isVisible()),
  );
  const fila = (await lista.locator('li').first().innerText()).replace(/\s+/g, ' ').trim();
  comprobar(
    `${etiqueta}: la lista muestra el nombre, el tamaño y el botón de quitar`,
    fila.includes('foto-del-producto.png') && /\d+\s?(B|KB|MB)/.test(fila) && fila.includes('Quitar'),
    fila,
  );

  await lista.locator('[data-quitar]').first().click();
  await pagina.waitForTimeout(150);
  comprobar(
    `${etiqueta}: "Quitar" saca el archivo de la lista y del input`,
    (await lista.locator('li').count()) === 0 &&
      (await entrada.evaluate((e) => e.files.length)) === 0,
  );

  for (const [nombre, ruta] of [
    ['un PDF', archivos.pdfValido],
    ['un DOCX', archivos.docxValido],
    ['un DOC', archivos.docValido],
  ]) {
    await adjuntar(ruta);
    const aceptado = (await lista.locator('li').count()) === 1 && !(await error.isVisible());
    comprobar(
      `${etiqueta}: ${nombre} válido se acepta`,
      aceptado,
      aceptado ? '' : ((await error.textContent()) ?? '').trim(),
    );
    await lista.locator('[data-quitar]').first().click();
    await pagina.waitForTimeout(120);
  }

  // ---- 4. Rechazos ---------------------------------------------------------
  const rechazos = [
    ['un .txt se rechaza por formato no permitido', archivos.texto, /formato no permitido/i],
    ['"factura.exe.pdf" se rechaza por doble extensión', archivos.dobleExtension, /doble extensión/i],
    [
      'un texto renombrado a .pdf se rechaza por su contenido real',
      archivos.pdfFalso,
      /no reconocemos el contenido|no corresponde a la extensión/i,
    ],
    ['un archivo de más de 5 MB se rechaza por peso', archivos.pesado, /máximo es 5 MB/i],
  ];

  for (const [descripcion, ruta, patron] of rechazos) {
    await adjuntar(ruta);
    const texto = ((await error.textContent()) ?? '').trim();
    comprobar(
      `${etiqueta}: ${descripcion}`,
      (await lista.locator('li').count()) === 0 && patron.test(texto),
      texto,
    );
  }

  // ---- 5. Tope de tres -----------------------------------------------------
  await adjuntar(archivos.pngValido, archivos.pdfValido, archivos.extra1);
  comprobar(
    `${etiqueta}: se admiten tres archivos a la vez`,
    (await lista.locator('li').count()) === 3 && !(await error.isVisible()),
  );

  await adjuntar(archivos.extra2);
  comprobar(
    `${etiqueta}: el cuarto archivo se rechaza y avisa del tope`,
    (await lista.locator('li').count()) === 3 &&
      /Solo puedes adjuntar 3 archivos/i.test((await error.textContent()) ?? ''),
    ((await error.textContent()) ?? '').trim(),
  );

  // ---- 2. Cambio de tipo ---------------------------------------------------
  await tipo.selectOption('Petición');
  await pagina.waitForTimeout(200);
  comprobar(
    `${etiqueta}: al pasar a "Petición" el campo se oculta y se vacía`,
    !(await bloque.isVisible()) &&
      (await entrada.isDisabled()) &&
      (await entrada.evaluate((e) => e.files.length)) === 0,
  );

  await tipo.selectOption('Queja');
  await pagina.waitForTimeout(200);
  comprobar(
    `${etiqueta}: al volver a "Queja" la lista aparece vacía`,
    (await bloque.isVisible()) && (await lista.locator('li').count()) === 0,
  );

  await contexto.close();
}

// --- B) La radicación -------------------------------------------------------

async function revisarRadicacion(navegador, archivos) {
  console.log('\n=== B) Radicación contra la API (interceptada) ===\n');
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });

  // ---- 6. Camino feliz sin adjuntos ---------------------------------------
  {
    const pagina = await contexto.newPage();
    const registro = await instalarDobles(pagina, { radicar: 'ok' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Petición');
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(900);

    const confirmacion = pagina.locator('[data-confirmacion]');
    comprobar('Sin adjuntos: se llamó a POST /api/pqrs una vez', registro.radicar.length === 1);
    comprobar(
      'Sin adjuntos: el cuerpo lleva los campos del formulario, no multipart',
      registro.radicar[0]?.nombre === 'Cristian Amaya' &&
        registro.radicar[0]?.municipio === 'Tunja' &&
        registro.radicar[0]?.autorizacion === true,
      JSON.stringify(registro.radicar[0] ?? {}).slice(0, 100),
    );
    comprobar(
      'Sin adjuntos: el cuerpo lleva sessionId con forma de UUID y token de Turnstile',
      /^[0-9a-f-]{36}$/.test(registro.radicar[0]?.sessionId ?? '') &&
        String(registro.radicar[0]?.turnstileToken ?? '').startsWith('token-de-prueba-'),
    );
    comprobar('Sin adjuntos: aparece la pantalla de confirmación', await confirmacion.isVisible());
    comprobar(
      'Sin adjuntos: se muestran el radicado y la fecha',
      (await pagina.locator('[data-radicado]').textContent()) === 'PQRS-20260907-A7K2M9' &&
        ((await pagina.locator('[data-fecha]').textContent()) ?? '').includes('septiembre'),
    );
    comprobar(
      'Sin adjuntos: el formulario desaparece y no se abrió el gestor de correo',
      !(await pagina.locator('[data-form]').isVisible()) && !(await pagina.locator('[data-pqrs][data-respaldo]').count()),
    );

    // Botón de copiar
    await contexto.grantPermissions(['clipboard-read', 'clipboard-write']);
    await pagina.click('[data-copiar]');
    await pagina.waitForTimeout(250);
    const portapapeles = await pagina.evaluate(() => navigator.clipboard.readText());
    comprobar(
      'Sin adjuntos: el botón copia el radicado al portapapeles',
      portapapeles === 'PQRS-20260907-A7K2M9',
      portapapeles,
    );
    await pagina.close();
  }

  // ---- 7. Con adjuntos: se pide el token de subida -------------------------
  {
    const pagina = await contexto.newPage();
    const registro = await instalarDobles(pagina, { radicar: 'ok' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Queja');
    await pagina.setInputFiles('#soporte-pqrs', [archivos.pngValido]);
    await pagina.waitForTimeout(500);
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(1500);

    comprobar('Con adjuntos: se pidió el token a POST /api/pqrs/token', registro.token.length >= 1);

    const carga = JSON.parse(registro.token[0]?.payload?.clientPayload ?? '{}');
    const rutaPedida = registro.token[0]?.payload?.pathname ?? '';
    comprobar(
      'Con adjuntos: el clientPayload lleva sessionId, tipo y token de Turnstile',
      /^[0-9a-f-]{36}$/.test(carga.sessionId ?? '') &&
        carga.tipo === 'Queja' &&
        String(carga.turnstileToken ?? '').startsWith('token-de-prueba-'),
      JSON.stringify(carga).slice(0, 120),
    );
    comprobar(
      'Con adjuntos: la ruta pedida cuelga de pqrs/pendientes/{sessionId}/',
      rutaPedida.startsWith(`pqrs/pendientes/${carga.sessionId}/`) && rutaPedida.endsWith('.png'),
      rutaPedida,
    );
    comprobar(
      'Con adjuntos: si la subida falla no se radica y se explica el motivo',
      registro.radicar.length === 0 &&
        /No pudimos subir/i.test((await pagina.locator('[data-lista-errores]').textContent()) ?? ''),
      ((await pagina.locator('[data-lista-errores]').textContent()) ?? '').trim().slice(0, 90),
    );
    comprobar(
      'Con adjuntos: una subida fallida no abre el gestor de correo',
      !(await pagina.locator('[data-pqrs][data-respaldo]').count()),
    );
    await pagina.close();
  }

  // ---- 8. Error 400 del servidor ------------------------------------------
  {
    const pagina = await contexto.newPage();
    const registro = await instalarDobles(pagina, { radicar: 'error' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Petición');
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(900);

    const errores = (await pagina.locator('[data-lista-errores]').textContent()) ?? '';
    comprobar(
      'Error 400: se muestra el mensaje que devolvió el servidor',
      errores.includes('El municipio es obligatorio.'),
      errores.trim(),
    );
    comprobar(
      'Error 400: NO se cae al gestor de correo y el formulario sigue a la vista',
      !(await pagina.locator('[data-pqrs][data-respaldo]').count()) && (await pagina.locator('[data-form]').isVisible()),
    );
    comprobar(
      'Error 400: el botón de enviar vuelve a quedar disponible',
      !(await pagina.locator('[data-enviar]').isDisabled()),
    );
    await pagina.close();
  }

  // ---- 9. API caída: respaldo por correo -----------------------------------
  {
    const pagina = await contexto.newPage();
    const registro = await instalarDobles(pagina, { radicar: 'caida' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Petición');
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(1200);

    const aviso = (await pagina.locator('[data-form] [data-aviso]').textContent()) ?? '';
    comprobar(
      'API caída: se avisa de que así la solicitud NO queda radicada',
      /NO queda radicada/i.test(aviso),
      aviso.trim().slice(0, 110),
    );
    comprobar(
      'API caída: se abre el gestor de correo como respaldo',
      (await pagina.locator('[data-pqrs][data-respaldo="correo"]').count()) === 1,
    );
    comprobar(
      'API caída: no se muestra pantalla de confirmación con radicado falso',
      !(await pagina.locator('[data-confirmacion]').isVisible()),
    );
    await pagina.close();
  }

  await contexto.close();
}

// --- Ejecución --------------------------------------------------------------

const archivos = await prepararArchivos();
const servidor = await servir();
const navegador = await chromium.launch();

try {
  await revisarCampo(navegador, archivos, 'Móvil', { width: 375, height: 720 });
  await revisarCampo(navegador, archivos, 'Escritorio', { width: 1280, height: 800 });
  await revisarRadicacion(navegador, archivos);
} finally {
  await navegador.close();
  servidor.close();
}

const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallas.length === 0 ? 0 : 1);

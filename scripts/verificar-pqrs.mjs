/**
 * Verificación del formulario de PQRS con un navegador de verdad y archivos de
 * verdad, sobre el sitio YA COMPILADO en dist/.
 *
 * Se comprueban cuatro cosas distintas:
 *
 * A) LA ELECCIÓN EN DOS PASOS (categoría y tipo), que es lo que decide todo lo
 *    demás. Las dos son tarjetas, no un `<select>`, así que se eligen POR CLIC:
 *   0. Cada uno de los cinco tipos se puede elegir con un clic, queda marcado,
 *      y el formulario aparece sin recargar y con el foco en el primer campo.
 *
 * B) EL CAMPO DE SOPORTE, que no toca la red:
 *   1. En la categoría comercial existe para LOS CINCO TIPOS, siempre opcional.
 *      Lo que lo hace desaparecer es cambiar de categoría, no de tipo.
 *   2. Al cambiar de tipo se conserva lo ya seleccionado: no hay motivo para
 *      obligar a volver a elegir los archivos.
 *   3. Un archivo válido de cada formato se acepta y se lista con su tamaño.
 *   4. Se rechazan el formato no permitido, la doble extensión, el contenido
 *      que no corresponde a la extensión y el exceso de peso.
 *   5. No se pueden adjuntar más de 3 archivos.
 *
 * C) LA CATEGORÍA ADMINISTRATIVA, que no radica: enseña el bloque de contacto y
 *    esconde el paso 2 y el formulario entero. Se prueba aparte, en G).
 *
 * D) LA RADICACIÓN de la categoría comercial, interceptando las llamadas con
 *    `page.route()`:
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
 * LA SUBIDA AL BLOB TAMBIÉN SE PUEDE SIMULAR ENTERA (`plan.token: 'ok'`), y no
 * solo rechazar. Hacen falta dos dobles, porque `@vercel/blob` da dos pasos:
 * primero le pide el permiso a nuestro endpoint y después sube el archivo a
 * `https://vercel.com/api/blob`. Con los dos puestos se puede comprobar lo que
 * de otro modo quedaba sin probar: que una queja comercial CON adjunto llega
 * hasta el final y devuelve su radicado.
 *
 * Uso:
 *   npm run build
 *   node scripts/verificar-pqrs.mjs
 *
 * Sin dependencias nuevas: Playwright ya está en devDependencies. Los archivos
 * de prueba se generan en el directorio temporal del sistema, no en el
 * repositorio.
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
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { crc32 } from 'node:zlib';
import { chromium } from 'playwright';

// Con el adaptador de Vercel el sitio estatico queda en dist/client.
const RAIZ = join(process.cwd(), 'dist', 'client');
const PUERTO = 4399;

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

/**
 * Doble del almacén de Vercel Blob.
 *
 * `@vercel/blob` sube el archivo a `https://vercel.com/api/blob/{ruta}` con el
 * permiso que firmó nuestro endpoint, y espera de vuelta este JSON. Solo se
 * usan `url` y `pathname`, pero se devuelven todos los campos que declara el
 * SDK para no depender de cuáles lee hoy.
 */
async function responderBlob(ruta, camino) {
  await ruta.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      url: `https://tienda-de-prueba.private.blob.vercel-storage.com/${camino}`,
      downloadUrl: `https://tienda-de-prueba.private.blob.vercel-storage.com/${camino}?download=1`,
      pathname: camino,
      contentType: 'image/png',
      contentDisposition: `inline; filename="${camino.split('/').pop()}"`,
      etag: '"prueba"',
    }),
  });
}

/**
 * Instala los dobles y devuelve el registro de lo que se pidió.
 *
 * `plan.token`:
 *   'error' (por defecto) el permiso se deniega. Sirve para comprobar QUÉ pide
 *           el navegador y que un fallo de subida no radica ni abre el correo.
 *   'ok'    el permiso se concede y la subida se completa. Sirve para
 *           comprobar el camino entero hasta el radicado, con adjunto incluido.
 */
async function instalarDobles(pagina, plan) {
  const registro = { token: [], radicar: [], blob: [], administrativa: [] };

  await pagina.route('https://challenges.cloudflare.com/**', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'text/javascript', body: TURNSTILE_FALSO }),
  );

  await pagina.route('**/api/pqrs/token', async (ruta) => {
    registro.token.push(JSON.parse(ruta.request().postData() ?? '{}'));

    if (plan.token === 'ok') {
      // El SDK saca el identificador del store del token partiéndolo por "_" y
      // quedándose con el cuarto trozo, así que este de mentira le vale.
      await ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'blob.generate-client-token',
          clientToken: 'vercel_blob_client_tiendadeprueba_tokendementira',
        }),
      });
      return;
    }

    // Por defecto se deniega, que es lo que permite comprobar que el navegador
    // PIDE el permiso con los datos correctos sin depender de la subida.
    await ruta.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        codigo: 'antirrobots',
        mensaje: 'Subida rechazada por la prueba.',
      }),
    });
  });

  await pagina.route('https://vercel.com/api/blob/**', async (ruta) => {
    // La ruta del archivo NO viaja en la URL de subida: va dentro del permiso
    // firmado, que aquí es de mentira. Se recupera del `pathname` que el
    // navegador pidió al sacar ese permiso, que es justo lo que el servidor de
    // verdad habría metido dentro del token.
    const camino = registro.token.at(-1)?.payload?.pathname ?? '';
    registro.blob.push(camino);
    await responderBlob(ruta, camino);
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
    // Al servidor le falta el Blob o la clave de Resend.
    if (plan.radicar === 'config') {
      await ruta.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          codigo: 'config-incompleta',
          errores: ['La radicación en línea no está disponible en este momento.'],
        }),
      });
      return;
    }
    // Radica, pero la constancia no sale (remitente de pruebas) y, en
    // 'sin-area', tampoco el correo al área.
    const correos =
      plan.radicar === 'omitida'
        ? { correoArea: true, constancia: 'omitida' }
        : plan.radicar === 'sin-area'
          ? { correoArea: false, constancia: 'omitida' }
          : {};
    await ruta.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        radicado: 'PQRS-20260907-A7K2M9',
        fecha: '7 de septiembre de 2026, 9:15',
        ...correos,
      }),
    });
  });

  /*
   * El recado del bloque administrativo. Se registra DESPUÉS del de
   * '**\/api\/pqrs' a propósito: cuando dos rutas coinciden, Playwright aplica
   * la registrada en último lugar, así que la más específica tiene que ir al
   * final para que no se la coma la genérica.
   */
  await pagina.route('**/api/pqrs/administrativa', async (ruta) => {
    registro.administrativa.push(JSON.parse(ruta.request().postData() ?? '{}'));

    if (plan.administrativa === 'caida') {
      await ruta.abort('connectionrefused');
      return;
    }
    if (plan.administrativa === 'antirrobots') {
      await ruta.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          errores: ['La comprobación antirrobots no pasó. Recarga la página e inténtalo de nuevo.'],
        }),
      });
      return;
    }
    if (plan.administrativa === 'config') {
      await ruta.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          codigo: 'config-incompleta',
          errores: ['El envío en línea no está disponible en este momento.'],
        }),
      });
      return;
    }
    if (plan.administrativa === 'error') {
      await ruta.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, errores: ['El nombre es obligatorio.'] }),
      });
      return;
    }
    await ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Chromium no emite ningún evento observable al abrir un mailto:, así que el
  // formulario marca `data-respaldo="correo"` en su raíz antes de navegar y eso
  // es lo que se comprueba.

  return registro;
}

// --- Elección por clic ------------------------------------------------------

/**
 * Tarjeta de un grupo de opciones.
 *
 * Se localiza por el `value` del radio que lleva dentro, no por su texto: el
 * texto de la tarjeta es de marketing y cambia, mientras que el `value` es lo
 * que viaja en el formulario y lo compara `TIPOS_PQRS` en
 * src/lib/pqrs/categorias.ts.
 */
const tarjeta = (pagina, grupo, valor) =>
  pagina.locator(`label:has(input[name="${grupo}-opcion"][value="${valor}"])`);

/**
 * ¿El sitio compilado lleva clave de Turnstile?
 *
 * `PUBLIC_TURNSTILE_SITE_KEY` se lee EN TIEMPO DE BUILD, así que un `npm run
 * build` sin `.env` produce un sitio sin antirrobots. Eso no es un fallo del
 * formulario y no debe contarse como tal, pero tampoco se puede dar por bueno
 * cualquier valor: se comprueba el comportamiento que corresponde a cada caso.
 */
const hayTurnstile = async (pagina) =>
  ((await pagina.locator('[data-pqrs]').getAttribute('data-turnstile-key')) ?? '') !== '';

/**
 * Con clave, el token tiene que ser el del widget (aquí, el del doble). Sin
 * clave tiene que ir VACÍO, que es lo que hace que el error salga del servidor
 * con un mensaje entendible en vez de reventar en el navegador.
 */
const esperadoTurnstile = (valor, conClave) =>
  conClave ? String(valor ?? '').startsWith('token-de-prueba-') : String(valor ?? '') === '';

/**
 * Elige categoría y tipo con dos clics, como lo haría una persona.
 *
 * El tipo es opcional porque en la administrativa NO HAY paso 2: esa categoría
 * enseña el bloque de contacto y esconde el formulario entero.
 */
async function elegir(pagina, categoria, tipo = '') {
  await tarjeta(pagina, 'categoria', categoria).click();
  await pagina.waitForTimeout(250);
  if (!tipo) return;
  await tarjeta(pagina, 'tipo', tipo).click();
  await pagina.waitForTimeout(350);
}

/**
 * Elige un municipio como lo haria una persona: escribe unas letras y pulsa la
 * opcion de la lista. No usa `fill`, que dejaria el valor puesto sin pasar por
 * el combobox y no probaria nada de lo que hay que probar.
 */
async function elegirMunicipio(pagina, escrito, aElegir = escrito) {
  const campo = pagina.locator('#municipio-pqrs');
  await campo.click();
  await campo.fill('');
  await campo.type(escrito, { delay: 10 });
  await pagina.waitForTimeout(200);
  await pagina.locator(`[data-opciones] li:has-text("${aElegir}")`).first().click();
  await pagina.waitForTimeout(200);
}

/**
 * Rellena el formulario de radicación. Solo sirve a la COMERCIAL: es la única
 * categoría que tiene formulario de PQRS.
 */
async function rellenarFormulario(pagina, tipo = 'Queja') {
  await elegir(pagina, 'comercial', tipo);
  await pagina.fill('#nombre-pqrs', 'Cristian Amaya');
  await pagina.fill('#telefono-pqrs', '3106232429');
  await pagina.fill('#correo-pqrs', 'practicaspasantiasdst@gmail.com');
  await elegirMunicipio(pagina, 'Tunja');
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
  const formulario = pagina.locator('[data-paso-formulario]');

  const elegirTipo = async (nombre) => {
    await tarjeta(pagina, 'tipo', nombre).click();
    await pagina.waitForTimeout(200);
  };

  const adjuntar = async (...rutas) => {
    await entrada.setInputFiles(rutas);
    await pagina.waitForTimeout(400);
  };

  // ---- 0. La elección por clic --------------------------------------------
  comprobar(
    `${etiqueta}: al entrar no se ve ni el paso 2 ni el formulario`,
    !(await pagina.locator('[data-paso-tipo]').isVisible()) && !(await formulario.isVisible()),
  );

  await tarjeta(pagina, 'categoria', 'comercial').click();
  await pagina.waitForTimeout(250);
  comprobar(
    `${etiqueta}: un clic en "Comercial" la marca y descubre el paso 2`,
    (await pagina.locator('input[name="categoria-opcion"][value="comercial"]').isChecked()) &&
      (await pagina.locator('[data-paso-tipo]').isVisible()),
  );
  comprobar(
    `${etiqueta}: el formulario sigue oculto mientras no haya tipo`,
    !(await formulario.isVisible()),
  );

  // Los cinco, uno por uno: es lo que pidió el encargo.
  for (const nombre of ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación']) {
    await elegirTipo(nombre);
    comprobar(
      `${etiqueta}: un clic en "${nombre}" lo marca y deja el valor en el campo enviado`,
      (await pagina.locator(`input[name="tipo-opcion"][value="${nombre}"]`).isChecked()) &&
        (await pagina.locator('#tipo-pqrs').inputValue()) === nombre,
    );
  }

  comprobar(
    `${etiqueta}: al elegir tipo aparece el formulario, sin recargar`,
    await formulario.isVisible(),
  );
  comprobar(
    `${etiqueta}: el marcador "elige arriba" desaparece al elegir`,
    !(await pagina.locator('[data-sin-elegir]').isVisible()),
  );
  comprobar(
    `${etiqueta}: el foco queda en el primer campo del formulario`,
    (await pagina.evaluate(() => document.activeElement?.id)) === 'nombre-pqrs',
  );
  const resumen = (await pagina.locator('[data-resumen-titulo]').textContent()) ?? '';
  comprobar(
    `${etiqueta}: el resumen recuerda la categoría y el tipo elegidos`,
    resumen.includes('Comercial') && resumen.includes('Felicitación'),
    resumen.trim(),
  );

  // ---- 1. En los CINCO tipos de la comercial -------------------------------
  // Antes el campo solo salía con Queja y Reclamo; con los otros tres estaba
  // oculto y el input deshabilitado. Estas comprobaciones decían eso y ahora
  // dicen lo contrario, que es el encargo: el soporte lo decide la categoría.
  for (const tipo of ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación']) {
    await elegirTipo(tipo);
    comprobar(
      `${etiqueta}: con "${tipo}" el campo de soporte aparece y queda habilitado`,
      (await bloque.isVisible()) && !(await entrada.isDisabled()),
    );
  }

  // Opcional quiere decir opcional: ni el bloque ni el input lo marcan como
  // obligatorio, así que se puede radicar sin adjuntar nada.
  comprobar(
    `${etiqueta}: la etiqueta dice "Soportes o evidencias (opcional)"`,
    ((await pagina.locator('[data-adjuntos] label').first().innerText()) ?? '')
      .replace(/\s+/g, ' ')
      .trim() === 'Soportes o evidencias (opcional)',
    ((await pagina.locator('[data-adjuntos] label').first().innerText()) ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  comprobar(
    `${etiqueta}: el input de soporte no es obligatorio`,
    !(await entrada.evaluate((e) => e.required)),
  );

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

  // ---- 2. Cambio de tipo: lo adjuntado se conserva -------------------------
  // Con la regla vieja, pasar a "Petición" escondía el campo y tiraba los
  // archivos. Ahora los cinco llevan soporte, así que cambiar de idea sobre el
  // tipo no puede costarle a nadie volver a buscar sus tres archivos.
  const antesDelCambio = await lista.locator('li').count();
  await elegirTipo('Petición');
  comprobar(
    `${etiqueta}: al pasar a "Petición" el campo sigue visible y conserva los archivos`,
    (await bloque.isVisible()) &&
      !(await entrada.isDisabled()) &&
      (await lista.locator('li').count()) === antesDelCambio &&
      (await entrada.evaluate((e) => e.files.length)) === antesDelCambio,
    `${antesDelCambio} archivos`,
  );

  await elegirTipo('Queja');
  comprobar(
    `${etiqueta}: al volver a "Queja" siguen estando`,
    (await bloque.isVisible()) && (await lista.locator('li').count()) === antesDelCambio,
  );

  // Se vacía a mano para que lo que sigue arranque de cero.
  for (let i = antesDelCambio; i > 0; i -= 1) {
    await lista.locator('[data-quitar]').first().click();
    await pagina.waitForTimeout(120);
  }
  comprobar(
    `${etiqueta}: quitándolos uno a uno la lista queda vacía`,
    (await lista.locator('li').count()) === 0,
  );

  // ---- C) Al pasar a "Administrativa" desaparece el formulario entero -------
  // Antes las dos categorías compartían formulario y aquí solo se comprobaba
  // que el campo de adjuntos se escondía. Hoy la administrativa ni siquiera
  // tiene formulario, así que lo que hay que comprobar es más fuerte: que se
  // va la sección completa y que lo adjuntado se descarta con ella.
  await adjuntar(archivos.pngValido);
  comprobar(
    `${etiqueta}: con "Comercial + Queja" el adjunto se aceptó (punto de partida)`,
    (await lista.locator('li').count()) === 1,
  );

  await tarjeta(pagina, 'categoria', 'administrativa').click();
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: al pasar a "Administrativa" se va la sección del formulario`,
    !(await pagina.locator('[data-seccion-formulario]').isVisible()) &&
      !(await bloque.isVisible()) &&
      (await entrada.isDisabled()),
  );
  comprobar(
    `${etiqueta}: y el archivo que ya estaba puesto se descarta`,
    (await entrada.evaluate((e) => e.files.length)) === 0 &&
      (await lista.locator('li').count()) === 0,
  );

  await tarjeta(pagina, 'categoria', 'comercial').click();
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: al volver a "Comercial" reaparecen la sección y el campo, vacío`,
    (await pagina.locator('[data-seccion-formulario]').isVisible()) &&
      (await bloque.isVisible()) &&
      !(await entrada.isDisabled()) &&
      (await lista.locator('li').count()) === 0,
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

    // El enlace de WhatsApp se arma con lo escrito, antes de enviar nada.
    const whatsapp = decodeURIComponent(
      (await pagina.locator('[data-whatsapp]').getAttribute('href')) ?? '',
    );
    comprobar(
      'El botón de WhatsApp lleva categoría, tipo, municipio y nombre',
      whatsapp.includes('Categoría: Comercial') &&
        whatsapp.includes('Tipo: Petición') &&
        whatsapp.includes('Municipio: Tunja') &&
        whatsapp.includes('Nombre: Cristian Amaya'),
      (whatsapp.split('?text=')[1] ?? whatsapp).replace(/\s+/g, ' ').slice(0, 110),
    );
    // Solo el TEXTO del mensaje: el número de la empresa vive en la URL
    // (wa.me/573106232429) y contiene los mismos dígitos que un teléfono.
    const mensajeWhatsapp = whatsapp.split('?text=')[1] ?? '';
    comprobar(
      'El mensaje de WhatsApp NO arrastra documento, teléfono ni correo',
      !mensajeWhatsapp.includes('1234567890') &&
        !mensajeWhatsapp.includes('3106232429') &&
        !mensajeWhatsapp.includes('practicaspasantiasdst@gmail.com'),
      mensajeWhatsapp.replace(/\s+/g, ' ').slice(0, 110),
    );

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
    const conTurnstile = await hayTurnstile(pagina);
    comprobar(
      'Sin adjuntos: el municipio viaja en el cuerpo, con su nombre oficial',
      registro.radicar[0]?.municipio === 'Tunja',
      String(registro.radicar[0]?.municipio ?? '(no llegó)'),
    );
    comprobar(
      'Sin adjuntos: el cuerpo lleva sessionId con forma de UUID',
      /^[0-9a-f-]{36}$/.test(registro.radicar[0]?.sessionId ?? ''),
    );
    comprobar(
      `Sin adjuntos: el token de Turnstile es ${conTurnstile ? 'el del widget' : 'vacío (build sin clave)'}`,
      esperadoTurnstile(registro.radicar[0]?.turnstileToken, conTurnstile),
      String(registro.radicar[0]?.turnstileToken ?? '(ausente)'),
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
    await pagina.click('[data-confirmacion] [data-copiar]');
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
      'Con adjuntos: el clientPayload lleva sessionId, tipo y el token de Turnstile que toque',
      /^[0-9a-f-]{36}$/.test(carga.sessionId ?? '') &&
        carga.tipo === 'Queja' &&
        esperadoTurnstile(carga.turnstileToken, await hayTurnstile(pagina)),
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

  // ---- 7-bis. Con adjuntos, hasta el final: subida OK y radicado -----------
  {
    const pagina = await contexto.newPage();
    const registro = await instalarDobles(pagina, { radicar: 'ok', token: 'ok' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Queja', 'comercial');
    await pagina.setInputFiles('#soporte-pqrs', [archivos.pngValido]);
    await pagina.waitForTimeout(500);
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(2000);

    comprobar(
      'Comercial con adjunto: el archivo se subió al almacén',
      registro.blob.length === 1 && registro.blob[0].startsWith('pqrs/pendientes/'),
      registro.blob[0] ?? '(ninguna subida)',
    );

    const cuerpo = registro.radicar[0] ?? {};
    comprobar(
      'Comercial con adjunto: se radica anunciando el soporte ya subido',
      Array.isArray(cuerpo.adjuntos) &&
        cuerpo.adjuntos.length === 1 &&
        String(cuerpo.adjuntos[0]?.pathname ?? '').startsWith(`pqrs/pendientes/${cuerpo.sessionId}/`) &&
        cuerpo.adjuntos[0]?.nombreOriginal === 'foto-del-producto.png',
      JSON.stringify(cuerpo.adjuntos ?? []).slice(0, 140),
    );
    comprobar(
      'Comercial con adjunto: el tipo y la categoría viajan en la radicación',
      cuerpo.tipo === 'Queja' && cuerpo['categoria'] === undefined,
      `tipo=${cuerpo.tipo}`,
    );
    comprobar(
      'Comercial con adjunto: sale la pantalla con el radicado',
      (await pagina.locator('[data-confirmacion]').isVisible()) &&
        (await pagina.locator('[data-radicado]').textContent()) === 'PQRS-20260907-A7K2M9',
    );
    const progreso = (await pagina.locator('[data-progreso]').textContent()) ?? '';
    comprobar(
      'Comercial con adjunto: la barra de progreso llegó a "Subido"',
      /Subido/.test(progreso),
      progreso.replace(/\s+/g, ' ').trim().slice(0, 80) || '(vacía)',
    );
    comprobar(
      'Comercial con adjunto: no se abrió el gestor de correo',
      !(await pagina.locator('[data-pqrs][data-respaldo]').count()) &&
        !(await pagina.locator('[data-pqrs][data-enviado]').count()),
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

  // ---- 9-bis. Mínimo de la descripción, visible y con contador --------------
  {
    const pagina = await contexto.newPage();
    const registro = await instalarDobles(pagina, { radicar: 'ok' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await elegir(pagina, 'comercial', 'Petición');
    const contador = pagina.locator('#descripcion-pqrs-ayuda');
    const campo = pagina.locator('#descripcion-pqrs');
    comprobar(
      'Descripción: antes de escribir dice «Mínimo 10 caracteres.» y está enlazado al campo',
      (await contador.isVisible()) &&
        ((await contador.textContent()) ?? '').trim() === 'Mínimo 10 caracteres.' &&
        (await campo.getAttribute('aria-describedby')) === 'descripcion-pqrs-ayuda',
      ((await contador.textContent()) ?? '').trim(),
    );

    await rellenarFormulario(pagina, 'Petición');
    await campo.fill('');
    await campo.type('Hola', { delay: 5 });
    comprobar(
      'Descripción: al escribir poco dice cuántos faltan',
      ((await contador.textContent()) ?? '').trim() === 'Faltan 6 caracteres (mínimo 10).',
      ((await contador.textContent()) ?? '').trim(),
    );

    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(600);
    const mensajeValidez = await campo.evaluate((e) => e.validationMessage);
    comprobar(
      'Descripción corta: el envío se frena en el navegador con cuánto falta, sin llamar a la API',
      registro.radicar.length === 0 && /al menos 10 caracteres/.test(mensajeValidez),
      mensajeValidez,
    );

    // Los saltos de línea no cuentan, como en el servidor.
    await campo.fill('12345\n6789');
    await campo.dispatchEvent('input');
    comprobar(
      'Descripción: los saltos de línea no cuentan, igual que en el servidor',
      ((await contador.textContent()) ?? '').trim() === 'Falta 1 carácter (mínimo 10).',
      ((await contador.textContent()) ?? '').trim(),
    );

    await campo.fill('Prueba automática del contador de caracteres.');
    await campo.dispatchEvent('input');
    comprobar(
      'Descripción: al llegar al mínimo cuenta sobre el máximo y el campo es válido',
      /^\d+ de 5000 caracteres\.$/.test(((await contador.textContent()) ?? '').trim()) &&
        (await campo.evaluate((e) => e.checkValidity())) &&
        (await campo.getAttribute('maxlength')) === '5000',
      ((await contador.textContent()) ?? '').trim(),
    );

    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(900);
    comprobar(
      'Descripción válida: ahora sí se radica',
      registro.radicar.length === 1,
      String(registro.radicar.length),
    );
    await pagina.close();
  }

  // ---- 10. Servidor sin Blob o sin Resend: avisa y ofrece el correo ---------
  {
    const pagina = await contexto.newPage();
    const registro = await instalarDobles(pagina, { radicar: 'config' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Petición');
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(1200);

    const aviso = (await pagina.locator('[data-form] [data-aviso]').textContent()) ?? '';
    comprobar(
      'Config incompleta: se avisa de que la radicación en línea no está disponible',
      /no está disponible en este momento/i.test(aviso) && /NO queda radicada/i.test(aviso),
      aviso.trim().slice(0, 120),
    );
    comprobar(
      'Config incompleta: se ofrece el correo y no hay confirmación falsa',
      (await pagina.locator('[data-pqrs][data-respaldo="correo"][data-configuracion="incompleta"]').count()) === 1 &&
        !(await pagina.locator('[data-confirmacion]').isVisible()) &&
        registro.radicar.length === 1,
    );
    await pagina.close();
  }

  // ---- 11. Radicada sin constancia por correo (remitente de pruebas) --------
  {
    const pagina = await contexto.newPage();
    await instalarDobles(pagina, { radicar: 'omitida' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Petición');
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(900);

    const textoConfirmacion = ((await pagina.locator('[data-confirmacion]').textContent()) ?? '').replace(/\s+/g, ' ');
    comprobar(
      'Sin constancia: la confirmación NO dice que se lo enviamos por correo',
      (await pagina.locator('[data-confirmacion]').isVisible()) &&
        !(await pagina.locator('[data-constancia-enviada]').isVisible()),
    );
    const avisosEnvio = pagina.locator('[data-avisos-envio]');
    comprobar(
      'Sin constancia: pide copiar o anotar el número, sin jerga técnica',
      (await avisosEnvio.isVisible()) &&
        /cópialo o anótalo/i.test((await avisosEnvio.textContent()) ?? '') &&
        !/resend|api_key|falta /i.test(textoConfirmacion),
      ((await avisosEnvio.textContent()) ?? '').trim(),
    );
    await pagina.close();
  }

  // ---- 12. Radicada, pero el correo al área no salió -------------------------
  {
    const pagina = await contexto.newPage();
    await instalarDobles(pagina, { radicar: 'sin-area' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Petición');
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(900);

    const avisosEnvio = ((await pagina.locator('[data-avisos-envio]').textContent()) ?? '').trim();
    comprobar(
      'Sin correo al área: la radicación se confirma y se sugiere WhatsApp con el número',
      (await pagina.locator('[data-radicado]').textContent()) === 'PQRS-20260907-A7K2M9' &&
        /no pudimos avisar al equipo/i.test(avisosEnvio) &&
        /WhatsApp/.test(avisosEnvio),
      avisosEnvio.slice(0, 120),
    );
    await pagina.close();
  }

  // ---- 13. Camino feliz de siempre: la confirmación sí menciona el correo --
  {
    const pagina = await contexto.newPage();
    await instalarDobles(pagina, { radicar: 'ok' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    await rellenarFormulario(pagina, 'Petición');
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(900);
    comprobar(
      'Con constancia enviada: dice que también se envió por correo y no hay avisos',
      (await pagina.locator('[data-constancia-enviada]').isVisible()) &&
        !(await pagina.locator('[data-avisos-envio]').isVisible()),
    );
    await pagina.close();
  }

  await contexto.close();
}

// --- E) El campo de municipio -----------------------------------------------

async function revisarMunicipio(navegador, etiqueta, viewport) {
  console.log(`\n=== E) Municipio · ${etiqueta} (${viewport.width}px) ===\n`);
  const contexto = await navegador.newContext({ viewport });
  const pagina = await contexto.newPage();
  await instalarDobles(pagina, { radicar: 'ok' });

  await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(400);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

  const campo = pagina.locator('#municipio-pqrs');
  const opciones = pagina.locator('[data-opciones]');
  const error = pagina.locator('[data-municipio] [data-error]');

  // ---- Aparece con el formulario, en todas las combinaciones --------------
  comprobar(
    `${etiqueta}: sin elegir nada, el municipio no se ve`,
    !(await campo.isVisible()),
  );

  // Solo comercial: la administrativa no tiene paso 2 ni formulario, así que
  // tampoco tiene campo de municipio que comprobar.
  const combinaciones = [
    ['comercial', 'Petición'],
    ['comercial', 'Queja'],
    ['comercial', 'Sugerencia'],
    ['comercial', 'Reclamo'],
  ];
  for (const [categoria, tipo] of combinaciones) {
    await elegir(pagina, categoria, tipo);
    comprobar(
      `${etiqueta}: con "${categoria} + ${tipo}" el municipio aparece y es obligatorio`,
      (await campo.isVisible()) && (await campo.evaluate((e) => e.required)),
    );
  }

  // ---- Al enfocarlo se ven los 87, sin escribir nada ----------------------
  await campo.click();
  await pagina.waitForTimeout(250);
  const total = await opciones.locator('li').count();
  comprobar(
    `${etiqueta}: al enfocarlo se despliegan los 87 municipios`,
    total === 87,
    `${total} opciones`,
  );
  comprobar(
    `${etiqueta}: el combobox se anuncia como desplegado`,
    (await campo.getAttribute('aria-expanded')) === 'true' &&
      (await campo.getAttribute('role')) === 'combobox',
  );

  // ---- Filtrado ignorando tildes y mayúsculas -----------------------------
  const filtrar = async (texto) => {
    await campo.fill('');
    await campo.type(texto, { delay: 10 });
    await pagina.waitForTimeout(250);
    return (await opciones.innerText()).replace(/\s+/g, ' ').trim();
  };

  const sinTilde = await filtrar('chiquinquira');
  comprobar(
    `${etiqueta}: "chiquinquira" sin tilde encuentra "Chiquinquirá"`,
    sinTilde.includes('Chiquinquirá'),
    sinTilde.slice(0, 60),
  );

  const mayusculas = await filtrar('VILLA DE LEYVA');
  comprobar(
    `${etiqueta}: "VILLA DE LEYVA" en mayúsculas encuentra "Villa de Leyva"`,
    mayusculas.includes('Villa de Leyva'),
    mayusculas.slice(0, 60),
  );

  const conTilde = await filtrar('sáchica');
  comprobar(
    `${etiqueta}: escribir CON tilde también encuentra "Sáchica"`,
    conTilde.includes('Sáchica'),
    conTilde.slice(0, 60),
  );

  const empiezan = await filtrar('sa');
  comprobar(
    `${etiqueta}: los que EMPIEZAN por lo escrito salen antes que los que solo lo contienen`,
    empiezan.indexOf('Samacá') < empiezan.indexOf('Villa de Leyva') ||
      !empiezan.includes('Villa de Leyva'),
    empiezan.slice(0, 80),
  );

  // ---- Teclado ------------------------------------------------------------
  await campo.fill('');
  await campo.type('tun', { delay: 10 });
  await pagina.waitForTimeout(250);
  await campo.press('ArrowDown');
  await pagina.waitForTimeout(120);
  const activo = await campo.getAttribute('aria-activedescendant');
  comprobar(
    `${etiqueta}: la flecha abajo resalta una opción y lo anuncia con aria-activedescendant`,
    Boolean(activo) &&
      (await pagina.locator(`#${activo}`).getAttribute('aria-selected')) === 'true',
    activo ?? '(ninguno)',
  );

  await campo.press('Enter');
  await pagina.waitForTimeout(200);
  comprobar(
    `${etiqueta}: Enter elige la opción resaltada y cierra la lista`,
    (await campo.inputValue()) === 'Tunja' &&
      !(await opciones.isVisible()) &&
      (await campo.getAttribute('aria-expanded')) === 'false',
    await campo.inputValue(),
  );

  await campo.click();
  await pagina.waitForTimeout(200);
  await campo.press('Escape');
  await pagina.waitForTimeout(150);
  comprobar(`${etiqueta}: Escape cierra la lista`, !(await opciones.isVisible()));

  // ---- Solo valores de la lista -------------------------------------------
  await campo.fill('');
  await campo.type('Medellín', { delay: 10 });
  await pagina.waitForTimeout(250);
  comprobar(
    `${etiqueta}: un municipio fuera de cobertura avisa "Selecciona un municipio de la lista"`,
    /Selecciona un municipio de la lista/i.test((await error.textContent()) ?? '') &&
      (await campo.getAttribute('aria-invalid')) === 'true',
    ((await error.textContent()) ?? '').trim(),
  );
  comprobar(
    `${etiqueta}: y el navegador lo da por inválido, así que no deja enviar`,
    !(await campo.evaluate((e) => e.checkValidity())),
  );

  // ---- Se resuelve al nombre oficial --------------------------------------
  await campo.fill('');
  await campo.type('  villa de leyva ', { delay: 5 });
  await pagina.locator('#nombre-pqrs').click();
  await pagina.waitForTimeout(350);
  comprobar(
    `${etiqueta}: lo escrito a la ligera se corrige al nombre oficial al salir del campo`,
    (await campo.inputValue()) === 'Villa de Leyva' &&
      (await campo.evaluate((e) => e.checkValidity())),
    await campo.inputValue(),
  );

  // ---- Sobrevive al cambio de categoría y de tipo -------------------------
  // El rodeo por la administrativa no es adorno: esa categoría esconde la
  // sección del formulario entera, así que es el caso que de verdad podría
  // llevarse por delante lo ya escrito.
  await elegir(pagina, 'administrativa');
  await elegir(pagina, 'comercial', 'Felicitación');
  comprobar(
    `${etiqueta}: el municipio elegido sobrevive a cambiar de categoría y de tipo`,
    (await campo.inputValue()) === 'Villa de Leyva',
    await campo.inputValue(),
  );

  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(400);
  await elegir(pagina, 'comercial', 'Queja');
  comprobar(
    `${etiqueta}: y también a recargar la página (sessionStorage)`,
    (await pagina.locator('#municipio-pqrs').inputValue()) === 'Villa de Leyva',
    await pagina.locator('#municipio-pqrs').inputValue(),
  );

  await contexto.close();
}

// --- F) La ubicación, que nunca puede bloquear ------------------------------

async function revisarUbicacion(navegador) {
  console.log('\n=== F) Geolocalización ===\n');

  // ---- Con permiso: preselecciona el más cercano --------------------------
  {
    // Coordenadas de la plaza de Samacá. El municipio más cercano tiene que
    // ser Samacá y no Tunja, que está a unos 20 km.
    const contexto = await navegador.newContext({
      viewport: { width: 1280, height: 900 },
      permissions: ['geolocation'],
      geolocation: { latitude: 5.4918, longitude: -73.4853 },
    });
    const pagina = await contexto.newPage();
    await instalarDobles(pagina, { radicar: 'ok' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

    // Se limpia lo que hubiera guardado otra prueba: aquí se comprueba
    // justamente el caso en que el campo llega vacío.
    await pagina.evaluate(() => sessionStorage.clear());
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);

    const campo = pagina.locator('#municipio-pqrs');
    await elegir(pagina, 'comercial', 'Queja');
    await pagina.waitForTimeout(1200);

    comprobar(
      'Ubicación concedida: preselecciona el municipio más cercano',
      (await campo.inputValue()) === 'Samacá',
      await campo.inputValue(),
    );
    comprobar(
      'Ubicación concedida: el campo queda válido, sin aviso de error',
      (await campo.evaluate((e) => e.checkValidity())) &&
        !(await pagina.locator('[data-municipio] [data-error]').isVisible()),
    );
    await pagina.close();
    await contexto.close();
  }

  // ---- Sin permiso: silencio y a mano -------------------------------------
  {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    // Sin `grantPermissions`, Chromium deniega y `getCurrentPosition` falla.
    const pagina = await contexto.newPage();
    await instalarDobles(pagina, { radicar: 'ok' });
    await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);
    const rechazar = pagina.locator('[data-rechazar-cookies]');
    if (await rechazar.isVisible().catch(() => false)) await rechazar.click();
    await pagina.evaluate(() => sessionStorage.clear());
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(400);

    const campo = pagina.locator('#municipio-pqrs');
    await elegir(pagina, 'comercial', 'Queja');
    await pagina.waitForTimeout(1200);

    comprobar(
      'Ubicación denegada: el campo se queda vacío, sin ningún error',
      (await campo.inputValue()) === '' &&
        !(await pagina.locator('[data-municipio] [data-error]').isVisible()),
      await campo.inputValue(),
    );
    comprobar(
      'Ubicación denegada: el formulario sigue usable y no se quedó esperando',
      (await pagina.locator('[data-paso-formulario]').isVisible()) &&
        !(await pagina.locator('[data-enviar]').isDisabled()),
    );

    // Y a mano se puede radicar igual.
    const registro = await instalarDobles(pagina, { radicar: 'ok' });
    await pagina.fill('#nombre-pqrs', 'Cristian Amaya');
    await pagina.fill('#telefono-pqrs', '3106232429');
    await pagina.fill('#correo-pqrs', 'practicaspasantiasdst@gmail.com');
    await elegirMunicipio(pagina, 'Toca');
    await pagina.fill('#descripcion-pqrs', 'Prueba automática del formulario de PQRS.');
    await pagina.check('#autorizacion-pqrs');
    await pagina.click('[data-enviar]');
    await pagina.waitForTimeout(900);

    comprobar(
      'Ubicación denegada: se puede elegir a mano y radicar con el municipio dentro',
      registro.radicar[0]?.municipio === 'Toca',
      String(registro.radicar[0]?.municipio ?? '(no llegó)'),
    );
    await pagina.close();
    await contexto.close();
  }
}

// --- G) El bloque administrativo --------------------------------------------

/**
 * Datos de contacto que TIENEN que salir en el bloque, tal cual.
 *
 * Se escriben aquí a propósito, aunque el sitio los saque de `empresa` en
 * src/data/site.ts: si se leyeran de la misma fuente que la página, la prueba
 * diría que "coincide consigo mismo" y pasaría igual con un teléfono
 * equivocado. Son los que pidió la empresa; si algún día cambian, se cambian en
 * src/data/site.ts y también aquí, a la vez y a mano.
 */
const CONTACTO = {
  telefono: '310 623 2429',
  telefonoE164: '+573106232429',
  correo: 'informacioncomercialdst@gmail.com',
  whatsapp: '573106232429',
};

/** ¿El sitio compilado lleva clave de Turnstile en el bloque administrativo? */
const hayTurnstileAdmin = async (pagina) =>
  ((await pagina.locator('[data-contacto-admin-caja]').getAttribute('data-turnstile-key')) ?? '') !==
  '';

async function abrirAdministrativa(contexto, plan = { administrativa: 'ok' }) {
  const pagina = await contexto.newPage();
  const registro = await instalarDobles(pagina, plan);
  await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(400);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();
  return { pagina, registro };
}

async function revisarAdministrativa(navegador) {
  console.log('\n=== G) La categoría administrativa ===\n');
  const contexto = await navegador.newContext({
    viewport: { width: 1280, height: 900 },
    // El botón de copiar usa navigator.clipboard, que sin permiso lanza.
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  // ---- 1. Qué aparece y qué desaparece al elegirla ------------------------
  {
    const { pagina } = await abrirAdministrativa(contexto);
    const bloque = pagina.locator('[data-contacto-admin]');

    comprobar(
      'Administrativa: sin elegir nada, el bloque de contacto no se ve',
      !(await bloque.isVisible()),
    );

    await elegir(pagina, 'administrativa');

    comprobar('Administrativa: al elegirla aparece el bloque de contacto', await bloque.isVisible());

    /*
     * Esto es lo que se reportó como roto: en escritorio el bloque revelado
     * caía por debajo del pliegue y no se desplazaba, así que al pulsar la
     * tarjeta "no pasaba nada". Se comprueba que ahora queda a la vista.
     */
    const asoma = await bloque.evaluate((e) => {
      const caja = e.getBoundingClientRect();
      return caja.top >= 0 && caja.top <= window.innerHeight - 120;
    });
    comprobar('Administrativa: el bloque queda dentro de la pantalla, no bajo el pliegue', asoma);

    comprobar(
      'Administrativa: NO aparece el paso 2 ni el formulario de PQRS',
      !(await pagina.locator('[data-paso-tipo]').isVisible()) &&
        !(await pagina.locator('[data-seccion-formulario]').isVisible()) &&
        !(await pagina.locator('[data-paso-formulario]').isVisible()),
    );

    /*
     * El formulario de PQRS sigue en el árbol (esconderlo es lo que permite
     * volver a la comercial sin recargar), pero tiene que estar fuera de
     * alcance: ni se ve, ni se tabula, ni lo lee un lector de pantalla. Eso lo
     * da `display:none`, y es lo que se comprueba de verdad.
     */
    const alcanzable = await pagina
      .locator('#nombre-pqrs')
      .evaluate((e) => e.offsetParent !== null || e.getClientRects().length > 0);
    comprobar(
      'Administrativa: los campos de la PQRS quedan fuera de alcance (ni foco ni lector)',
      !alcanzable,
    );

    // ---- 2. Los datos exactos --------------------------------------------
    const textoBloque = (await bloque.textContent()) ?? '';
    comprobar(
      'Administrativa: el título y el texto son los pedidos',
      /Información Administrativa/.test(textoBloque) &&
        /Si tu queja es de tipo administrativa/.test(textoBloque) &&
        /También puedes dejarnos tus datos/.test(textoBloque),
    );
    comprobar(
      `Administrativa: se muestra el teléfono ${CONTACTO.telefono}`,
      textoBloque.includes(CONTACTO.telefono),
    );
    comprobar(
      `Administrativa: se muestra el correo ${CONTACTO.correo}`,
      textoBloque.includes(CONTACTO.correo),
    );

    // ---- 3. Los enlaces ---------------------------------------------------
    const hrefTel = await bloque.locator('a[href^="tel:"]').first().getAttribute('href');
    comprobar(
      `Administrativa: el teléfono enlaza a tel:${CONTACTO.telefonoE164}`,
      hrefTel === `tel:${CONTACTO.telefonoE164}`,
      String(hrefTel),
    );

    const hrefCorreo = await bloque.locator('a[href^="mailto:"]').first().getAttribute('href');
    comprobar(
      'Administrativa: el correo enlaza a mailto: con el asunto "Solicitud administrativa"',
      String(hrefCorreo).startsWith(`mailto:${CONTACTO.correo}?subject=`) &&
        decodeURIComponent(String(hrefCorreo)).includes('subject=Solicitud administrativa'),
      String(hrefCorreo),
    );

    const hrefWa = await bloque.locator('a[href*="wa.me"]').first().getAttribute('href');
    comprobar(
      'Administrativa: WhatsApp va a wa.me con el mensaje prellenado',
      String(hrefWa).startsWith(`https://wa.me/${CONTACTO.whatsapp}?text=`) &&
        decodeURIComponent(String(hrefWa)).includes('Hola, tengo una solicitud administrativa'),
      String(hrefWa),
    );

    // ---- 4. Los botones de copiar ----------------------------------------
    const botones = bloque.locator('[data-copiar-dato]');
    comprobar(
      'Administrativa: hay un botón de copiar junto a cada dato',
      (await botones.count()) === 2,
      String(await botones.count()),
    );

    await botones.first().click();
    await pagina.waitForTimeout(200);
    const copiado = await pagina.evaluate(() => navigator.clipboard.readText());
    comprobar(
      'Administrativa: copiar el teléfono deja el número en el portapapeles',
      copiado === CONTACTO.telefono,
      copiado,
    );

    // ---- 5. Al volver a comercial, se deshace -----------------------------
    await elegir(pagina, 'comercial');
    comprobar(
      'Comercial: el bloque administrativo desaparece y vuelve el paso 2',
      !(await bloque.isVisible()) &&
        (await pagina.locator('[data-paso-tipo]').isVisible()) &&
        (await pagina.locator('[data-seccion-formulario]').isVisible()),
    );

    await pagina.close();
  }

  // ---- 6. El formulario corto: envío válido -------------------------------
  {
    const { pagina, registro } = await abrirAdministrativa(contexto);
    await elegir(pagina, 'administrativa');

    await pagina.fill('#nombre-admin', 'Cristian Amaya');
    await pagina.fill('#telefono-admin', '3106232429');
    await pagina.fill('#correo-admin', 'practicaspasantiasdst@gmail.com');
    await pagina.fill('#mensaje-admin', 'Necesito una copia de la factura del mes pasado.');
    await pagina.click('[data-enviar-admin]');
    await pagina.waitForTimeout(900);

    comprobar(
      'Administrativa: el formulario corto llama a /api/pqrs/administrativa una sola vez',
      registro.administrativa.length === 1,
      String(registro.administrativa.length),
    );

    const enviado = registro.administrativa[0] ?? {};
    comprobar(
      'Administrativa: viajan los cuatro campos tal como se escribieron',
      enviado.nombre === 'Cristian Amaya' &&
        enviado.telefono === '3106232429' &&
        enviado.correo === 'practicaspasantiasdst@gmail.com' &&
        enviado.mensaje === 'Necesito una copia de la factura del mes pasado.',
      JSON.stringify(enviado),
    );

    comprobar(
      'Administrativa: el envío lleva el token del antirrobots cuando el sitio tiene clave',
      esperadoTurnstile(enviado.turnstileToken, await hayTurnstileAdmin(pagina)),
      String(enviado.turnstileToken),
    );

    comprobar(
      'Administrativa: no se radica nada por el camino (ni /api/pqrs ni token de subida)',
      registro.radicar.length === 0 && registro.token.length === 0,
    );

    comprobar(
      'Administrativa: sale la confirmación, el formulario se va y NO se abre el correo',
      (await pagina.locator('[data-confirmacion-admin]').isVisible()) &&
        !(await pagina.locator('[data-form-admin]').isVisible()) &&
        (await pagina.locator('[data-contacto-admin-caja][data-respaldo]').count()) === 0,
    );

    comprobar(
      'Administrativa: la confirmación no promete ningún número de radicado',
      !/radicado/i.test((await pagina.locator('[data-confirmacion-admin]').textContent()) ?? ''),
    );

    await pagina.close();
  }

  // ---- 7. El formulario corto: Turnstile inválido -------------------------
  {
    const { pagina, registro } = await abrirAdministrativa(contexto, {
      administrativa: 'antirrobots',
    });
    await elegir(pagina, 'administrativa');

    await pagina.fill('#nombre-admin', 'Cristian Amaya');
    await pagina.fill('#telefono-admin', '3106232429');
    await pagina.fill('#mensaje-admin', 'Necesito una copia de la factura del mes pasado.');
    await pagina.click('[data-enviar-admin]');
    await pagina.waitForTimeout(900);

    comprobar(
      'Administrativa (antirrobots): se enseña el motivo que dio el servidor',
      (await pagina.locator('[data-errores-admin]').isVisible()) &&
        /antirrobots/i.test(
          (await pagina.locator('[data-lista-errores-admin]').textContent()) ?? '',
        ),
    );

    /*
     * Un 403 NO cae al mailto:. Ahí el servidor sí contestó y dijo qué pasa; el
     * respaldo es solo para cuando no contesta nadie. Si cayera, la persona se
     * iría al gestor de correo creyendo que el formulario falló.
     */
    comprobar(
      'Administrativa (antirrobots): no cae al correo ni da por buena la solicitud',
      (await pagina.locator('[data-contacto-admin-caja][data-respaldo]').count()) === 0 &&
        !(await pagina.locator('[data-confirmacion-admin]').isVisible()) &&
        (await pagina.locator('[data-form-admin]').isVisible()),
    );

    comprobar(
      'Administrativa (antirrobots): el botón vuelve a quedar usable para reintentar',
      !(await pagina.locator('[data-enviar-admin]').isDisabled()),
    );

    comprobar(
      'Administrativa (antirrobots): se intentó una sola vez',
      registro.administrativa.length === 1,
      String(registro.administrativa.length),
    );

    await pagina.close();
  }

  // ---- 8. Sin backend, cae al gestor de correo ---------------------------
  {
    const { pagina } = await abrirAdministrativa(contexto, { administrativa: 'caida' });
    await elegir(pagina, 'administrativa');

    await pagina.fill('#nombre-admin', 'Cristian Amaya');
    await pagina.fill('#telefono-admin', '3106232429');
    await pagina.fill('#mensaje-admin', 'Necesito una copia de la factura del mes pasado.');
    await pagina.click('[data-enviar-admin]');
    await pagina.waitForTimeout(900);

    // Chromium no emite ningún evento al abrir un mailto:, así que el
    // componente marca `data-respaldo="correo"` antes de navegar.
    comprobar(
      'Administrativa: si la función no contesta, se abre el gestor de correo',
      (await pagina.locator('[data-contacto-admin-caja][data-respaldo="correo"]').count()) === 1,
    );

    await pagina.close();
  }

  // ---- 8-bis. «¿Qué necesitas?»: mínimo visible y contador ----------------
  {
    const { pagina, registro } = await abrirAdministrativa(contexto, { administrativa: 'ok' });
    await elegir(pagina, 'administrativa');

    const contador = pagina.locator('#mensaje-admin-ayuda');
    const campo = pagina.locator('#mensaje-admin');
    comprobar(
      '«¿Qué necesitas?»: antes de escribir dice «Mínimo 10 caracteres.»',
      (await contador.isVisible()) &&
        ((await contador.textContent()) ?? '').trim() === 'Mínimo 10 caracteres.' &&
        (await campo.getAttribute('aria-describedby')) === 'mensaje-admin-ayuda' &&
        (await campo.getAttribute('maxlength')) === '1500',
      ((await contador.textContent()) ?? '').trim(),
    );

    await pagina.fill('#nombre-admin', 'Cristian Amaya');
    await pagina.fill('#telefono-admin', '3106232429');
    await campo.type('Factura', { delay: 5 });
    comprobar(
      '«¿Qué necesitas?»: al escribir poco dice cuántos faltan, en su color de aviso',
      ((await contador.textContent()) ?? '').trim() === 'Faltan 3 caracteres (mínimo 10).' &&
        (await contador.getAttribute('data-estado')) === 'corto',
      ((await contador.textContent()) ?? '').trim(),
    );

    await pagina.click('[data-enviar-admin]');
    await pagina.waitForTimeout(600);
    const mensajeValidez = await campo.evaluate((e) => e.validationMessage);
    comprobar(
      '«¿Qué necesitas?» corto: no sale ninguna petición y el navegador dice cuánto falta',
      registro.administrativa.length === 0 && /al menos 10 caracteres/.test(mensajeValidez),
      mensajeValidez,
    );

    await campo.type(' del mes', { delay: 5 });
    comprobar(
      '«¿Qué necesitas?»: al llegar al mínimo pasa a «N de 1500 caracteres.»',
      ((await contador.textContent()) ?? '').trim() === '15 de 1500 caracteres.' &&
        (await contador.getAttribute('data-estado')) === 'ok',
      ((await contador.textContent()) ?? '').trim(),
    );

    await pagina.click('[data-enviar-admin]');
    await pagina.waitForTimeout(900);
    comprobar(
      '«¿Qué necesitas?» válido: ahora sí se envía',
      registro.administrativa.length === 1,
      String(registro.administrativa.length),
    );
    await pagina.close();
  }

  // ---- 9. Servidor sin clave de Resend: avisa y abre el correo ------------
  {
    const { pagina } = await abrirAdministrativa(contexto, { administrativa: 'config' });
    await elegir(pagina, 'administrativa');

    await pagina.fill('#nombre-admin', 'Cristian Amaya');
    await pagina.fill('#telefono-admin', '3106232429');
    await pagina.fill('#mensaje-admin', 'Necesito una copia de la factura del mes pasado.');
    await pagina.click('[data-enviar-admin]');
    await pagina.waitForTimeout(900);

    const errores = ((await pagina.locator('[data-errores-admin]').textContent()) ?? '').replace(/\s+/g, ' ');
    comprobar(
      'Administrativa (config incompleta): avisa de que el envío no está disponible',
      (await pagina.locator('[data-errores-admin]').isVisible()) &&
        /no está disponible en este momento/i.test(errores) &&
        !/resend|api_key/i.test(errores),
      errores.trim().slice(0, 120),
    );
    comprobar(
      'Administrativa (config incompleta): y ofrece el gestor de correo',
      (await pagina.locator('[data-contacto-admin-caja][data-respaldo="correo"][data-configuracion="incompleta"]').count()) === 1,
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
  await revisarMunicipio(navegador, 'Móvil', { width: 375, height: 720 });
  await revisarMunicipio(navegador, 'Escritorio', { width: 1280, height: 800 });
  await revisarUbicacion(navegador);
  await revisarRadicacion(navegador, archivos);
  await revisarAdministrativa(navegador);
} finally {
  await navegador.close();
  servidor.close();
}

const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallas.length === 0 ? 0 : 1);

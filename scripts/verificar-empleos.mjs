/**
 * Verificación del formulario de Empleos con un navegador de verdad y una hoja
 * de vida de verdad, sobre el sitio YA COMPILADO en dist/.
 *
 * Se comprueban tres cosas distintas:
 *
 * A) EL CAMPO DE HOJA DE VIDA, que no toca la red:
 *   1. Existe, es obligatorio, acepta solo .pdf/.doc/.docx y dice el tope
 *      ("PDF, DOC o DOCX, máximo 4 MB.") antes de elegir nada.
 *   2. Un archivo válido de cada formato se acepta y se enseña con su nombre y
 *      su peso.
 *   3. Se rechazan el formato no permitido, el contenido que no corresponde a
 *      la extensión, la doble extensión y el exceso de peso, con un mensaje
 *      claro y sacando el archivo del input.
 *   4. El campo trampa está en el HTML pero no se ve, y la casilla de
 *      tratamiento de datos es obligatoria: sin ella no sale ninguna petición.
 *
 * B) EL ENVÍO, con un doble de POST /api/empleos/postular montado en el MISMO
 *    servidor local que sirve dist/. No se intercepta con `page.route()` a
 *    propósito: Chromium no entrega el contenido de los archivos en el
 *    `postData` de una petición interceptada, y aquí hay que comprobar que
 *    llegan LOS BYTES de la hoja de vida, no solo su nombre.
 *   5. Sale UNA petición multipart con todos los campos, la casilla, el campo
 *      trampa vacío, el token de Turnstile y el archivo con SUS bytes.
 *   6. Mientras se envía el botón queda deshabilitado y dice "Enviando…".
 *   7. Con 200 sale la confirmación ("Recibimos tu postulación, te
 *      contactaremos al correo indicado") y el formulario desaparece.
 *   8. Un 400 o un 403 se muestran tal cual y NO abren el gestor de correo; el
 *      botón vuelve a quedar usable.
 *   9. Si la función no contesta (5xx, HTML del espejo estático o red caída)
 *      se cae al respaldo por correo, con el aviso de adjuntar la hoja de vida
 *      y el botón de WhatsApp a la vista.
 *  10. El cargo llega preseleccionado desde ?cargo= y desde "Postularme".
 *
 * C) OPCIONAL, EL ENVÍO REAL contra una función en marcha:
 *      node scripts/verificar-empleos.mjs --api http://localhost:3000
 *    Manda un multipart de verdad (con un PDF de prueba) a
 *    <url>/api/empleos/postular y enseña la respuesta. Hace falta `vercel dev`
 *    con las variables puestas; con las claves de PRUEBA de Turnstile
 *    (1x…) cualquier token pasa. OJO: si RESEND_API_KEY es real, el correo
 *    LLEGA de verdad a Talento Humano; el nombre del candidato de prueba lo
 *    dice para que no lo confundan con una postulación.
 *
 * El script de Cloudflare Turnstile también se intercepta: se sirve un doble
 * que devuelve un token de mentira. Así la prueba no depende de la red ni de
 * tener claves reales.
 *
 * Uso:
 *   npm run build
 *   npm run verificar:empleos
 *
 * Sin dependencias nuevas: Playwright ya está en devDependencies. Los archivos
 * de prueba se generan en el directorio temporal del sistema, no en el
 * repositorio.
 *
 * Puerto: 4399, el mismo que los demás scripts de verificación (se corren de
 * uno en uno). Ver el comentario de scripts/verificar-pqrs.mjs.
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
 * GitHub Pages). El servidor de aquí se lo quita si viene; si el build se hizo
 * con VERCEL=1 y no lleva prefijo, también sirve.
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

/** Ruta de la función, ya sin el prefijo del espejo. */
const RUTA_FUNCION = '/api/empleos/postular';

/**
 * Estado del doble de la función: qué contestar (`plan`) y qué llegó
 * (`envios`). Lo fija `instalarDobles` antes de cada página; las páginas se
 * abren de una en una, así que un solo estado compartido basta.
 */
const funcion = { plan: {}, envios: [] };

function leerCuerpo(peticion) {
  return new Promise((listo, fallo) => {
    const trozos = [];
    peticion.on('data', (trozo) => trozos.push(trozo));
    peticion.on('end', () => listo(Buffer.concat(trozos)));
    peticion.on('error', fallo);
  });
}

/**
 * El doble de POST /api/empleos/postular.
 *
 * `funcion.plan.respuesta`:
 *   'ok' (por defecto)  200 { ok: true }
 *   'error'             400 con un mensaje de campo
 *   'antirrobots'       403
 *   'servidor'          500
 *   'html'              404 en HTML, que es lo que devuelve el espejo estático
 *   'caida'             se corta la conexión sin contestar
 * `funcion.plan.demora`: milisegundos antes de contestar, para ver "Enviando…".
 */
async function atenderFuncion(peticion, respuesta) {
  const cuerpo = await leerCuerpo(peticion);
  const tipo = peticion.headers['content-type'] ?? '';
  funcion.envios.push({ metodo: peticion.method, tipo, partes: leerMultipart(cuerpo, tipo) });

  const plan = funcion.plan;
  if (plan.demora) await new Promise((r) => setTimeout(r, plan.demora));

  const json = (estado, datos) => {
    respuesta.writeHead(estado, { 'content-type': 'application/json; charset=utf-8' });
    respuesta.end(JSON.stringify(datos));
  };

  switch (plan.respuesta ?? 'ok') {
    case 'caida':
      respuesta.socket.destroy();
      return;
    case 'html':
      respuesta.writeHead(404, { 'content-type': 'text/html' }).end('<h1>404</h1>');
      return;
    case 'servidor':
      json(500, { ok: false, errores: ['No pudimos enviar tu postulación en este momento.'] });
      return;
    case 'antirrobots':
      json(403, {
        ok: false,
        errores: ['La comprobación antirrobots no pasó. Recarga la página e inténtalo de nuevo.'],
      });
      return;
    case 'error':
      json(400, { ok: false, errores: ['El teléfono debe tener entre 7 y 15 dígitos.'] });
      return;
    default:
      json(200, { ok: true });
  }
}

function servir() {
  return new Promise((listo) => {
    const servidor = createServer(async (peticion, respuesta) => {
      let ruta = decodeURIComponent(new URL(peticion.url, 'http://x').pathname);
      if (ruta.startsWith(BASE)) ruta = ruta.slice(BASE.length);

      if (ruta === RUTA_FUNCION) {
        await atenderFuncion(peticion, respuesta);
        return;
      }

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
        respuesta.writeHead(404, { 'content-type': 'text/html' }).end('<h1>404</h1>');
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

const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);
const OLE2 = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.alloc(1024),
]);

async function prepararArchivos() {
  const carpeta = await mkdtemp(join(tmpdir(), 'dst-empleos-'));
  const ruta = (nombre) => join(carpeta, nombre);

  const docx = zipConUnaEntrada(
    'word/document.xml',
    '<?xml version="1.0"?><w:document xmlns:w="x"><w:body/></w:document>',
  );
  // 4 MB y un byte: justo por encima del tope.
  const pdfPesado = Buffer.concat([PDF_MINIMO, Buffer.alloc(4 * 1024 * 1024 + 1)]);

  const archivos = {
    pdfValido: ruta('hoja de vida.pdf'),
    docxValido: ruta('hoja-de-vida.docx'),
    docValido: ruta('hoja-de-vida.doc'),
    texto: ruta('hoja-de-vida.txt'),
    pdfFalso: ruta('disfrazado.pdf'),
    pesado: ruta('escaneo-gigante.pdf'),
    dobleExtension: ruta('hoja.exe.pdf'),
  };

  await Promise.all([
    writeFile(archivos.pdfValido, PDF_MINIMO),
    writeFile(archivos.docxValido, docx),
    writeFile(archivos.docValido, OLE2),
    writeFile(archivos.texto, 'Esto es un archivo de texto plano.\n'),
    writeFile(archivos.pdfFalso, 'MZ Esto no es un PDF, es texto plano disfrazado.\n'),
    writeFile(archivos.pesado, pdfPesado),
    writeFile(archivos.dobleExtension, PDF_MINIMO),
  ]);

  return archivos;
}

// --- Dobles -----------------------------------------------------------------

/** Turnstile de mentira: cada `execute` devuelve un token distinto. */
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
 * Lector mínimo de multipart/form-data, suficiente para ver qué mandó el
 * navegador: nombre del campo, nombre de archivo, tipo y bytes de cada parte.
 */
function leerMultipart(cuerpo, contentType) {
  const coincidencia = /boundary=("?)([^";]+)\1/i.exec(contentType ?? '');
  if (!cuerpo || !coincidencia) return null;
  const limite = Buffer.from(`--${coincidencia[2]}`);
  const partes = [];

  let posicion = cuerpo.indexOf(limite);
  while (posicion !== -1) {
    let inicio = posicion + limite.length;
    if (cuerpo.subarray(inicio, inicio + 2).toString() === '--') break;
    inicio += 2; // el CRLF que sigue al límite
    const fin = cuerpo.indexOf(limite, inicio);
    if (fin === -1) break;
    const bloque = cuerpo.subarray(inicio, fin - 2); // sin el CRLF final
    const separador = bloque.indexOf('\r\n\r\n');
    const cabeceras = bloque.subarray(0, separador).toString('utf8');
    const datos = bloque.subarray(separador + 4);
    partes.push({
      nombre: /name="([^"]*)"/.exec(cabeceras)?.[1] ?? '',
      archivo: /filename="([^"]*)"/.exec(cabeceras)?.[1],
      tipo: /content-type:\s*([^\r\n]+)/i.exec(cabeceras)?.[1],
      datos,
    });
    posicion = fin;
  }
  return partes;
}

/**
 * Prepara los dobles para una página y devuelve el registro de lo que llegó.
 *
 * El de Turnstile se sirve con `page.route()`; el de la función vive en el
 * servidor local (ver `atenderFuncion`) y aquí solo se le fija el plan y se
 * vacía lo registrado por la página anterior.
 */
async function instalarDobles(pagina, plan = {}) {
  funcion.plan = plan;
  funcion.envios = [];

  await pagina.route('https://challenges.cloudflare.com/**', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'text/javascript', body: TURNSTILE_FALSO }),
  );

  return funcion;
}

async function abrir(contexto, plan = {}, camino = '/empleos/') {
  const pagina = await contexto.newPage();
  const registro = await instalarDobles(pagina, plan);
  await pagina.goto(url(camino), { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(400);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();
  return { pagina, registro };
}

/** ¿El sitio compilado lleva clave de Turnstile en el formulario? */
const hayTurnstile = async (pagina) =>
  ((await pagina.locator('[data-form-empleo]').getAttribute('data-turnstile-key')) ?? '') !== '';

async function rellenar(pagina, archivo) {
  await pagina.fill('#nombre-empleo', 'Cristian Amaya (prueba automática)');
  await pagina.fill('#correo-empleo', 'practicaspasantiasdst@gmail.com');
  await pagina.fill('#telefono-empleo', '3106232429');
  await pagina.selectOption('#cargo-empleo', 'Vendedor TAT');
  await pagina.fill('#experiencia-empleo', 'Dos años en ventas TAT en Tunja.');
  if (archivo) await pagina.setInputFiles('#hoja-de-vida-empleo', archivo);
  await pagina.check('#autorizacion-empleo');
}

const textoDe = async (localizador) => ((await localizador.textContent()) ?? '').trim();

// --- A) El campo de hoja de vida --------------------------------------------

async function revisarCampo(navegador, archivos, etiqueta, viewport) {
  console.log(`\n=== A) Campo de hoja de vida (${etiqueta}) ===\n`);
  const contexto = await navegador.newContext({ viewport });
  const { pagina, registro } = await abrir(contexto);

  const entrada = pagina.locator('#hoja-de-vida-empleo');
  const error = pagina.locator('[data-error-hv]');
  const archivo = pagina.locator('[data-archivo-hv]');
  const cuantos = () => entrada.evaluate((e) => e.files.length);

  comprobar(`${etiqueta}: el campo existe y es obligatorio`, (await entrada.count()) === 1 && (await entrada.getAttribute('required')) !== null);
  comprobar(
    `${etiqueta}: solo acepta .pdf, .doc y .docx`,
    (await entrada.getAttribute('accept')) === '.pdf,.doc,.docx',
    String(await entrada.getAttribute('accept')),
  );
  comprobar(
    `${etiqueta}: dice los formatos y el tope antes de elegir nada`,
    (await textoDe(pagina.locator('[data-ayuda-hv]'))) === 'PDF, DOC o DOCX, máximo 4 MB.',
    await textoDe(pagina.locator('[data-ayuda-hv]')),
  );
  comprobar(
    `${etiqueta}: la ayuda está enlazada al campo (aria-describedby)`,
    (await entrada.getAttribute('aria-describedby')) === 'hoja-de-vida-empleo-ayuda',
  );

  // ---- Válidos --------------------------------------------------------------
  await entrada.setInputFiles(archivos.pdfValido);
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: un PDF válido se acepta y se enseña con nombre y peso`,
    (await archivo.isVisible()) &&
      (await textoDe(pagina.locator('[data-archivo-nombre]'))) === 'hoja de vida.pdf' &&
      /\d+ B|KB|MB/.test(await textoDe(pagina.locator('[data-archivo-peso]'))) &&
      !(await error.isVisible()) &&
      (await cuantos()) === 1,
    await textoDe(archivo),
  );

  await entrada.setInputFiles(archivos.docxValido);
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: un .docx válido se acepta`,
    (await textoDe(pagina.locator('[data-archivo-nombre]'))) === 'hoja-de-vida.docx' &&
      !(await error.isVisible()) &&
      (await cuantos()) === 1,
  );

  await entrada.setInputFiles(archivos.docValido);
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: un .doc válido se acepta`,
    (await textoDe(pagina.locator('[data-archivo-nombre]'))) === 'hoja-de-vida.doc' &&
      !(await error.isVisible()) &&
      (await cuantos()) === 1,
  );

  // ---- Rechazados -----------------------------------------------------------
  await entrada.setInputFiles(archivos.texto);
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: un .txt se rechaza nombrando los formatos, y sale del input`,
    (await error.isVisible()) &&
      (await textoDe(error)).includes('PDF, DOC o DOCX') &&
      (await cuantos()) === 0 &&
      !(await archivo.isVisible()),
    await textoDe(error),
  );
  comprobar(
    `${etiqueta}: el rechazo deja el campo inválido para reportValidity()`,
    !(await entrada.evaluate((e) => e.checkValidity())),
  );

  await entrada.setInputFiles(archivos.pdfFalso);
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: texto plano disfrazado de .pdf se rechaza por su contenido`,
    (await error.isVisible()) && (await textoDe(error)).includes('contenido') && (await cuantos()) === 0,
    await textoDe(error),
  );

  await entrada.setInputFiles(archivos.dobleExtension);
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: la doble extensión se rechaza`,
    (await error.isVisible()) && (await textoDe(error)).includes('doble extensión') && (await cuantos()) === 0,
    await textoDe(error),
  );

  await entrada.setInputFiles(archivos.pesado);
  await pagina.waitForTimeout(600);
  comprobar(
    `${etiqueta}: más de 4 MB se rechaza diciendo el tope`,
    (await error.isVisible()) && (await textoDe(error)).includes('el máximo es 4 MB') && (await cuantos()) === 0,
    await textoDe(error),
  );

  await entrada.setInputFiles(archivos.pdfValido);
  await pagina.waitForTimeout(300);
  comprobar(
    `${etiqueta}: un archivo válido después del rechazo borra el error`,
    !(await error.isVisible()) && (await cuantos()) === 1 && (await entrada.evaluate((e) => e.checkValidity())),
  );

  // ---- Campo trampa y casilla ----------------------------------------------
  /*
   * `isVisible()` de Playwright no sirve aquí: da por visible cualquier
   * elemento con caja, aunque esté a 9999 px de la pantalla. Se mira la caja
   * de verdad y que cuelgue de un `aria-hidden`.
   */
  const trampa = pagina.locator('[data-honeypot]');
  const fueraDeVista = await trampa.evaluate((e) => {
    const caja = e.getBoundingClientRect();
    const ocultoALectores = e.closest('[aria-hidden="true"]') !== null;
    return ocultoALectores && (caja.right <= 0 || caja.bottom <= 0 || caja.width <= 1);
  });
  comprobar(
    `${etiqueta}: el campo trampa está en el HTML pero fuera de la vista y de los lectores de pantalla`,
    (await trampa.count()) === 1 && fueraDeVista && (await trampa.inputValue()) === '',
  );
  comprobar(
    `${etiqueta}: el campo trampa queda fuera del orden de tabulación`,
    (await trampa.getAttribute('tabindex')) === '-1' && (await trampa.getAttribute('autocomplete')) === 'off',
  );

  const casilla = pagina.locator('#autorizacion-empleo');
  comprobar(
    `${etiqueta}: la casilla de tratamiento de datos existe y es obligatoria`,
    (await casilla.count()) === 1 && (await casilla.getAttribute('required')) !== null,
  );
  comprobar(
    `${etiqueta}: el aviso de la Ley 1581 sigue en la página`,
    (await pagina.locator('#postular').textContent()).includes('Ley 1581 de 2012'),
  );

  // Sin marcar la casilla, no sale ninguna petición.
  await pagina.fill('#nombre-empleo', 'Cristian Amaya');
  await pagina.fill('#correo-empleo', 'practicaspasantiasdst@gmail.com');
  await pagina.fill('#telefono-empleo', '3106232429');
  await pagina.click('[data-enviar-empleo]');
  await pagina.waitForTimeout(500);
  comprobar(
    `${etiqueta}: sin la casilla marcada no se envía nada`,
    registro.envios.length === 0 && (await pagina.locator('[data-form-empleo]').isVisible()),
    String(registro.envios.length),
  );

  // Sin hoja de vida, tampoco.
  await casilla.check();
  await entrada.setInputFiles([]);
  await pagina.waitForTimeout(200);
  await pagina.click('[data-enviar-empleo]');
  await pagina.waitForTimeout(500);
  comprobar(
    `${etiqueta}: sin hoja de vida no se envía nada`,
    registro.envios.length === 0,
    String(registro.envios.length),
  );

  await pagina.close();
  await contexto.close();
}

// --- B) El envío -------------------------------------------------------------

async function revisarEnvio(navegador, archivos) {
  console.log('\n=== B) Envío ===\n');
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });

  // ---- 1. Camino feliz, con demora para ver el estado intermedio ---------
  {
    const { pagina, registro } = await abrir(contexto, { respuesta: 'ok', demora: 900 });
    const conTurnstile = await hayTurnstile(pagina);
    await rellenar(pagina, archivos.pdfValido);
    await pagina.waitForTimeout(300);

    const boton = pagina.locator('[data-enviar-empleo]');
    await boton.click();
    await pagina.waitForTimeout(350);
    comprobar(
      'Envío: mientras se envía, el botón está deshabilitado y dice "Enviando…"',
      (await boton.isDisabled()) && (await textoDe(boton)) === 'Enviando…',
      await textoDe(boton),
    );

    await pagina.waitForTimeout(1500);
    const confirmacion = pagina.locator('[data-confirmacion-empleo]');
    comprobar(
      'Envío: con 200 sale la confirmación y el formulario desaparece',
      (await confirmacion.isVisible()) && !(await pagina.locator('[data-form-empleo]').isVisible()),
    );
    comprobar(
      'Envío: la confirmación dice "Recibimos tu postulación, te contactaremos al correo indicado"',
      (await textoDe(confirmacion)).includes(
        'Recibimos tu postulación, te contactaremos al correo indicado',
      ),
    );
    comprobar(
      'Envío: no se cayó al gestor de correo',
      (await pagina.locator('[data-form-empleo][data-respaldo]').count()) === 0,
    );
    comprobar('Envío: salió UNA sola petición', registro.envios.length === 1, String(registro.envios.length));

    const envio = registro.envios[0];
    comprobar(
      'Envío: es un POST multipart/form-data',
      envio?.metodo === 'POST' && envio.tipo.startsWith('multipart/form-data'),
      `${envio?.metodo} ${envio?.tipo}`,
    );

    const partes = envio?.partes ?? [];
    const parte = (nombre) => partes.find((p) => p.nombre === nombre);
    const valor = (nombre) => parte(nombre)?.datos.toString('utf8');
    comprobar(
      'Envío: el navegador dejó ver el cuerpo (postDataBuffer)',
      partes.length > 0,
      partes.length === 0 ? 'Playwright no entregó el cuerpo del multipart' : `${partes.length} partes`,
    );
    comprobar(
      'Envío: van los campos de texto con lo escrito',
      valor('nombre') === 'Cristian Amaya (prueba automática)' &&
        valor('correo') === 'practicaspasantiasdst@gmail.com' &&
        valor('telefono') === '3106232429' &&
        valor('cargo') === 'Vendedor TAT' &&
        valor('experiencia') === 'Dos años en ventas TAT en Tunja.',
      partes.map((p) => `${p.nombre}=${p.archivo ?? p.datos.toString('utf8').slice(0, 40)}`).join(' | '),
    );
    comprobar('Envío: va la casilla de autorización', valor('autorizacion') === 'si', String(valor('autorizacion')));
    comprobar('Envío: el campo trampa viaja vacío', parte('sitio-web') !== undefined && valor('sitio-web') === '');
    comprobar(
      conTurnstile
        ? 'Envío: va el token de Turnstile del widget'
        : 'Envío: sin clave de Turnstile en el build, el token viaja vacío',
      conTurnstile ? (valor('turnstileToken') ?? '').startsWith('token-de-prueba-') : valor('turnstileToken') === '',
      String(valor('turnstileToken')),
    );
    const hoja = parte('hoja-de-vida');
    comprobar(
      'Envío: la hoja de vida va con su nombre, su tipo y SUS bytes',
      hoja?.archivo === 'hoja de vida.pdf' &&
        (hoja.tipo ?? '').startsWith('application/pdf') &&
        Buffer.compare(hoja.datos, PDF_MINIMO) === 0,
      hoja ? `${hoja.archivo} ${hoja.tipo} ${hoja.datos.length} B` : '(no llegó)',
    );

    await pagina.close();
  }

  // ---- 2. Un 400 se muestra y no cae al correo ----------------------------
  {
    const { pagina, registro } = await abrir(contexto, { respuesta: 'error' });
    await rellenar(pagina, archivos.pdfValido);
    await pagina.waitForTimeout(300);
    await pagina.click('[data-enviar-empleo]');
    await pagina.waitForTimeout(900);

    const errores = pagina.locator('[data-errores-empleo]');
    comprobar(
      'Error 400: se muestra el motivo que mandó el servidor',
      (await errores.isVisible()) && (await textoDe(errores)).includes('entre 7 y 15 dígitos'),
      await textoDe(errores),
    );
    comprobar(
      'Error 400: NO cae al gestor de correo y el formulario sigue ahí',
      (await pagina.locator('[data-form-empleo][data-respaldo]').count()) === 0 &&
        (await pagina.locator('[data-form-empleo]').isVisible()),
    );
    const boton = pagina.locator('[data-enviar-empleo]');
    comprobar(
      'Error 400: el botón vuelve a quedar usable con su texto',
      !(await boton.isDisabled()) && (await textoDe(boton)) === 'Enviar postulación',
    );
    comprobar('Error 400: se intentó una sola vez', registro.envios.length === 1, String(registro.envios.length));
    await pagina.close();
  }

  // ---- 3. Un 403 de antirrobots, igual --------------------------------------
  {
    const { pagina } = await abrir(contexto, { respuesta: 'antirrobots' });
    await rellenar(pagina, archivos.pdfValido);
    await pagina.waitForTimeout(300);
    await pagina.click('[data-enviar-empleo]');
    await pagina.waitForTimeout(900);
    const errores = pagina.locator('[data-errores-empleo]');
    comprobar(
      'Antirrobots (403): enseña el motivo sin caer al correo',
      (await errores.isVisible()) &&
        (await textoDe(errores)).includes('antirrobots') &&
        (await pagina.locator('[data-form-empleo][data-respaldo]').count()) === 0,
      await textoDe(errores),
    );
    await pagina.close();
  }

  // ---- 4. Sin función: respaldo por correo, por los tres caminos -----------
  for (const [caso, plan] of [
    ['Un 500 del servidor', { respuesta: 'servidor' }],
    ['El HTML del espejo estático (GitHub Pages)', { respuesta: 'html' }],
    ['La red caída', { respuesta: 'caida' }],
  ]) {
    const { pagina } = await abrir(contexto, plan);
    await rellenar(pagina, archivos.pdfValido);
    await pagina.waitForTimeout(300);
    await pagina.click('[data-enviar-empleo]');
    await pagina.waitForTimeout(900);

    // Chromium no emite ningún evento al abrir un mailto:, así que el
    // componente marca `data-respaldo="correo"` antes de navegar.
    const respaldo = pagina.locator('[data-form-empleo][data-respaldo="correo"]');
    const aviso = pagina.locator('[data-aviso-respaldo]');
    comprobar(
      `${caso}: se cae al gestor de correo`,
      (await respaldo.count()) === 1,
    );
    comprobar(
      `${caso}: el aviso pide adjuntar la hoja de vida a ese correo`,
      (await aviso.isVisible()) && (await textoDe(aviso)).includes('adjunta ahí tu hoja de vida'),
      await textoDe(aviso),
    );
    comprobar(
      `${caso}: el botón "Prefiero WhatsApp" sigue a la vista`,
      await pagina.locator('[data-whatsapp-empleo]').isVisible(),
    );
    await pagina.close();
  }

  await contexto.close();
}

// --- C) El cargo preseleccionado ---------------------------------------------

async function revisarCargo(navegador) {
  console.log('\n=== C) Cargo preseleccionado ===\n');
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });

  {
    const { pagina } = await abrir(contexto, {}, '/empleos/?cargo=Buscamos%20Veh%C3%ADculos#postular');
    comprobar(
      'Llegando con ?cargo= el select trae esa vacante',
      (await pagina.locator('#cargo-empleo').inputValue()) === 'Buscamos Vehículos',
      await pagina.locator('#cargo-empleo').inputValue(),
    );
    await pagina.close();
  }

  {
    const { pagina } = await abrir(contexto);
    await pagina.locator('[data-postular="Vendedor TAT"]').first().click();
    await pagina.waitForTimeout(300);
    comprobar(
      '"Postularme" en la tarjeta deja ese cargo elegido',
      (await pagina.locator('#cargo-empleo').inputValue()) === 'Vendedor TAT',
    );
    comprobar(
      'El select ofrece la opción de hoja de vida espontánea',
      (await pagina.locator('#cargo-empleo option[value="Otro / hoja de vida espontánea"]').count()) === 1,
    );
    await pagina.close();
  }

  await contexto.close();
}

// --- D) Opcional: envío real -------------------------------------------------

async function envioReal(base, archivos) {
  console.log(`\n=== D) Envío real contra ${base} ===\n`);
  const cuerpo = new FormData();
  cuerpo.set('nombre', 'Prueba automática de dstunja.com');
  cuerpo.set('correo', 'practicaspasantiasdst@gmail.com');
  cuerpo.set('telefono', '3106232429');
  cuerpo.set('cargo', 'Otro / hoja de vida espontánea');
  cuerpo.set('experiencia', 'Envío de prueba de scripts/verificar-empleos.mjs. Ignorar.');
  cuerpo.set('autorizacion', 'si');
  cuerpo.set('turnstileToken', 'token-de-prueba');
  cuerpo.set(
    'hoja-de-vida',
    new File([await readFile(archivos.pdfValido)], 'hoja de vida.pdf', { type: 'application/pdf' }),
  );

  try {
    const respuesta = await fetch(`${base.replace(/\/$/, '')}/api/empleos/postular`, {
      method: 'POST',
      body: cuerpo,
    });
    const texto = await respuesta.text();
    comprobar(
      'Envío real: la función respondió JSON',
      (respuesta.headers.get('content-type') ?? '').includes('application/json'),
      `${respuesta.status} ${texto.slice(0, 200)}`,
    );
    comprobar('Envío real: respondió 200 { ok: true }', respuesta.status === 200 && texto.includes('"ok":true'), `${respuesta.status} ${texto.slice(0, 200)}`);
  } catch (fallo) {
    comprobar('Envío real: la función contestó', false, fallo.message);
  }
}

// --- Ejecución --------------------------------------------------------------

const archivos = await prepararArchivos();
const servidor = await servir();
const navegador = await chromium.launch();

try {
  await revisarCampo(navegador, archivos, 'Móvil', { width: 375, height: 720 });
  await revisarCampo(navegador, archivos, 'Escritorio', { width: 1280, height: 800 });
  await revisarEnvio(navegador, archivos);
  await revisarCargo(navegador);
} finally {
  await navegador.close();
  servidor.close();
}

const indiceApi = process.argv.indexOf('--api');
if (indiceApi !== -1 && process.argv[indiceApi + 1]) {
  await envioReal(process.argv[indiceApi + 1], archivos);
}

const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallas.length === 0 ? 0 : 1);

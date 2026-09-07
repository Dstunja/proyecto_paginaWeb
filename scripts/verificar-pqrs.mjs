/**
 * Verificación del campo de archivos de soporte de la PQRS, con un navegador
 * de verdad y archivos de verdad.
 *
 * Comprueba sobre el sitio YA COMPILADO en dist/:
 *
 *   1. El campo solo existe para Queja y Reclamo. Con Petición, Sugerencia o
 *      Felicitación está oculto, el input queda deshabilitado y el nombre del
 *      campo NO aparece en el FormData: no se procesa.
 *   2. Al cambiar de Queja a un tipo sin soporte se limpia lo seleccionado, y
 *      al volver a Queja la lista está vacía.
 *   3. Un archivo válido (PNG, PDF, DOCX, DOC) se acepta y se muestra con su
 *      nombre y su tamaño, con botón para quitarlo.
 *   4. Se rechaza el formato no permitido (.txt), la doble extensión
 *      (factura.exe.pdf) y el archivo cuyo CONTENIDO no corresponde a la
 *      extensión (un texto plano renombrado a .pdf).
 *   5. Se rechaza el archivo que supera el máximo de 5 MB.
 *   6. No se pueden adjuntar más de 3 archivos.
 *   7. El texto de ayuda y el atributo accept son los que se prometieron.
 *
 * Los archivos de prueba se generan en el directorio temporal del sistema, no
 * dentro del repositorio: así no se cuelan en ningún commit.
 *
 * Uso:
 *   npm run build
 *   node scripts/verificar-pqrs.mjs
 *
 * No necesita dependencias nuevas: Playwright ya está en devDependencies y el
 * servidor estático es el mismo patrón de scripts/verificar-pedido.mjs.
 */
import { createServer } from 'node:http';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { crc32 } from 'node:zlib';
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

// --- Archivos de prueba -----------------------------------------------------

/**
 * ZIP mínimo pero estructuralmente correcto con una entrada almacenada (sin
 * comprimir). Se usa para fabricar un .docx creíble: lo que mira el detector es
 * la firma PK y la presencia de la carpeta "word/".
 */
function zipConUnaEntrada(nombreEntrada, contenido) {
  const nombre = Buffer.from(nombreEntrada, 'utf8');
  const datos = Buffer.from(contenido, 'utf8');
  const suma = crc32(datos);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // firma de cabecera local
  local.writeUInt16LE(20, 4); // versión necesaria
  local.writeUInt16LE(0, 6); // banderas
  local.writeUInt16LE(0, 8); // método: almacenado
  local.writeUInt16LE(0, 10); // hora
  local.writeUInt16LE(0, 12); // fecha
  local.writeUInt32LE(suma, 14);
  local.writeUInt32LE(datos.length, 18); // tamaño comprimido
  local.writeUInt32LE(datos.length, 22); // tamaño original
  local.writeUInt16LE(nombre.length, 26);
  local.writeUInt16LE(0, 28); // campo extra

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // firma del directorio central
  central.writeUInt16LE(20, 4); // versión de creación
  central.writeUInt16LE(20, 6); // versión necesaria
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(suma, 16);
  central.writeUInt32LE(datos.length, 20);
  central.writeUInt32LE(datos.length, 24);
  central.writeUInt16LE(nombre.length, 28);
  central.writeUInt16LE(0, 30); // extra
  central.writeUInt16LE(0, 32); // comentario
  central.writeUInt16LE(0, 34); // disco
  central.writeUInt16LE(0, 36); // atributos internos
  central.writeUInt32LE(0, 38); // atributos externos
  central.writeUInt32LE(0, 42); // desplazamiento de la cabecera local

  const inicioCentral = local.length + nombre.length + datos.length;
  const tamanoCentral = central.length + nombre.length;

  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); // firma del fin del directorio central
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(1, 8); // entradas en este disco
  fin.writeUInt16LE(1, 10); // entradas en total
  fin.writeUInt32LE(tamanoCentral, 12);
  fin.writeUInt32LE(inicioCentral, 16);
  fin.writeUInt16LE(0, 20); // comentario

  return Buffer.concat([local, nombre, datos, central, nombre, fin]);
}

/** PNG real de 1x1 px transparente. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** PDF real mínimo: cabecera, un objeto, tabla xref y %%EOF. */
const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);

/** Firma del contenedor OLE2/CFB, que es lo que usa Word 97-2003 (.doc). */
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

  // El PNG enorme lleva la firma correcta: así se demuestra que lo que lo
  // rechaza es el peso y no el formato (el tamaño se revisa antes que el MIME).
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
    // Extensión .pdf pero contenido de texto: solo lo caza la lectura de los
    // primeros bytes, que es justo lo que se quiere probar.
    writeFile(archivos.pdfFalso, 'MZ Esto no es un PDF, es texto plano disfrazado.\n'),
    writeFile(archivos.pesado, pngEnorme),
    writeFile(archivos.extra1, PNG_1X1),
    writeFile(archivos.extra2, PNG_1X1),
  ]);

  return archivos;
}

// --- Comprobaciones ---------------------------------------------------------

async function revisar(navegador, archivos, etiqueta, viewport) {
  console.log(`\n=== ${etiqueta} (${viewport.width}px) ===\n`);
  const contexto = await navegador.newContext({ viewport });
  const pagina = await contexto.newPage();

  await pagina.goto(url('/pqrs/'), { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(300);
  const rechazar = pagina.locator('[data-rechazar-cookies]');
  if (await rechazar.isVisible().catch(() => false)) await rechazar.click();

  const bloque = pagina.locator('[data-adjuntos]');
  const entrada = pagina.locator('[data-adjuntos] [data-entrada]');
  const lista = pagina.locator('[data-adjuntos] [data-lista]');
  const error = pagina.locator('[data-adjuntos] [data-error]');
  const tipo = pagina.locator('#tipo-pqrs');

  /** Lee lo que vería el backend: las claves del FormData del formulario. */
  const clavesDelEnvio = () =>
    pagina.evaluate(() => {
      const form = document.querySelector('form[data-mailto]');
      return [...new FormData(form).keys()];
    });

  const adjuntar = async (...rutas) => {
    await entrada.setInputFiles(rutas);
    // La validación lee los primeros bytes de cada archivo: es asíncrona.
    await pagina.waitForTimeout(400);
  };

  // ---- 1. El campo solo existe para Queja y Reclamo -----------------------
  comprobar(
    `${etiqueta}: con "Petición" (valor por defecto) el campo de soporte no se ve`,
    !(await bloque.isVisible()),
  );
  comprobar(
    `${etiqueta}: con "Petición" el input está deshabilitado`,
    await entrada.isDisabled(),
  );
  comprobar(
    `${etiqueta}: con "Petición" el adjunto no viaja en el envío`,
    !(await clavesDelEnvio()).includes('soporte-pqrs'),
    (await clavesDelEnvio()).join(', '),
  );

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

  // ---- 7. Ayuda y accept --------------------------------------------------
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
  comprobar(`${etiqueta}: el input admite varios archivos`, await entrada.evaluate((e) => e.multiple));

  // ---- 3. Archivo válido --------------------------------------------------
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
  comprobar(
    `${etiqueta}: con adjunto válido el campo sí viaja en el envío`,
    (await clavesDelEnvio()).includes('soporte-pqrs'),
  );

  // Quitar lo deja como estaba.
  await lista.locator('[data-quitar]').first().click();
  await pagina.waitForTimeout(150);
  comprobar(
    `${etiqueta}: "Quitar" saca el archivo de la lista y del input`,
    (await lista.locator('li').count()) === 0 &&
      (await entrada.evaluate((e) => e.files.length)) === 0,
  );

  // El resto de formatos permitidos, uno a uno.
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

  // ---- 4. Formatos rechazados --------------------------------------------
  await adjuntar(archivos.texto);
  comprobar(
    `${etiqueta}: un .txt se rechaza por formato no permitido`,
    (await lista.locator('li').count()) === 0 &&
      /formato no permitido/i.test((await error.textContent()) ?? ''),
    ((await error.textContent()) ?? '').trim(),
  );

  await adjuntar(archivos.dobleExtension);
  comprobar(
    `${etiqueta}: "factura.exe.pdf" se rechaza por doble extensión`,
    (await lista.locator('li').count()) === 0 &&
      /doble extensión/i.test((await error.textContent()) ?? ''),
    ((await error.textContent()) ?? '').trim(),
  );

  await adjuntar(archivos.pdfFalso);
  comprobar(
    `${etiqueta}: un texto renombrado a .pdf se rechaza por su contenido real`,
    (await lista.locator('li').count()) === 0 &&
      /no reconocemos el contenido|no corresponde a la extensión/i.test(
        (await error.textContent()) ?? '',
      ),
    ((await error.textContent()) ?? '').trim(),
  );

  // ---- 5. Tamaño excedido -------------------------------------------------
  await adjuntar(archivos.pesado);
  comprobar(
    `${etiqueta}: un archivo de más de 5 MB se rechaza por peso`,
    (await lista.locator('li').count()) === 0 &&
      /máximo es 5 MB/i.test((await error.textContent()) ?? ''),
    ((await error.textContent()) ?? '').trim(),
  );

  // ---- 6. Tope de tres archivos -------------------------------------------
  await adjuntar(archivos.pngValido, archivos.pdfValido, archivos.extra1);
  comprobar(
    `${etiqueta}: se admiten tres archivos a la vez`,
    (await lista.locator('li').count()) === 3 && !(await error.isVisible()),
    ((await error.textContent()) ?? '').trim(),
  );

  await adjuntar(archivos.extra2);
  comprobar(
    `${etiqueta}: el cuarto archivo se rechaza y avisa del tope`,
    (await lista.locator('li').count()) === 3 &&
      /máximo 3 archivos|Solo puedes adjuntar 3 archivos/i.test(
        (await error.textContent()) ?? '',
      ),
    ((await error.textContent()) ?? '').trim(),
  );

  // ---- 2. Cambiar a un tipo sin soporte limpia la selección ---------------
  await tipo.selectOption('Petición');
  await pagina.waitForTimeout(200);
  comprobar(
    `${etiqueta}: al pasar a "Petición" el campo se oculta y se vacía`,
    !(await bloque.isVisible()) &&
      (await entrada.isDisabled()) &&
      (await entrada.evaluate((e) => e.files.length)) === 0,
  );
  comprobar(
    `${etiqueta}: tras el cambio de tipo el adjunto ya no viaja en el envío`,
    !(await clavesDelEnvio()).includes('soporte-pqrs'),
    (await clavesDelEnvio()).join(', '),
  );

  await tipo.selectOption('Queja');
  await pagina.waitForTimeout(200);
  comprobar(
    `${etiqueta}: al volver a "Queja" la lista aparece vacía`,
    (await bloque.isVisible()) && (await lista.locator('li').count()) === 0,
  );

  // ---- El aviso de envío recuerda adjuntar los archivos -------------------
  await adjuntar(archivos.pngValido);
  await pagina.fill('#nombre-pqrs', 'Cristian Amaya');
  await pagina.fill('#telefono-pqrs', '3106232429');
  await pagina.fill('#correo-pqrs', 'practicaspasantiasdst@gmail.com');
  await pagina.fill('#municipio-pqrs', 'Tunja');
  await pagina.fill('#descripcion-pqrs', 'Prueba automática del campo de soporte.');
  await pagina.check('#autorizacion-pqrs');
  await pagina.click('form[data-mailto] button[type="submit"]');
  await pagina.waitForTimeout(300);
  const aviso = (await pagina.locator('form[data-mailto] [data-aviso]').textContent()) ?? '';
  comprobar(
    `${etiqueta}: al enviar con adjunto, el aviso recuerda adjuntarlo al correo`,
    /adjunta el archivo|adjunta los \d+ archivos/i.test(aviso),
    aviso.trim(),
  );

  await contexto.close();
}

const archivos = await prepararArchivos();
const servidor = await servir();
const navegador = await chromium.launch();

try {
  await revisar(navegador, archivos, 'Móvil', { width: 375, height: 720 });
  await revisar(navegador, archivos, 'Escritorio', { width: 1280, height: 800 });
} finally {
  await navegador.close();
  servidor.close();
}

const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas.`);
process.exit(fallas.length === 0 ? 0 : 1);

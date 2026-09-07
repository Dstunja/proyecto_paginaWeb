/**
 * Pruebas de POST /api/pqrs (src/lib/pqrs/radicar.ts).
 *
 * Vercel Blob se sustituye por un almacén en memoria: las pruebas suben los
 * bytes de verdad de un PNG, un PDF, un DOCX y un DOC, y comprueban que la
 * validación por bytes mágicos hace su trabajo sobre lo que hay guardado, no
 * sobre lo que dijo el navegador.
 *
 * Lo que se comprueba aquí es el servidor. Lo que se ve en pantalla se prueba
 * con un navegador de verdad en scripts/verificar-pqrs.mjs.
 */
import { crc32 } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Almacén simulado --------------------------------------------------------

interface BlobFalso {
  bytes: Uint8Array;
  subidoEn: Date;
}

const almacenFalso = new Map<string, BlobFalso>();
const correosEnviados: Array<Record<string, unknown>> = [];

function urlDe(pathname: string) {
  return `https://ejemplo.public.blob.vercel-storage.com/${pathname}`;
}

function rutaDe(urlOPathname: string) {
  return urlOPathname.startsWith('https://')
    ? decodeURIComponent(new URL(urlOPathname).pathname).replace(/^\//, '')
    : urlOPathname;
}

vi.mock('@vercel/blob', () => ({
  head: async (urlOPathname: string) => {
    const ruta = rutaDe(urlOPathname);
    const blob = almacenFalso.get(ruta);
    if (!blob) throw new Error('BlobNotFound');
    return {
      pathname: ruta,
      url: urlDe(ruta),
      size: blob.bytes.length,
      uploadedAt: blob.subidoEn,
      contentType: 'application/octet-stream',
    };
  },
  get: async (urlOPathname: string) => {
    const ruta = rutaDe(urlOPathname);
    const blob = almacenFalso.get(ruta);
    if (!blob) return null;
    return {
      statusCode: 200 as const,
      stream: new ReadableStream<Uint8Array>({
        start(control) {
          control.enqueue(blob.bytes);
          control.close();
        },
      }),
      headers: new Headers(),
      blob: { pathname: ruta, url: urlDe(ruta), size: blob.bytes.length, contentType: 'x' },
    };
  },
  copy: async (desde: string, hasta: string) => {
    const blob = almacenFalso.get(rutaDe(desde));
    if (!blob) throw new Error('BlobNotFound');
    almacenFalso.set(hasta, { ...blob });
    return { url: urlDe(hasta), pathname: hasta };
  },
  del: async (rutas: string | string[]) => {
    for (const ruta of Array.isArray(rutas) ? rutas : [rutas]) {
      almacenFalso.delete(rutaDe(ruta));
    }
  },
  put: async (pathname: string, cuerpo: string) => {
    almacenFalso.set(pathname, {
      bytes: new TextEncoder().encode(cuerpo),
      subidoEn: new Date(),
    });
    return { url: urlDe(pathname), pathname };
  },
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: [...almacenFalso.entries()]
      .filter(([ruta]) => ruta.startsWith(prefix))
      .map(([ruta, blob]) => ({
        pathname: ruta,
        url: urlDe(ruta),
        size: blob.bytes.length,
        uploadedAt: blob.subidoEn,
      })),
    hasMore: false,
    cursor: undefined,
  }),
  issueSignedToken: async () => ({
    clientSigningToken: 'firma',
    delegationToken: 'delegacion',
    validUntil: Date.now() + 60_000,
  }),
  presignUrl: async (_t: unknown, opciones: { pathname: string }) => ({
    presignedUrl: `${urlDe(opciones.pathname)}?firmado=1`,
  }),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (mensaje: Record<string, unknown>) => {
        correosEnviados.push(mensaje);
        return { data: { id: 'correo-de-prueba' }, error: null };
      },
    };
  },
}));

const { radicar } = await import('./radicar');
const { reiniciarMemoria } = await import('./limite-tasa');
const { prefijoSesion } = await import('./config');

// --- Archivos de prueba, con sus bytes de verdad -----------------------------

const PNG = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  ),
);

const PDF = new Uint8Array(
  Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1'),
);

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0x20), 0xff, 0xd9]);

const DOC = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
  ...new Array(512).fill(0),
]);

/** ZIP mínimo con una entrada almacenada, para hacer un .docx creíble. */
function zipConEntrada(nombreEntrada: string, contenido: string): Uint8Array {
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

  return new Uint8Array(Buffer.concat([local, nombre, datos, central, nombre, fin]));
}

const DOCX = zipConEntrada('word/document.xml', '<?xml version="1.0"?><w:document/>');

// --- Utilidades --------------------------------------------------------------

const ENTORNO = {
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_prueba',
  TURNSTILE_SECRET: 'secreto-de-prueba',
  RESEND_API_KEY: 're_prueba',
  PQRS_DESTINO: 'pqrs@dstunja.com',
  PQRS_IP_SALT: 'sal-de-prueba',
};

const SESSION = '11111111-2222-4333-8444-555555555555';

function sembrar(nombreArchivo: string, bytes: Uint8Array, sessionId = SESSION) {
  const ruta = `${prefijoSesion(sessionId)}${crypto.randomUUID()}${nombreArchivo.slice(nombreArchivo.lastIndexOf('.'))}`;
  almacenFalso.set(ruta, { bytes, subidoEn: new Date() });
  return { url: urlDe(ruta), pathname: ruta, nombreOriginal: nombreArchivo, tamano: bytes.length };
}

function peticion(cuerpo: Record<string, unknown>, ip = '203.0.113.10') {
  return new Request('https://dstunja.com/api/pqrs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(cuerpo),
  });
}

function solicitudBase(extra: Record<string, unknown> = {}) {
  return {
    tipo: 'Queja',
    nombre: 'Cristian Amaya',
    documento: '1234567890',
    telefono: '3106232429',
    correo: 'persona@ejemplo.com',
    municipio: 'Tunja',
    descripcion: 'El pedido llegó incompleto y nadie contestó el teléfono del punto de venta.',
    autorizacion: true,
    sessionId: SESSION,
    turnstileToken: 'token-valido',
    adjuntos: [],
    ...extra,
  };
}

function turnstileResponde(exito: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ success: exito, 'error-codes': exito ? [] : ['invalid-input-response'] }), {
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
}

/** Rutas del almacén que quedaron bajo la carpeta definitiva de un radicado. */
function archivosDe(radicado: string) {
  return [...almacenFalso.keys()].filter(
    (ruta) => ruta.startsWith(`pqrs/${radicado}/`) && !ruta.endsWith('solicitud.json'),
  );
}

function registroDe(radicado: string) {
  const crudo = almacenFalso.get(`pqrs/${radicado}/solicitud.json`);
  if (!crudo) throw new Error('no se guardó solicitud.json');
  return JSON.parse(new TextDecoder().decode(crudo.bytes));
}

beforeEach(() => {
  almacenFalso.clear();
  correosEnviados.length = 0;
  reiniciarMemoria();
  turnstileResponde(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Pruebas -----------------------------------------------------------------

describe('radicación con archivo válido', () => {
  const casos: Array<[string, string, Uint8Array]> = [
    ['PDF', 'factura.pdf', PDF],
    ['DOC', 'carta.doc', DOC],
    ['DOCX', 'descripcion.docx', DOCX],
    ['JPG', 'foto.jpg', JPEG],
    ['PNG', 'captura.png', PNG],
  ];

  it.each(casos)('acepta un %s y lo mueve a la carpeta del radicado', async (_etiqueta, nombre, bytes) => {
    const adjunto = sembrar(nombre, bytes);
    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [adjunto] })), ENTORNO);

    expect(respuesta.estado).toBe(201);
    if (!respuesta.cuerpo.ok) throw new Error(respuesta.cuerpo.errores.join(' '));

    const { radicado } = respuesta.cuerpo;
    expect(radicado).toMatch(/^PQRS-\d{8}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    // El pendiente desapareció y el archivo está bajo el radicado.
    expect([...almacenFalso.keys()].some((r) => r.startsWith('pqrs/pendientes/'))).toBe(false);
    expect(archivosDe(radicado)).toHaveLength(1);

    const registro = registroDe(radicado);
    expect(registro.adjuntos).toHaveLength(1);
    expect(registro.adjuntos[0].nombreOriginal).toBe(nombre);
    // El nombre almacenado es un UUID nuevo, nunca el original.
    expect(registro.adjuntos[0].nombreAlmacenado).not.toContain(nombre.split('.')[0]);
    expect(registro.adjuntos[0].tamano).toBe(bytes.length);
    // Nunca se guarda la IP en claro.
    expect(JSON.stringify(registro)).not.toContain('203.0.113.10');
    expect(registro.ipHashSalada).toBe(true);
  });

  it('manda los dos correos: al área de PQRS y a quien radica', async () => {
    const adjunto = sembrar('factura.pdf', PDF);
    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [adjunto] })), ENTORNO);

    expect(respuesta.estado).toBe(201);
    expect(correosEnviados).toHaveLength(2);
    expect(correosEnviados[0]!.to).toBe('pqrs@dstunja.com');
    expect(correosEnviados[1]!.to).toBe('persona@ejemplo.com');
    // El correo al área lleva el enlace firmado, no el archivo adjunto.
    expect(String(correosEnviados[0]!.html)).toContain('firmado=1');
    expect(correosEnviados[0]!.attachments).toBeUndefined();
  });

  it('radica sin adjuntos', async () => {
    const respuesta = await radicar(peticion(solicitudBase()), ENTORNO);
    expect(respuesta.estado).toBe(201);
    if (!respuesta.cuerpo.ok) throw new Error('debería haber radicado');
    expect(registroDe(respuesta.cuerpo.radicado).adjuntos).toEqual([]);
  });
});

describe('archivos que hay que rechazar', () => {
  it('rechaza un MIME falso: texto plano con extensión .pdf', async () => {
    const adjunto = sembrar('soporte.pdf', new TextEncoder().encode('esto no es un PDF'));
    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [adjunto] })), ENTORNO);

    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/no reconocemos el contenido/i);
    // Y el blob se borró: no se queda basura en el almacenamiento.
    expect(almacenFalso.size).toBe(0);
  });

  it('rechaza un PNG de verdad que se hace pasar por .pdf', async () => {
    const adjunto = sembrar('captura.pdf', PNG);
    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [adjunto] })), ENTORNO);

    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/no corresponde a la extensión/i);
  });

  it('rechaza un ZIP cualquiera renombrado a .docx', async () => {
    const adjunto = sembrar('trampa.docx', zipConEntrada('otra/cosa.txt', 'hola'));
    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [adjunto] })), ENTORNO);

    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/no corresponde a la extensión/i);
  });

  it('rechaza la doble extensión sospechosa', async () => {
    const adjunto = sembrar('factura.exe.pdf', PDF);
    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [adjunto] })), ENTORNO);

    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/doble extensión/i);
  });

  it('rechaza por tamaño aunque el navegador hubiera dicho otra cosa', async () => {
    const gordo = new Uint8Array(6 * 1024 * 1024);
    gordo.set(PNG, 0);
    const adjunto = sembrar('escaneo.png', gordo);
    // El cliente miente sobre el tamaño: el servidor mira el almacenamiento.
    adjunto.tamano = 1024;

    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [adjunto] })), ENTORNO);
    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/supera el máximo de 5 MB/i);
  });

  it('rechaza más de tres archivos', async () => {
    const adjuntos = [
      sembrar('a.png', PNG),
      sembrar('b.png', PNG),
      sembrar('c.png', PNG),
      sembrar('d.png', PNG),
    ];
    const respuesta = await radicar(peticion(solicitudBase({ adjuntos })), ENTORNO);

    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/Solo puedes adjuntar 3 archivos/i);
    expect(almacenFalso.size).toBe(0);
  });

  it('rechaza un blob que pertenece a la sesión de otra persona', async () => {
    const ajeno = sembrar('factura.pdf', PDF, '99999999-8888-4777-8666-555555555555');
    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [ajeno] })), ENTORNO);

    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/no pertenece a esta sesión/i);
    // El archivo de la otra sesión sigue donde estaba: no se toca lo ajeno.
    expect(almacenFalso.has(ajeno.pathname)).toBe(true);
  });
});

describe('el tipo de solicitud manda', () => {
  it('con Petición ignora los adjuntos, radica igual y los borra', async () => {
    const adjunto = sembrar('factura.pdf', PDF);
    const respuesta = await radicar(
      peticion(solicitudBase({ tipo: 'Petición', adjuntos: [adjunto] })),
      ENTORNO,
    );

    expect(respuesta.estado).toBe(201);
    if (!respuesta.cuerpo.ok) throw new Error(respuesta.cuerpo.errores.join(' '));

    const registro = registroDe(respuesta.cuerpo.radicado);
    expect(registro.adjuntos).toEqual([]);
    expect(registro.tipo).toBe('Petición');
    // El pendiente se borró en vez de quedarse colgado en el almacenamiento.
    expect(almacenFalso.has(adjunto.pathname)).toBe(false);
    expect(archivosDe(respuesta.cuerpo.radicado)).toHaveLength(0);
  });

  it.each(['Sugerencia', 'Felicitación'])('con %s tampoco guarda adjuntos', async (tipo) => {
    const adjunto = sembrar('foto.png', PNG);
    const respuesta = await radicar(peticion(solicitudBase({ tipo, adjuntos: [adjunto] })), ENTORNO);

    expect(respuesta.estado).toBe(201);
    if (!respuesta.cuerpo.ok) throw new Error('debería haber radicado');
    expect(registroDe(respuesta.cuerpo.radicado).adjuntos).toEqual([]);
    expect(almacenFalso.has(adjunto.pathname)).toBe(false);
  });

  it('con Reclamo sí guarda el adjunto', async () => {
    const adjunto = sembrar('foto.png', PNG);
    const respuesta = await radicar(
      peticion(solicitudBase({ tipo: 'Reclamo', adjuntos: [adjunto] })),
      ENTORNO,
    );

    expect(respuesta.estado).toBe(201);
    if (!respuesta.cuerpo.ok) throw new Error('debería haber radicado');
    expect(registroDe(respuesta.cuerpo.radicado).adjuntos).toHaveLength(1);
  });

  it('rechaza un tipo que no existe', async () => {
    const respuesta = await radicar(peticion(solicitudBase({ tipo: 'Denuncia' })), ENTORNO);
    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/tipo de solicitud/i);
  });
});

describe('Turnstile', () => {
  it('no radica si el token no es válido y borra lo subido', async () => {
    turnstileResponde(false);
    const adjunto = sembrar('factura.pdf', PDF);

    const respuesta = await radicar(peticion(solicitudBase({ adjuntos: [adjunto] })), ENTORNO);

    expect(respuesta.estado).toBe(403);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/antirrobots/i);
    expect(almacenFalso.size).toBe(0);
    expect(correosEnviados).toHaveLength(0);
  });

  it('no radica si falta el secreto en el servidor', async () => {
    const respuesta = await radicar(peticion(solicitudBase()), {
      ...ENTORNO,
      TURNSTILE_SECRET: undefined,
    });
    expect(respuesta.estado).toBe(403);
  });

  it('no radica si el formulario no manda token', async () => {
    const respuesta = await radicar(peticion(solicitudBase({ turnstileToken: '' })), ENTORNO);
    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/antirrobots/i);
  });
});

describe('campos del formulario', () => {
  it('exige la autorización de tratamiento de datos', async () => {
    const respuesta = await radicar(peticion(solicitudBase({ autorizacion: false })), ENTORNO);
    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/autorización/i);
  });

  it('junta todos los errores en una sola respuesta', async () => {
    const respuesta = await radicar(
      peticion(solicitudBase({ nombre: '', correo: 'no-es-correo', municipio: '' })),
      ENTORNO,
    );
    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.length).toBeGreaterThanOrEqual(3);
  });

  it('rechaza un sessionId con forma de ruta', async () => {
    const respuesta = await radicar(peticion(solicitudBase({ sessionId: '../../otra' })), ENTORNO);
    expect(respuesta.estado).toBe(400);
    if (respuesta.cuerpo.ok) throw new Error('no debería haber radicado');
    expect(respuesta.cuerpo.errores.join(' ')).toMatch(/sesión de subida/i);
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const rota = new Request('https://dstunja.com/api/pqrs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'esto no es json',
    });
    const respuesta = await radicar(rota, ENTORNO);
    expect(respuesta.estado).toBe(400);
  });
});

describe('límite de tasa', () => {
  it('corta a la sexta radicación desde la misma IP', async () => {
    for (let intento = 0; intento < 5; intento += 1) {
      const respuesta = await radicar(peticion(solicitudBase()), ENTORNO);
      expect(respuesta.estado).toBe(201);
    }
    const sexta = await radicar(peticion(solicitudBase()), ENTORNO);
    expect(sexta.estado).toBe(429);
  });

  it('no mezcla el contador entre IP distintas', async () => {
    for (let intento = 0; intento < 5; intento += 1) {
      await radicar(peticion(solicitudBase(), '198.51.100.7'), ENTORNO);
    }
    const otra = await radicar(peticion(solicitudBase(), '203.0.113.99'), ENTORNO);
    expect(otra.estado).toBe(201);
  });
});

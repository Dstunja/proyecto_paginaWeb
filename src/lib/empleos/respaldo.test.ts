/**
 * Pruebas de la red de seguridad de las postulaciones: qué pasa cuando el correo
 * a Talento Humano NO sale.
 *
 * Van en un archivo aparte de postular.test.ts porque aquí hace falta sustituir
 * el almacén de Vercel Blob (`src/lib/pqrs/almacen.ts`), y un `vi.mock` vale
 * para todo el archivo: mezclarlo con las pruebas del camino normal escondería
 * qué está simulado en cada caso.
 *
 * LO QUE SE COMPRUEBA AQUÍ es la promesa que da nombre a todo este trabajo: una
 * persona que llenó el formulario y adjuntó su hoja de vida no se queda sin
 * postular. Si Resend falla, la hoja de vida se guarda; si además el aviso con
 * enlace falla, la postulación sigue existiendo y el candidato recibe una
 * referencia con la que preguntar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const correosEnviados: Array<Record<string, unknown>> = [];
let respuestaResend: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: { message: 'Too many requests' },
};

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (mensaje: Record<string, unknown>) => {
        correosEnviados.push(mensaje);
        return respuestaResend;
      },
    };
  },
}));

/** Lo que se escribió en el Blob, por ruta. */
const blobEscrito = new Map<string, unknown>();
/** Si está puesto, el almacén falla con este mensaje. */
let falloAlmacen: string | null = null;

vi.mock('../pqrs/almacen', () => ({
  guardarBytes: async (ruta: string, bytes: Uint8Array) => {
    if (falloAlmacen) throw new Error(falloAlmacen);
    blobEscrito.set(ruta, bytes);
    return `https://blob.ejemplo/${ruta}`;
  },
  guardarJson: async (ruta: string, contenido: unknown) => {
    if (falloAlmacen) throw new Error(falloAlmacen);
    blobEscrito.set(ruta, contenido);
    return `https://blob.ejemplo/${ruta}`;
  },
}));

const { atenderPostulacion } = await import('./postular');
const { reiniciarMemoria } = await import('../pqrs/limite-tasa');

/** Con el token del store puesto, la red de seguridad existe. */
const ENTORNO_CON_BLOB = {
  TURNSTILE_SECRET: 'secreto-de-prueba',
  RESEND_API_KEY: 're_prueba',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_prueba',
};

/** Sin él, no: es el único camino que todavía pierde una postulación. */
const ENTORNO_SIN_BLOB = {
  TURNSTILE_SECRET: 'secreto-de-prueba',
  RESEND_API_KEY: 're_prueba',
};

/** Las pausas entre reintentos no se esperan de verdad. */
const SIN_ESPERA = async () => {};

const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);

function peticion(): Request {
  const formulario = new FormData();
  const valores: Record<string, string> = {
    nombre: 'Cristian Amaya',
    correo: 'practicaspasantiasdst@gmail.com',
    telefono: '310 623 2429',
    cargo: 'Vendedor TAT',
    experiencia: 'Dos años en ventas TAT en Tunja.',
    autorizacion: 'si',
    turnstileToken: 'token-valido',
  };
  for (const [clave, valor] of Object.entries(valores)) formulario.set(clave, valor);
  formulario.set(
    'hoja-de-vida',
    new File([new Uint8Array(PDF_MINIMO)], 'hoja de vida.pdf', { type: 'application/pdf' }),
  );
  return new Request('https://dstunja.com/api/empleos/postular', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.10' },
    body: formulario,
  });
}

/** El último correo enviado, que es el de respaldo cuando lo hay. */
function ultimoCorreo(): Record<string, unknown> {
  return correosEnviados[correosEnviados.length - 1]!;
}

function referencia(respuesta: Awaited<ReturnType<typeof atenderPostulacion>>): string | undefined {
  return respuesta.cuerpo.ok ? respuesta.cuerpo.referencia : undefined;
}

beforeEach(() => {
  correosEnviados.length = 0;
  blobEscrito.clear();
  falloAlmacen = null;
  respuestaResend = { data: null, error: { message: 'Too many requests' } };
  reiniciarMemoria();
  // Turnstile responde que sí: lo que se prueba aquí es el correo, no el reto.
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), {
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('el correo no sale y hay Blob', () => {
  it('la postulación se da por buena: 200, no 500', async () => {
    const respuesta = await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);
    expect(respuesta.estado).toBe(200);
    expect(respuesta.cuerpo.ok).toBe(true);
  });

  it('la hoja de vida queda guardada con sus bytes', async () => {
    await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);

    const rutas = [...blobEscrito.keys()];
    const rutaPdf = rutas.find((r) => r.endsWith('.pdf'));
    expect(rutaPdf).toMatch(/^empleos\/EMP-\d{8}-[A-Z2-9]{6}\/[0-9a-f-]{36}\.pdf$/);
    expect(Buffer.from(blobEscrito.get(rutaPdf!) as Uint8Array)).toEqual(PDF_MINIMO);
  });

  it('el registro guarda los datos del formulario y nada más', async () => {
    await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);

    const ruta = [...blobEscrito.keys()].find((r) => r.endsWith('registro.json'))!;
    const registro = blobEscrito.get(ruta) as Record<string, any>;

    expect(registro.candidato.nombre).toBe('Cristian Amaya');
    expect(registro.cargo).toBe('Vendedor TAT');
    expect(registro.autorizacionLey1581).toBe(true);
    expect(registro.verificada).toBe(true);

    // Ni la IP ni la huella del archivo entran en el registro.
    const serializado = JSON.stringify(registro);
    expect(serializado).not.toContain('203.0.113.10');
    expect(serializado).not.toContain('huella');
  });

  it('sale un segundo correo, sin adjunto y con el enlace de descarga', async () => {
    await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);

    const aviso = ultimoCorreo();
    expect(aviso.attachments).toBeUndefined();
    expect(String(aviso.text)).toContain('/api/empleos/descarga?');
    expect(String(aviso.text)).toContain('NO se pudo adjuntar');
  });

  it('el enlace va firmado y apunta al despliegue que atendió la petición', async () => {
    await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);

    const texto = String(ultimoCorreo().text);
    const enlace = /https:\/\/\S+\/api\/empleos\/descarga\?\S+/.exec(texto)?.[0] ?? '';
    const url = new URL(enlace);

    expect(url.origin).toBe('https://dstunja.com');
    expect(url.searchParams.get('ruta')).toMatch(/^empleos\/EMP-/);
    expect(url.searchParams.get('firma')).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(url.searchParams.get('vence'))).toBeGreaterThan(Date.now());
  });

  it('el correo de respaldo nombra el identificador, para poder buscarla', async () => {
    await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);
    expect(String(ultimoCorreo().text)).toMatch(/EMP-\d{8}-[A-Z2-9]{6}/);
  });

  /*
   * El candidato solo ve una referencia cuando NADIE se ha enterado todavia de
   * su postulacion. Si el aviso con enlace salio, Talento Humano ya la tiene y
   * darle un codigo que citar solo lo preocuparia.
   */
  it('si el aviso con enlace sale, no se le da referencia al candidato', async () => {
    let intentos = 0;
    const original = correosEnviados.push.bind(correosEnviados);
    correosEnviados.push = ((mensaje: Record<string, unknown>) => {
      intentos += 1;
      // Los tres primeros (con adjunto) fallan; el cuarto (con enlace) pasa.
      if (intentos === 4) respuestaResend = { data: { id: 'ok' }, error: null };
      return original(mensaje);
    }) as typeof correosEnviados.push;

    const respuesta = await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);
    correosEnviados.push = original;

    expect(respuesta.estado).toBe(200);
    expect(referencia(respuesta)).toBeUndefined();
  });

  it('si tampoco sale el aviso, el candidato recibe la referencia', async () => {
    const respuesta = await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);
    expect(respuesta.estado).toBe(200);
    expect(referencia(respuesta)).toMatch(/^EMP-\d{8}-[A-Z2-9]{6}$/);
  });
});

describe('el correo no sale y no hay dónde guardar', () => {
  it('sin BLOB_READ_WRITE_TOKEN → 500, que es el único caso que pierde datos', async () => {
    const respuesta = await atenderPostulacion(peticion(), ENTORNO_SIN_BLOB, SIN_ESPERA);
    expect(respuesta.estado).toBe(500);
    expect(blobEscrito.size).toBe(0);
  });

  it('si el almacén falla al escribir → 500', async () => {
    falloAlmacen = 'store lleno';
    const respuesta = await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);
    expect(respuesta.estado).toBe(500);
  });

  it('el motivo técnico no viaja al navegador', async () => {
    falloAlmacen = 'store lleno';
    const respuesta = await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);
    expect(JSON.stringify(respuesta.cuerpo)).not.toContain('store lleno');
    expect(JSON.stringify(respuesta.cuerpo)).not.toContain('Too many requests');
  });
});

describe('cuando el correo sí sale', () => {
  it('no se escribe nada en el Blob', async () => {
    respuestaResend = { data: { id: 'correo-de-prueba' }, error: null };
    const respuesta = await atenderPostulacion(peticion(), ENTORNO_CON_BLOB, SIN_ESPERA);

    expect(respuesta.estado).toBe(200);
    expect(blobEscrito.size).toBe(0);
    expect(correosEnviados).toHaveLength(1);
    expect(referencia(respuesta)).toBeUndefined();
  });
});

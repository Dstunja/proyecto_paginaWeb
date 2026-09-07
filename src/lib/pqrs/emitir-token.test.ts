/**
 * Pruebas de POST /api/pqrs/token (src/lib/pqrs/emitir-token.ts).
 *
 * Hay una prueba por cada código de error que puede salir, porque el fallo que
 * las motivó fue justo ese: el endpoint respondía 400 a TODO —incluida la falta
 * de `BLOB_READ_WRITE_TOKEN`— y `@vercel/blob`, que solo mira si la respuesta es
 * 2xx, enseñaba siempre "Failed to retrieve the client token". Con un 400 para
 * todo no hay forma de que el formulario diga nada útil, así que lo que estas
 * pruebas cuidan de verdad es que cada motivo salga con SU código.
 *
 * Turnstile se sustituye por un `fetch` simulado: las pruebas no salen a la red.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitirToken, variablesQueFaltan } from './emitir-token';
import type { Entorno } from './config';

const SESSION = '11111111-2222-4333-8444-555555555555';

/**
 * Token con la forma que exige el SDK: `vercel_blob_rw_<storeId>_<secreto>`.
 * No es válido contra Vercel, pero sí para firmar en local, que es lo único
 * que hace `handleUpload` al generar el permiso.
 */
const BLOB_FALSO = 'vercel_blob_rw_STORE123_abcdefghijklmnopqrstuvwx';

const ENTORNO_COMPLETO: Entorno = {
  BLOB_READ_WRITE_TOKEN: BLOB_FALSO,
  TURNSTILE_SECRET: 'secreto-de-prueba',
};

/** El cuerpo exacto que manda @vercel/blob al pedir el token. */
function eventoSdk(carga: Record<string, unknown>, ruta?: string) {
  return {
    type: 'blob.generate-client-token',
    payload: {
      pathname: ruta ?? `pqrs/pendientes/${SESSION}/${crypto.randomUUID()}.docx`,
      clientPayload: JSON.stringify(carga),
      multipart: false,
    },
  };
}

function peticion(cuerpo: unknown, { comoTexto = false } = {}) {
  return new Request('https://ejemplo.test/api/pqrs/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: comoTexto ? (cuerpo as string) : JSON.stringify(cuerpo),
  });
}

const CARGA_VALIDA = { sessionId: SESSION, tipo: 'Queja', turnstileToken: 'token-del-widget' };

/** Turnstile responde lo que se le diga, sin salir a la red. */
function simularTurnstile(exito: boolean, codigos: string[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ success: exito, 'error-codes': codigos }), { status: 200 }),
    ),
  );
}

beforeEach(() => {
  simularTurnstile(true);
  // El límite de tasa sin Upstash cuenta en memoria del proceso; cada prueba
  // usa una IP distinta más abajo cuando necesita no compartir contador.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('emitirToken', () => {
  it('200: firma el permiso cuando todo está en orden', async () => {
    const { estado, cuerpo } = await emitirToken(peticion(eventoSdk(CARGA_VALIDA)), ENTORNO_COMPLETO);

    expect(estado).toBe(200);
    const datos = cuerpo as { type: string; clientToken: string };
    expect(datos.type).toBe('blob.generate-client-token');
    // El SDK del navegador busca exactamente esta clave.
    expect(datos.clientToken).toMatch(/^vercel_blob_client_STORE123_/);
  });

  it('500 config-incompleta: falta BLOB_READ_WRITE_TOKEN', async () => {
    const { estado, cuerpo } = await emitirToken(peticion(eventoSdk(CARGA_VALIDA)), {
      TURNSTILE_SECRET: 'secreto-de-prueba',
    });

    expect(estado).toBe(500);
    expect(cuerpo).toEqual({
      ok: false,
      codigo: 'config-incompleta',
      mensaje: 'El servicio de adjuntos no está configurado. Contacta al administrador del sitio.',
    });
  });

  it('500 config-incompleta: falta TURNSTILE_SECRET (no se deja pasar)', async () => {
    const { estado, cuerpo } = await emitirToken(peticion(eventoSdk(CARGA_VALIDA)), {
      BLOB_READ_WRITE_TOKEN: BLOB_FALSO,
    });

    expect(estado).toBe(500);
    expect((cuerpo as { codigo: string }).codigo).toBe('config-incompleta');
  });

  it('500: el mensaje no filtra el valor de ninguna variable', async () => {
    const { cuerpo } = await emitirToken(peticion(eventoSdk(CARGA_VALIDA)), {
      BLOB_READ_WRITE_TOKEN: 'secreto-que-no-debe-salir',
      // Falta TURNSTILE_SECRET, así que responde 500.
    });

    const texto = JSON.stringify(cuerpo);
    expect(texto).not.toContain('secreto-que-no-debe-salir');
    expect(texto).not.toContain('BLOB_READ_WRITE_TOKEN');
  });

  it('400 cuerpo-invalido: el cuerpo no es JSON', async () => {
    const { estado, cuerpo } = await emitirToken(
      peticion('esto no es json {{{', { comoTexto: true }),
      ENTORNO_COMPLETO,
    );

    expect(estado).toBe(400);
    expect((cuerpo as { codigo: string }).codigo).toBe('cuerpo-invalido');
  });

  it('400 cuerpo-invalido: el evento no es uno que el SDK reconozca', async () => {
    const { estado, cuerpo } = await emitirToken(peticion({ hola: 'mundo' }), ENTORNO_COMPLETO);

    expect(estado).toBe(400);
    expect((cuerpo as { codigo: string }).codigo).toBe('cuerpo-invalido');
  });

  it('400 cuerpo-invalido: el clientPayload no es JSON', async () => {
    const evento = {
      type: 'blob.generate-client-token',
      payload: {
        pathname: `pqrs/pendientes/${SESSION}/x.pdf`,
        clientPayload: 'no-es-json',
        multipart: false,
      },
    };

    const { estado, cuerpo } = await emitirToken(peticion(evento), ENTORNO_COMPLETO);

    expect(estado).toBe(400);
    expect((cuerpo as { codigo: string }).codigo).toBe('cuerpo-invalido');
  });

  it('400 sesion-invalida: el sessionId no tiene forma de UUID', async () => {
    const evento = eventoSdk({ ...CARGA_VALIDA, sessionId: '../otra-sesion' }, 'pqrs/pendientes/x.pdf');

    const { estado, cuerpo } = await emitirToken(peticion(evento), ENTORNO_COMPLETO);

    expect(estado).toBe(400);
    expect((cuerpo as { codigo: string }).codigo).toBe('sesion-invalida');
  });

  it('400 ruta-ajena: la ruta pedida es la carpeta de otra sesión', async () => {
    const otra = '99999999-8888-4777-8666-555555555555';
    const evento = eventoSdk(CARGA_VALIDA, `pqrs/pendientes/${otra}/robado.pdf`);

    const { estado, cuerpo } = await emitirToken(peticion(evento), ENTORNO_COMPLETO);

    expect(estado).toBe(400);
    expect((cuerpo as { codigo: string }).codigo).toBe('ruta-ajena');
  });

  it('422 tipo-sin-soporte: una Petición no admite adjuntos', async () => {
    const evento = eventoSdk({ ...CARGA_VALIDA, tipo: 'Petición' });

    const { estado, cuerpo } = await emitirToken(peticion(evento), ENTORNO_COMPLETO);

    expect(estado).toBe(422);
    expect(cuerpo).toEqual({
      ok: false,
      codigo: 'tipo-sin-soporte',
      mensaje: 'Este tipo de solicitud no admite archivos de soporte.',
    });
  });

  it('422 tipo-sin-soporte: el tipo no viaja en el clientPayload', async () => {
    const { tipo, ...sinTipo } = CARGA_VALIDA;
    void tipo;

    const { estado, cuerpo } = await emitirToken(peticion(eventoSdk(sinTipo)), ENTORNO_COMPLETO);

    expect(estado).toBe(422);
    expect((cuerpo as { codigo: string }).codigo).toBe('tipo-sin-soporte');
  });

  it('422: "Reclamo" sí admite adjuntos, y se compara sin tildes ni mayúsculas', async () => {
    const evento = eventoSdk({ ...CARGA_VALIDA, tipo: 'RECLAMO' });

    const { estado } = await emitirToken(peticion(evento), ENTORNO_COMPLETO);

    expect(estado).toBe(200);
  });

  it('415 archivo-no-permitido: la extensión no está en la lista', async () => {
    const evento = eventoSdk(CARGA_VALIDA, `pqrs/pendientes/${SESSION}/virus.exe`);

    const { estado, cuerpo } = await emitirToken(peticion(evento), ENTORNO_COMPLETO);

    expect(estado).toBe(415);
    expect((cuerpo as { mensaje: string }).mensaje).toContain('no está permitido');
  });

  it('415 archivo-no-permitido: sin extensión tampoco vale', async () => {
    const evento = eventoSdk(CARGA_VALIDA, `pqrs/pendientes/${SESSION}/sin-extension`);

    const { estado } = await emitirToken(peticion(evento), ENTORNO_COMPLETO);

    expect(estado).toBe(415);
  });

  it('403 antirrobots: Cloudflare rechaza el token', async () => {
    simularTurnstile(false, ['invalid-input-response']);

    const { estado, cuerpo } = await emitirToken(peticion(eventoSdk(CARGA_VALIDA)), ENTORNO_COMPLETO);

    expect(estado).toBe(403);
    expect(cuerpo).toEqual({
      ok: false,
      codigo: 'antirrobots',
      mensaje: 'No se pudo verificar que no eres un robot. Recarga la página e inténtalo de nuevo.',
    });
  });

  it('403 antirrobots: el token de Turnstile no viaja en el clientPayload', async () => {
    const { turnstileToken, ...sinToken } = CARGA_VALIDA;
    void turnstileToken;

    const { estado, cuerpo } = await emitirToken(peticion(eventoSdk(sinToken)), ENTORNO_COMPLETO);

    expect(estado).toBe(403);
    expect((cuerpo as { codigo: string }).codigo).toBe('antirrobots');
  });

  it('403: reutilizar un token de Turnstile no cuela', async () => {
    // Es el código que devuelve Cloudflare cuando el token ya se gastó: cada
    // archivo necesita uno nuevo del widget.
    simularTurnstile(false, ['timeout-or-duplicate']);

    const { estado } = await emitirToken(peticion(eventoSdk(CARGA_VALIDA)), ENTORNO_COMPLETO);

    expect(estado).toBe(403);
  });

  it('429 demasiadas-peticiones: al pasar del tope por IP', async () => {
    // El contador va por IP; esta prueba usa una propia para no arrastrar el
    // gasto de las demás.
    const suya = () =>
      new Request('https://ejemplo.test/api/pqrs/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.42' },
        body: JSON.stringify(eventoSdk(CARGA_VALIDA)),
      });

    const estados: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      estados.push((await emitirToken(suya(), ENTORNO_COMPLETO)).estado);
    }

    expect(estados.slice(0, 20).every((e) => e === 200)).toBe(true);
    expect(estados[20]).toBe(429);
  });

  it('el orden deja diagnosticar sin gastar un token de Turnstile bueno', async () => {
    // Con el token vacío, un tipo que no admite adjuntos sigue respondiendo 422
    // y no 403: es lo que permite al formulario repreguntar el motivo real.
    const evento = eventoSdk({ sessionId: SESSION, tipo: 'Petición', turnstileToken: '' });

    const { estado } = await emitirToken(peticion(evento), ENTORNO_COMPLETO);

    expect(estado).toBe(422);
  });
});

describe('variablesQueFaltan', () => {
  it('no da por buena una variable vacía o de solo espacios', () => {
    expect(variablesQueFaltan({ BLOB_READ_WRITE_TOKEN: '', TURNSTILE_SECRET: '   ' })).toEqual([
      'BLOB_READ_WRITE_TOKEN',
      'TURNSTILE_SECRET',
    ]);
  });

  it('no devuelve nada cuando están las dos', () => {
    expect(variablesQueFaltan(ENTORNO_COMPLETO)).toEqual([]);
  });
});

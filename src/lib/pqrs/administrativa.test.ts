/**
 * Pruebas de POST /api/pqrs/administrativa (src/lib/pqrs/administrativa.ts).
 *
 * Es el formulario corto del bloque administrativo: manda un recado por Resend
 * y no radica nada. Aquí se comprueba el servidor —qué acepta, qué rechaza y
 * qué acaba en el correo—; lo que se ve en pantalla se prueba con un navegador
 * de verdad en scripts/verificar-pqrs.mjs.
 *
 * Resend se sustituye por un doble que apunta cada mensaje en `correosEnviados`,
 * igual que en radicar.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const correosEnviados: Array<Record<string, unknown>> = [];
/** Lo que devuelve el doble de Resend. Se cambia para probar el fallo. */
let respuestaResend: { data: unknown; error: { message: string } | null } = {
  data: { id: 'correo-de-prueba' },
  error: null,
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

const { atenderAdministrativa, validarAdministrativa } = await import('./administrativa');
const { reiniciarMemoria } = await import('./limite-tasa');

const ENTORNO = {
  TURNSTILE_SECRET: 'secreto-de-prueba',
  RESEND_API_KEY: 're_prueba',
  PQRS_DESTINO: 'informacioncomercialdst@gmail.com',
};

function peticion(cuerpo: unknown, ip = '203.0.113.10') {
  return new Request('https://dstunja.com/api/pqrs/administrativa', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(cuerpo),
  });
}

function solicitudBase(extra: Record<string, unknown> = {}) {
  return {
    nombre: 'Cristian Amaya',
    telefono: '3106232429',
    correo: 'practicaspasantiasdst@gmail.com',
    mensaje: 'Necesito una copia de la factura 12345 del mes pasado.',
    turnstileToken: 'token-valido',
    ...extra,
  };
}

function turnstileResponde(exito: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: exito,
            'error-codes': exito ? [] : ['invalid-input-response'],
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    ),
  );
}

beforeEach(() => {
  correosEnviados.length = 0;
  respuestaResend = { data: { id: 'correo-de-prueba' }, error: null };
  reiniciarMemoria();
  turnstileResponde(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Camino feliz ------------------------------------------------------------

describe('envío válido', () => {
  it('responde 200 y manda UN correo al buzón de PQRS_DESTINO', async () => {
    const respuesta = await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);

    expect(respuesta.estado).toBe(200);
    expect(respuesta.cuerpo).toEqual({ ok: true });
    expect(correosEnviados).toHaveLength(1);
    expect(correosEnviados[0]!.to).toBe('informacioncomercialdst@gmail.com');
  });

  it('el asunto nombra la solicitud y a quien escribe', async () => {
    await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);
    expect(correosEnviados[0]!.subject).toBe('Solicitud administrativa · Cristian Amaya');
  });

  /*
   * Es lo que separa este correo del de una radicación en la bandeja: sin el
   * asunto distinto, un filtro no puede distinguir un recado de una PQRS
   * comercial, que sí lleva plazo legal de respuesta.
   */
  it('el asunto NO se parece al de una radicación comercial', async () => {
    await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);
    expect(String(correosEnviados[0]!.subject)).not.toMatch(/PQRS Comercial|^\[PQRS-/);
  });

  it('responder desde la bandeja va a quien escribió', async () => {
    await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);
    expect(correosEnviados[0]!.replyTo).toBe('practicaspasantiasdst@gmail.com');
  });

  it('el cuerpo lleva el nombre, el teléfono y el mensaje', async () => {
    await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);
    const texto = String(correosEnviados[0]!.text);
    expect(texto).toContain('Cristian Amaya');
    expect(texto).toContain('3106232429');
    expect(texto).toContain('Necesito una copia de la factura 12345');
  });

  /*
   * Esto no radica, así que ni la respuesta ni el correo pueden dar a entender
   * que hay un número de seguimiento: quien lo recibiera se quedaría esperando
   * una constancia que nadie generó.
   */
  it('ni la respuesta ni el correo prometen un radicado', async () => {
    const respuesta = await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);

    expect(respuesta.cuerpo).not.toHaveProperty('radicado');
    expect(String(correosEnviados[0]!.text)).toContain('NO tiene número de radicado');
  });
});

// --- El correo es opcional ---------------------------------------------------

describe('el correo de quien escribe es opcional', () => {
  it('se acepta sin correo', async () => {
    const respuesta = await atenderAdministrativa(
      peticion(solicitudBase({ correo: '' })),
      ENTORNO,
    );
    expect(respuesta.estado).toBe(200);
    expect(correosEnviados).toHaveLength(1);
  });

  /*
   * Sin dirección no se pone `replyTo`: dejarlo vacío haría que responder desde
   * la bandeja fuera a parar al remitente del propio sitio.
   */
  it('sin correo no se pone replyTo', async () => {
    await atenderAdministrativa(peticion(solicitudBase({ correo: '' })), ENTORNO);
    expect(correosEnviados[0]).not.toHaveProperty('replyTo');
  });

  it('se dice en el correo que no dejó dirección', async () => {
    await atenderAdministrativa(peticion(solicitudBase({ correo: '' })), ENTORNO);
    expect(String(correosEnviados[0]!.text)).toContain('(no lo dejó)');
  });

  it('pero si escribe algo, tiene que ser un correo válido', async () => {
    const respuesta = await atenderAdministrativa(
      peticion(solicitudBase({ correo: 'esto-no-es-un-correo' })),
      ENTORNO,
    );
    expect(respuesta.estado).toBe(400);
    expect(correosEnviados).toHaveLength(0);
  });
});

// --- Lo que se rechaza -------------------------------------------------------

describe('campos obligatorios', () => {
  const casos: Array<[string, Record<string, unknown>]> = [
    ['sin nombre', { nombre: '' }],
    ['con un nombre de dos letras', { nombre: 'Ab' }],
    ['sin teléfono', { telefono: '' }],
    ['con un teléfono de cinco dígitos', { telefono: '12345' }],
    ['sin mensaje', { mensaje: '' }],
    ['con un mensaje de tres letras', { mensaje: 'hola' }],
    ['con un mensaje larguísimo', { mensaje: 'x'.repeat(1501) }],
  ];

  it.each(casos)('rechaza %s con 400 y sin mandar correo', async (_etiqueta, extra) => {
    const respuesta = await atenderAdministrativa(peticion(solicitudBase(extra)), ENTORNO);
    expect(respuesta.estado).toBe(400);
    expect(correosEnviados).toHaveLength(0);
  });

  it('devuelve TODOS los errores, no solo el primero', () => {
    const resultado = validarAdministrativa({ nombre: '', telefono: '', mensaje: '' });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.errores.length).toBeGreaterThanOrEqual(3);
  });

  it('un cuerpo que no es JSON válido da 400', async () => {
    const peticionRota = new Request('https://dstunja.com/api/pqrs/administrativa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'esto no es json',
    });
    const respuesta = await atenderAdministrativa(peticionRota, ENTORNO);
    expect(respuesta.estado).toBe(400);
  });

  /* El teléfono con indicativo no puede contar como si tuviera dos dígitos de más. */
  it('acepta el teléfono escrito con indicativo y con espacios', async () => {
    const respuesta = await atenderAdministrativa(
      peticion(solicitudBase({ telefono: '+57 310 623 2429' })),
      ENTORNO,
    );
    expect(respuesta.estado).toBe(200);
  });
});

// --- Antirrobots -------------------------------------------------------------

describe('Turnstile', () => {
  it('un token que Cloudflare rechaza da 403 y no manda correo', async () => {
    turnstileResponde(false);
    const respuesta = await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);

    expect(respuesta.estado).toBe(403);
    expect(correosEnviados).toHaveLength(0);
  });

  it('sin token tampoco pasa', async () => {
    const respuesta = await atenderAdministrativa(
      peticion(solicitudBase({ turnstileToken: '' })),
      ENTORNO,
    );
    expect(respuesta.estado).toBe(403);
    expect(correosEnviados).toHaveLength(0);
  });

  /*
   * Falla CERRADO: sin secreto configurado no se manda nada. Dejar pasar cuando
   * falta la configuración es la forma habitual de publicar un formulario sin
   * protección sin enterarse.
   */
  it('sin TURNSTILE_SECRET en el servidor no se manda nada', async () => {
    const respuesta = await atenderAdministrativa(peticion(solicitudBase()), {
      ...ENTORNO,
      TURNSTILE_SECRET: undefined,
    });
    expect(respuesta.estado).toBe(403);
    expect(correosEnviados).toHaveLength(0);
  });
});

// --- Configuración incompleta ------------------------------------------------

describe('cuando el correo no puede salir', () => {
  /*
   * 500 y no 200: aquí no hay registro en el Blob que dé fe de nada, así que si
   * el correo no sale no queda NADA. Con el 500 el navegador cae al `mailto:` y
   * la persona sí consigue escribirnos.
   */
  it('sin PQRS_DESTINO responde 500', async () => {
    const respuesta = await atenderAdministrativa(peticion(solicitudBase()), {
      ...ENTORNO,
      PQRS_DESTINO: undefined,
    });
    expect(respuesta.estado).toBe(500);
  });

  it('sin RESEND_API_KEY responde 500', async () => {
    const respuesta = await atenderAdministrativa(peticion(solicitudBase()), {
      ...ENTORNO,
      RESEND_API_KEY: undefined,
    });
    expect(respuesta.estado).toBe(500);
  });

  it('si Resend devuelve error responde 500', async () => {
    respuestaResend = { data: null, error: { message: 'dominio sin verificar' } };
    const respuesta = await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);
    expect(respuesta.estado).toBe(500);
  });

  /* El motivo técnico se queda en el registro del servidor, no viaja al navegador. */
  it('el motivo técnico no viaja en la respuesta', async () => {
    respuestaResend = { data: null, error: { message: 'dominio sin verificar' } };
    const respuesta = await atenderAdministrativa(peticion(solicitudBase()), ENTORNO);
    expect(JSON.stringify(respuesta.cuerpo)).not.toContain('dominio sin verificar');
  });
});

// --- Límite de tasa ----------------------------------------------------------

describe('límite de tasa', () => {
  it('a la sexta desde la misma IP responde 429', async () => {
    for (let i = 0; i < 5; i++) {
      const ok = await atenderAdministrativa(peticion(solicitudBase(), '198.51.100.7'), ENTORNO);
      expect(ok.estado).toBe(200);
    }
    const sexta = await atenderAdministrativa(peticion(solicitudBase(), '198.51.100.7'), ENTORNO);
    expect(sexta.estado).toBe(429);
    expect(correosEnviados).toHaveLength(5);
  });

  it('otra IP no arrastra el límite de la primera', async () => {
    for (let i = 0; i < 6; i++) {
      await atenderAdministrativa(peticion(solicitudBase(), '198.51.100.8'), ENTORNO);
    }
    const otra = await atenderAdministrativa(peticion(solicitudBase(), '198.51.100.9'), ENTORNO);
    expect(otra.estado).toBe(200);
  });
});

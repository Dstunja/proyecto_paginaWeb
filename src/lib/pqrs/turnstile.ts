/**
 * Comprobación antirrobots con Cloudflare Turnstile.
 *
 * Se verifica en los DOS endpoints, no solo en el de radicación: sin eso,
 * /api/pqrs/token quedaría abierto para que cualquiera pida tokens de subida y
 * llene el store de basura, que es lo que de verdad cuesta dinero.
 *
 * Un token de Turnstile es de un solo uso. Como el formulario llama primero a
 * /api/pqrs/token (una vez por archivo) y luego a /api/pqrs, el navegador tiene
 * que pedir un token nuevo al widget antes de cada llamada; de eso se encarga
 * `src/components/Turnstile.astro`.
 */
import type { Entorno } from './config';

const URL_VERIFICACION = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface ResultadoTurnstile {
  ok: boolean;
  /** Mensaje en español, listo para mostrar. */
  error?: string;
  /** Códigos que devolvió Cloudflare, para el registro del servidor. */
  codigos?: string[];
}

/**
 * Fallo cerrado a propósito: si no hay `TURNSTILE_SECRET` configurado, no se
 * radica. Dejar pasar cuando falta la configuración es la forma habitual de
 * publicar un formulario sin protección sin enterarse.
 *
 * Para desarrollo local, Cloudflare publica claves de prueba que siempre pasan:
 *   PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
 *   TURNSTILE_SECRET=1x0000000000000000000000000000000AA
 */
export async function verificarTurnstile(
  token: string,
  ip: string,
  env: Entorno,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoTurnstile> {
  const secreto = env.TURNSTILE_SECRET;
  if (!secreto) {
    return {
      ok: false,
      error: 'La comprobación antirrobots no está configurada en el servidor.',
      codigos: ['falta-secreto'],
    };
  }

  if (!token) {
    return { ok: false, error: 'Falta la comprobación antirrobots.', codigos: ['falta-token'] };
  }

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  // Cloudflare admite la IP para afinar el análisis, pero no la exige. Si viene
  // como "desconocida" es mejor no mandarla que mandar un valor inventado.
  if (ip && ip !== 'desconocida') cuerpo.set('remoteip', ip);

  let respuesta: Response;
  try {
    respuesta = await fetchImpl(URL_VERIFICACION, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
    });
  } catch {
    return {
      ok: false,
      error: 'No pudimos comprobar el antirrobots. Revisa tu conexión e inténtalo de nuevo.',
      codigos: ['sin-red'],
    };
  }

  if (!respuesta.ok) {
    return { ok: false, error: 'No pudimos comprobar el antirrobots.', codigos: ['http-' + respuesta.status] };
  }

  const datos = (await respuesta.json()) as { success?: boolean; 'error-codes'?: string[] };
  if (datos.success === true) return { ok: true };

  return {
    ok: false,
    error: 'La comprobación antirrobots no pasó. Recarga la página e inténtalo de nuevo.',
    codigos: datos['error-codes'] ?? ['desconocido'],
  };
}

/**
 * POST /api/pqrs/administrativa — manda al equipo un recado del bloque
 * administrativo de la página de PQRS.
 *
 * No radica nada: no genera número, no guarda en el Blob y no admite adjuntos.
 * El trabajo de verdad —validar, limitar, comprobar Turnstile y mandar el
 * correo— está en src/lib/pqrs/administrativa.ts, separado para poder probarlo.
 *
 * Como toda función de este proyecto, SOLO existe en Vercel. En el espejo de
 * GitHub Pages esta ruta devuelve HTML en vez de JSON y el navegador lo detecta
 * y cae al `mailto:`.
 */
import type { APIRoute } from 'astro';
import { atenderAdministrativa } from '../../../lib/pqrs/administrativa';
import type { Entorno } from '../../../lib/pqrs/config';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { estado, cuerpo } = await atenderAdministrativa(request, process.env as Entorno);
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};

/** Cualquier otro método sobre esta ruta es un error, no un 404 confuso. */
export const ALL: APIRoute = () =>
  new Response(JSON.stringify({ ok: false, errores: ['Método no permitido.'] }), {
    status: 405,
    headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST' },
  });

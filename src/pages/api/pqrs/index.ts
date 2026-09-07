/**
 * POST /api/pqrs — radica la solicitud.
 *
 * Recibe JSON (no multipart): los archivos ya están en el Blob, subidos desde
 * el navegador con el token de /api/pqrs/token. Aquí llegan solo sus rutas, y
 * el trabajo de verdad —descargar cada blob, comprobar sus bytes mágicos,
 * moverlo a su carpeta definitiva y avisar por correo— está en
 * src/lib/pqrs/radicar.ts, separado para poder probarlo.
 */
import type { APIRoute } from 'astro';
import { radicar } from '../../../lib/pqrs/radicar';
import type { Entorno } from '../../../lib/pqrs/config';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { estado, cuerpo } = await radicar(request, process.env as Entorno);
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Una radicación no se cachea nunca, ni en el navegador ni en el CDN.
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

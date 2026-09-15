/**
 * POST /api/empleos/postular — manda a Talento Humano la postulación del
 * formulario de /empleos/, con la hoja de vida adjunta.
 *
 * Recibe multipart/form-data (los campos de texto y el archivo), no JSON: aquí
 * el archivo sí pasa por la función, porque no hay que guardarlo en ningún
 * sitio. El trabajo de verdad —validar, limitar por IP, comprobar Turnstile y
 * mandar el correo— está en src/lib/empleos/postular.ts, separado para poder
 * probarlo.
 *
 * Como toda función de este proyecto, SOLO existe en Vercel. En el espejo de
 * GitHub Pages esta ruta devuelve HTML en vez de JSON y el navegador lo detecta
 * y cae al `mailto:`, pidiendo que la hoja de vida se adjunte a ese correo.
 */
import type { APIRoute } from 'astro';
import type { Entorno } from '../../../lib/empleos/config';
import { atenderPostulacion } from '../../../lib/empleos/postular';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { estado, cuerpo } = await atenderPostulacion(request, process.env as Entorno);
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

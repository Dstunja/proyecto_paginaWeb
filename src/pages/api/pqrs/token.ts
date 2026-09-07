/**
 * POST /api/pqrs/token — permiso para subir un soporte directamente al Blob.
 *
 * POR QUÉ NO SE SUBE POR AQUÍ. Una función de Vercel rechaza cuerpos de más de
 * 4,5 MB, y el tope por archivo es 5 MB: un PDF grande nunca llegaría. Así que
 * el archivo va del navegador a Vercel Blob sin pasar por la función, y lo
 * único que hace este endpoint es firmar un permiso acotado (`handleUpload`).
 *
 * El permiso que se firma restringe tipo de contenido, tamaño y ruta. Aun así,
 * el `Content-Type` que valida Blob es el que declara el navegador: la
 * comprobación seria (bytes mágicos) la hace /api/pqrs al descargar el blob.
 * Este token es la primera puerta, no la única.
 *
 * El trabajo está en src/lib/pqrs/emitir-token.ts, separado para poder
 * probarlo; aquí solo queda el envoltorio HTTP.
 */
import type { APIRoute } from 'astro';
import { emitirToken } from '../../../lib/pqrs/emitir-token';
import type { Entorno } from '../../../lib/pqrs/config';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { estado, cuerpo } = await emitirToken(request, process.env as Entorno);
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Un permiso de subida no se cachea nunca, ni en el navegador ni en el CDN.
      'cache-control': 'no-store',
    },
  });
};

/** Cualquier otro método sobre esta ruta es un error, no un 404 confuso. */
export const ALL: APIRoute = () =>
  new Response(
    JSON.stringify({
      ok: false,
      codigo: 'cuerpo-invalido',
      mensaje: 'Método no permitido.',
    }),
    {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST' },
    },
  );

/**
 * GET /api/empleos/descarga — abre una hoja de vida puesta a salvo en el Blob.
 *
 * Solo aparece en el correo de aviso que sale cuando el adjunto no se pudo
 * mandar (ver src/lib/empleos/correo.ts). El store es privado, así que el correo
 * no puede llevar la URL del archivo: lleva un enlace a esta función, firmado y
 * con caducidad, y aquí se comprueba y se redirige a una URL firmada de Blob de
 * vida corta.
 *
 * La máquina es la misma de PQRS (src/lib/pqrs/descarga.ts); lo único propio es
 * el validador de rutas: `esRutaEmpleos` admite `empleos/EMP-…/<uuid>.<ext>` y
 * nada más. Ni `registro.json`, que tiene los datos de contacto del candidato,
 * ni ninguna ruta de PQRS, aunque la firma fuera válida.
 */
import type { APIRoute } from 'astro';
import type { Entorno } from '../../../lib/pqrs/config';
import { atenderDescarga, esRutaEmpleos } from '../../../lib/pqrs/descarga';

export const prerender = false;

export const GET: APIRoute = ({ request }) =>
  atenderDescarga(request, process.env as Entorno, esRutaEmpleos);

/** Cualquier otro método sobre esta ruta es un error, no un 404 confuso. */
export const ALL: APIRoute = () =>
  new Response('Método no permitido.', {
    status: 405,
    headers: { 'content-type': 'text/plain; charset=utf-8', allow: 'GET' },
  });

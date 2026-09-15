/**
 * GET /api/pqrs/descarga — abre un soporte de una PQRS desde el correo al área.
 *
 * El store de Blob es privado, así que el correo no puede llevar la URL del
 * archivo. Lleva un enlace a esta función, firmado y con caducidad de 7 días;
 * aquí se comprueba y se redirige a una URL firmada de Blob que dura minutos.
 * El trabajo está en src/lib/pqrs/descarga.ts, separado para poder probarlo.
 */
import type { APIRoute } from 'astro';
import type { Entorno } from '../../../lib/pqrs/config';
import { atenderDescarga } from '../../../lib/pqrs/descarga';

export const prerender = false;

export const GET: APIRoute = ({ request }) => atenderDescarga(request, process.env as Entorno);

/** Cualquier otro método sobre esta ruta es un error, no un 404 confuso. */
export const ALL: APIRoute = () =>
  new Response('Método no permitido.', {
    status: 405,
    headers: { 'content-type': 'text/plain; charset=utf-8', allow: 'GET' },
  });

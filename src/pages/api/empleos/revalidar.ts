/**
 * POST /api/empleos/revalidar — Control360 avisa que cambiaron las vacantes y
 * este sitio regenera en segundos /empleos/, /empleos/<slug>/ y el JSON público.
 *
 * Cuerpo: `{ "slugs": ["facturacion", …] }` (opcional: sin slugs se regeneran
 * solo la lista y el JSON, p. ej. al reordenar). Cabecera:
 * `Authorization: Bearer <EMPLEOS_WEBHOOK_SECRET>` (el MISMO valor que en
 * Control360 se llama TALENTO_SITIOS_SECRETO_DST).
 *
 * Respuestas: 202 con lo regenerado; 401 sin el secreto correcto; 400 cuerpo
 * malo; 413 cuerpo grande; 415 si no es JSON; 405 otro método; 503 si falta
 * EMPLEOS_WEBHOOK_SECRET o ISR_BYPASS_TOKEN (sin token no hay cómo pedirle a
 * Vercel que regenere: las páginas igual se renuevan cada 5 minutos).
 *
 * Es una función normal, no ISR: está excluida en src/lib/empleos/isr.mjs. Solo
 * existe en Vercel (en GitHub Pages no hay funciones ni nada que regenerar).
 * El trabajo está en src/lib/empleos/revalidar.ts, para poder probarlo.
 */
import type { APIRoute } from 'astro';
import { tokenIsr } from '../../../lib/empleos/isr.mjs';
import {
  leerAviso,
  leerCuerpoAcotado,
  revalidarRutas,
  rutasARevalidar,
  secretoValido,
} from '../../../lib/empleos/revalidar';
import { VARIABLE_SECRETO } from '../../../lib/empleos/vacantes-fuente';

export const prerender = false;

function json(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request, url }) => {
  const env = process.env as Record<string, string | undefined>;
  const secreto = env[VARIABLE_SECRETO]?.trim();
  if (!secreto) return json(503, { ok: false, errores: [`${VARIABLE_SECRETO} no está configurada.`] });
  if (!secretoValido(request.headers.get('authorization'), secreto)) {
    return json(401, { ok: false, errores: ['No autorizado.'] });
  }

  const token = tokenIsr(env);
  if (!token) return json(503, { ok: false, errores: ['ISR_BYPASS_TOKEN no está configurada.'] });

  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return json(415, { ok: false, errores: ['El cuerpo debe ser JSON.'] });
  }
  const texto = await leerCuerpoAcotado(request);
  if (texto === null) return json(413, { ok: false, errores: ['El cuerpo es demasiado grande.'] });

  let crudo: unknown;
  try {
    crudo = texto.trim() ? JSON.parse(texto) : {};
  } catch {
    return json(400, { ok: false, errores: ['El cuerpo no es JSON válido.'] });
  }
  const aviso = leerAviso(crudo);
  if (!aviso.ok) return json(400, { ok: false, errores: [aviso.motivo] });

  const rutas = rutasARevalidar(aviso.slugs);
  const revalidadas = await revalidarRutas({ origen: url.origin, rutas, token });
  const fallidas = revalidadas.filter((r) => r.estado === 0 || r.estado >= 500);
  // Al log solo rutas y códigos: ni el secreto ni el token.
  console.log(`[empleos/revalidar] ${rutas.length} rutas, ${fallidas.length} fallidas`, JSON.stringify(revalidadas));

  return json(202, { ok: fallidas.length === 0, revalidadas });
};

/** Cualquier otro método sobre esta ruta es un error, no un 404 confuso. */
export const ALL: APIRoute = () =>
  new Response(JSON.stringify({ ok: false, errores: ['Método no permitido.'] }), {
    status: 405,
    headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST', 'cache-control': 'no-store' },
  });

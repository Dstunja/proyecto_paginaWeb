/**
 * Puerta de los crons de Vercel (/api/pqrs/limpieza y /api/empleos/limpieza).
 *
 * Vercel llama cada cron declarado en vercel.json con la cabecera
 * `Authorization: Bearer $CRON_SECRET`. Aquí se decide si la llamada pasa:
 *   - sin `CRON_SECRET` configurada → 503: el endpoint no queda abierto;
 *   - con otra cabecera → 401;
 *   - con la correcta → `null` (adelante).
 *
 * El secreto se compara en TIEMPO CONSTANTE (`secretoValido`, sobre los
 * resúmenes SHA-256, para no filtrar ni el largo). Antes se comparaba con `!==`,
 * que corta en el primer carácter distinto y deja medir cuánto se acertó.
 * Nunca se escribe el secreto en respuestas ni en registros.
 */
import { secretoValido } from './empleos/revalidar';

function json(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** `null` si la llamada trae el secreto del cron; si no, la respuesta de rechazo. */
export function rechazoCron(request: Request, env: { CRON_SECRET?: string }): Response | null {
  const secreto = env.CRON_SECRET?.trim();
  if (!secreto) return json(503, { ok: false, errores: ['CRON_SECRET no está configurada.'] });
  if (!secretoValido(request.headers.get('authorization'), secreto)) {
    return json(401, { ok: false, errores: ['No autorizado.'] });
  }
  return null;
}

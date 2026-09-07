/**
 * GET /api/pqrs/limpieza — borra los soportes que se subieron y nunca se
 * radicaron.
 *
 * Lo llama el cron declarado en vercel.json. Un blob en `pqrs/pendientes/`
 * significa que alguien eligió un archivo y luego cerró la pestaña: no hay
 * solicitud a la que pertenezca y no puede quedarse ahí ocupando sitio (ni
 * guardando datos personales de nadie) para siempre.
 *
 * PROTECCIÓN. Vercel manda el cron con la cabecera
 * `Authorization: Bearer $CRON_SECRET`. Sin `CRON_SECRET` configurada el
 * endpoint responde 503 en vez de quedar abierto: si estuviera abierto,
 * cualquiera podría dispararlo en bucle y vaciar los pendientes de quienes
 * están radicando en ese momento.
 */
import type { APIRoute } from 'astro';
import * as almacen from '../../../lib/pqrs/almacen';
import { HORAS_RETENCION_PENDIENTES, PREFIJO_PENDIENTES, type Entorno } from '../../../lib/pqrs/config';

export const prerender = false;

function json(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const env = process.env as Entorno;
  const secreto = env.CRON_SECRET;

  if (!secreto) {
    return json(503, { ok: false, errores: ['CRON_SECRET no está configurada.'] });
  }
  if (request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return json(401, { ok: false, errores: ['No autorizado.'] });
  }

  const limite = Date.now() - HORAS_RETENCION_PENDIENTES * 60 * 60 * 1000;
  const pendientes = await almacen.listar(PREFIJO_PENDIENTES, env);
  const caducados = pendientes.filter((blob) => blob.subidoEn.getTime() < limite);

  await almacen.borrar(
    caducados.map((b) => b.pathname),
    env,
  );

  return json(200, {
    ok: true,
    revisados: pendientes.length,
    borrados: caducados.length,
    horas: HORAS_RETENCION_PENDIENTES,
  });
};

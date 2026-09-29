/**
 * GET /api/empleos/limpieza — borra las hojas de vida guardadas que pasaron del
 * plazo de conservación.
 *
 * ESTE CRON TODAVÍA NO ESTÁ DECLARADO EN vercel.json, a propósito. La ruta
 * existe y funciona, pero nadie la llama: se activa cuando se apruebe el plazo,
 * añadiendo el bloque que está documentado en docs/EMPLEOS-POSTULACION.md. Y
 * aunque se llame, mientras `EMPLEOS_RETENCION_ACTIVA` no valga `'1'` solo hace
 * un simulacro y no borra nada (ver src/lib/empleos/retencion.ts). Son dos
 * cerrojos para lo mismo: un borrado irreversible de datos personales no se
 * enciende solo.
 *
 * QUÉ BORRA. Solo lo que hay bajo `empleos/`, que son las postulaciones cuyo
 * correo a Talento Humano no salió y se pusieron a salvo. En el camino normal
 * ahí no se escribe nada, así que este cron suele no tener trabajo. No toca
 * `pqrs/`: de eso se encarga /api/pqrs/limpieza, que tiene su propio plazo y su
 * propia razón (soportes subidos y nunca radicados, 24 horas).
 *
 * PROTECCIÓN. La misma que la limpieza de PQRS: Vercel manda el cron con la
 * cabecera `Authorization: Bearer $CRON_SECRET`, y sin esa variable el endpoint
 * responde 503 en vez de quedar abierto.
 */
import type { APIRoute } from 'astro';
import { blobConfigurado } from '../../../lib/pqrs/config';
import type { Entorno } from '../../../lib/empleos/config';
import { limpiarPostulaciones } from '../../../lib/empleos/retencion';

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
  if (!blobConfigurado(env)) {
    return json(503, { ok: false, errores: ['BLOB_READ_WRITE_TOKEN no está configurada.'] });
  }

  const resultado = await limpiarPostulaciones(env);

  // Al registro va el resumen, que no lleva ningún dato personal: cuántas se
  // revisaron, cuántas caducaron y si se borró o solo se miró.
  console.log(
    `[empleos/limpieza] ${resultado.simulacro ? 'SIMULACRO' : 'borrado'}`,
    JSON.stringify({
      meses: resultado.meses,
      revisadas: resultado.revisadas,
      caducadas: resultado.caducadas,
      archivosBorrados: resultado.archivosBorrados,
    }),
  );

  return json(200, { ok: true, ...resultado });
};

/** Cualquier otro método sobre esta ruta es un error, no un 404 confuso. */
export const ALL: APIRoute = () =>
  new Response(JSON.stringify({ ok: false, errores: ['Método no permitido.'] }), {
    status: 405,
    headers: { 'content-type': 'application/json; charset=utf-8', allow: 'GET' },
  });

/**
 * GET /api/empleos/limpieza — borra las hojas de vida guardadas que pasaron del
 * plazo de conservación.
 *
 * Lo llama a diario el cron declarado en vercel.json (08:00 UTC). Mientras
 * `EMPLEOS_RETENCION_ACTIVA` no valga `'1'` solo hace un SIMULACRO y no borra
 * nada (ver src/lib/empleos/retencion.ts): el registro dice cuántas habrían
 * caducado. Un borrado irreversible de datos personales no se enciende solo:
 * hay que aprobar el plazo y poner esa variable a mano.
 *
 * QUÉ BORRA. Solo lo que hay bajo `empleos/`, que son las postulaciones cuyo
 * correo a Talento Humano no salió y se pusieron a salvo. En el camino normal
 * ahí no se escribe nada, así que este cron suele no tener trabajo. No toca
 * `pqrs/`: de eso se encarga /api/pqrs/limpieza, que tiene su propio plazo y su
 * propia razón (soportes subidos y nunca radicados, 24 horas).
 *
 * PROTECCIÓN. La misma que la limpieza de PQRS (src/lib/cron.ts): Vercel manda
 * el cron con `Authorization: Bearer $CRON_SECRET`, que se compara en tiempo
 * constante, y sin esa variable el endpoint responde 503 en vez de quedar
 * abierto.
 */
import type { APIRoute } from 'astro';
import { rechazoCron } from '../../../lib/cron';
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
  const rechazo = rechazoCron(request, env);
  if (rechazo) return rechazo;
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

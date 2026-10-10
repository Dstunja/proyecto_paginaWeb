/**
 * GET /api/empleos/vacantes.json — las vacantes abiertas, en JSON público.
 *
 * Lo consume el módulo Talento de Control360 como respaldo de su sugerencia
 * con IA (si una empresa no tiene vacantes en Control360, lee este JSON). Desde
 * que Talento Humano publica las vacantes en Control360, la lista de aquí es la
 * misma que muestra /empleos/ (src/lib/empleos/vacantes-fuente.ts), o la de
 * src/data/vacantes.ts si no se pudo leer. Lo que sale ya se ve en /empleos/: no
 * hay datos nuevos ni privados. Qué campos salen lo decide vacantes-publicas.ts.
 *
 * En Vercel va con ISR, igual que /empleos/ (src/lib/empleos/isr.mjs): se sirve
 * desde la caché y se regenera cuando Control360 avisa por
 * /api/empleos/revalidar o, como mucho, a los 5 minutos. En el espejo de GitHub
 * Pages se genera al compilar y queda como archivo estático. Por eso aquí NO hay
 * `export const prerender`: lo decide la integración de astro.config.mjs según
 * el destino.
 *
 * Forma: { "version": 1, "vacantes": [{ slug, cargo, ciudad, tipo, resumen,
 * descripcion[], requisitos[], funciones[] }, …] }, en el orden de la página.
 */
import type { APIRoute } from 'astro';
import { cargarVacantes } from '../../../lib/empleos/vacantes-fuente';
import { vacantesPublicas } from '../../../lib/empleos/vacantes-publicas';

export const GET: APIRoute = async () => {
  const { vacantes } = await cargarVacantes();
  return new Response(JSON.stringify(vacantesPublicas(vacantes), null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};

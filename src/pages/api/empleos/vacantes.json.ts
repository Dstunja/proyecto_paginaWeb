/**
 * GET /api/empleos/vacantes.json — las vacantes abiertas, en JSON público.
 *
 * Lo consume el módulo Talento de Control360 como respaldo de su sugerencia
 * con IA (si una empresa no tiene vacantes en Control360, lee este JSON). Desde
 * que Talento Humano publica las vacantes en Control360, la lista de aquí es la
 * misma que se leyó en el build (src/lib/empleos/vacantes-fuente.ts), o la de
 * src/data/vacantes.ts si no se pudo leer. Lo que sale ya se ve en /empleos/: no
 * hay datos nuevos ni privados. Qué campos salen lo decide vacantes-publicas.ts.
 *
 * A diferencia de las demás rutas de src/pages/api/, esta NO es una función: se
 * genera al compilar (`prerender = true`) y queda como archivo estático. No gasta
 * invocaciones en Vercel y también se publica en el espejo de GitHub Pages. Como
 * las vacantes solo cambian con un push, el archivo se actualiza en cada despliegue.
 *
 * Forma: { "version": 1, "vacantes": [{ slug, cargo, ciudad, tipo, resumen,
 * descripcion[], requisitos[], funciones[] }, …] }, en el orden de la página.
 */
import type { APIRoute } from 'astro';
import { cargarVacantes } from '../../../lib/empleos/vacantes-fuente';
import { vacantesPublicas } from '../../../lib/empleos/vacantes-publicas';

export const prerender = true;

export const GET: APIRoute = async () => {
  const { vacantes } = await cargarVacantes();
  return new Response(JSON.stringify(vacantesPublicas(vacantes), null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};

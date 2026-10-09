/**
 * GET /api/empleos/vacantes.json — las vacantes abiertas, en JSON público.
 *
 * Lo consume el módulo Talento de Control360: con esta lista le da a RRHH una
 * sugerencia con IA de si el candidato encaja en el cargo al que se postuló o en
 * otra vacante abierta. La fuente de verdad de las vacantes es este sitio
 * (src/data/vacantes.ts), y lo que sale aquí ya se ve en /empleos/: no hay datos
 * nuevos ni privados. Qué campos salen lo decide src/lib/empleos/vacantes-publicas.ts.
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
import { vacantes } from '../../../data/vacantes';
import { vacantesPublicas } from '../../../lib/empleos/vacantes-publicas';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(vacantesPublicas(vacantes), null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

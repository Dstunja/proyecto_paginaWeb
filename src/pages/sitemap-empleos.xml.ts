/**
 * GET /sitemap-empleos.xml — /empleos/ y cada vacante abierta, para buscadores.
 *
 * En Vercel va con ISR como las páginas de empleos (src/lib/empleos/isr.mjs):
 * se regenera cuando Control360 avisa por /api/empleos/revalidar o a los 5
 * minutos, y sitemap-index.xml lo incluye. En GitHub Pages se genera al
 * compilar. Aquí NO hay `export const prerender`: lo decide la integración de
 * astro.config.mjs según el destino. El XML lo arma sitemap-empleos.ts.
 */
import type { APIRoute } from 'astro';
import { cargarVacantes } from '../lib/empleos/vacantes-fuente';
import { xmlSitemapEmpleos } from '../lib/empleos/sitemap-empleos';

export const GET: APIRoute = async ({ site }) => {
  const { vacantes } = await cargarVacantes();
  const sitio = site?.href ?? 'https://dstunja.com/';
  return new Response(xmlSitemapEmpleos(sitio, import.meta.env.BASE_URL, vacantes), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};

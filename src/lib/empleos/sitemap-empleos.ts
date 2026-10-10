/**
 * El sitemap de empleos: /empleos/ y cada /empleos/<slug>/ ABIERTA.
 *
 * POR QUÉ APARTE. @astrojs/sitemap solo ve las páginas prerenderizadas, y en
 * Vercel las de empleos van con ISR (src/lib/empleos/isr.mjs): sin esto, los
 * detalles de las vacantes se caían del sitemap y Google (y Google Empleos) no
 * los encontraba. Este sitemap se sirve también con ISR, así que se regenera con
 * el mismo webhook de Control360 y caduca a los 5 minutos como las páginas: una
 * vacante cerrada sale de aquí en segundos y una nueva entra igual de rápido.
 * sitemap-index.xml lo incluye (customSitemaps en astro.config.mjs).
 *
 * `lastmod` solo cuando Control360 manda la fecha real del cambio
 * (`actualizada`); sin ella se omite, porque una fecha inventada (la de cada
 * regeneración) le diría a Google que todo cambia cada 5 minutos.
 *
 * Es pura: recibe el dominio, el `base` y las vacantes, y devuelve el XML.
 */
import type { Vacante } from '../../data/vacantes';

const escaparXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** La URL absoluta de una ruta del sitio, respetando el `base` (GitHub Pages). */
function absoluta(sitio: string, base: string, ruta: string): string {
  const prefijo = base.endsWith('/') ? base : `${base}/`;
  return new URL(`${prefijo}${ruta.replace(/^\//, '')}`, sitio).href;
}

/** La fecha más reciente de la lista, o '' si ninguna trae fecha. */
function masReciente(fechas: readonly (string | undefined)[]): string {
  return fechas.filter((f): f is string => Boolean(f)).sort().at(-1) ?? '';
}

export interface EntradaSitemap {
  loc: string;
  lastmod?: string;
}

/** Las entradas del sitemap: primero la lista, luego cada vacante en su orden. */
export function entradasSitemapEmpleos(sitio: string, base: string, vacantes: readonly Vacante[]): EntradaSitemap[] {
  const lista = masReciente(vacantes.map((v) => v.actualizada));
  return [
    { loc: absoluta(sitio, base, '/empleos/'), ...(lista ? { lastmod: lista } : {}) },
    ...vacantes.map((v) => ({
      loc: absoluta(sitio, base, `/empleos/${v.slug}/`),
      ...(v.actualizada ? { lastmod: v.actualizada } : {}),
    })),
  ];
}

/** El XML completo (protocolo sitemaps.org 0.9). */
export function xmlSitemapEmpleos(sitio: string, base: string, vacantes: readonly Vacante[]): string {
  const urls = entradasSitemapEmpleos(sitio, base, vacantes)
    .map(
      (e) =>
        `  <url><loc>${escaparXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${escaparXml(e.lastmod)}</lastmod>` : ''}</url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

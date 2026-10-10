import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Módulo interno de @vercel/routing-utils: es el mismo que usa Vercel para leer `source`.
import { sourceToRegex } from '@vercel/routing-utils/dist/superstatic.js';

interface Regla {
  source: string;
  destination?: string;
  statusCode?: number;
  headers?: { key: string; value: string }[];
}
const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
  redirects: Regla[];
  headers: Regla[];
};

const casa = (source: string, ruta: string) => new RegExp(sourceToRegex(source).src).test(ruta);
const redirigeA = (ruta: string) => vercel.redirects.find((r) => casa(r.source, ruta));

describe('vercel.json', () => {
  it('los sitemaps del WordPress viejo van con 301 al índice actual', () => {
    for (const viejo of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/page-sitemap.xml', '/wp-sitemap-posts-page-1.xml']) {
      const r = redirigeA(viejo);
      expect(r?.destination, viejo).toBe('/sitemap-index.xml');
      expect(r?.statusCode).toBe(301);
    }
  });

  it('los sitemaps actuales no se redirigen', () => {
    for (const actual of ['/sitemap-index.xml', '/sitemap-0.xml', '/sitemap-empleos.xml']) {
      expect(redirigeA(actual), actual).toBeUndefined();
    }
  });

  it('/_astro/* se sirve con caché inmutable de un año', () => {
    const regla = vercel.headers.find((h) => casa(h.source, '/_astro/index.Ab12Cd.css'));
    expect(regla?.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
  });

  it('la CSP ya no permite Google Analytics ni Tag Manager', () => {
    const csp = vercel.headers.flatMap((h) => h.headers ?? []).find((h) => h.key === 'Content-Security-Policy')!.value;
    expect(csp).not.toMatch(/google|googletagmanager/);
    expect(csp).toMatch(/script-src 'self' https:\/\/challenges\.cloudflare\.com;/);
  });

  it('no declara HSTS con includeSubDomains', () => {
    const cabeceras = vercel.headers.flatMap((h) => h.headers ?? []);
    expect(cabeceras.some((h) => /includeSubDomains/i.test(h.value))).toBe(false);
  });
});

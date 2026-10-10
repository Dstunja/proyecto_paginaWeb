/**
 * Pruebas del sitemap de empleos (src/lib/empleos/sitemap-empleos.ts): que
 * liste /empleos/ y cada vacante abierta con su URL absoluta (con y sin el
 * `base` de GitHub Pages), que `lastmod` salga solo cuando hay fecha real y que
 * el XML escape lo que haga falta.
 */
import { describe, expect, it } from 'vitest';
import type { Vacante } from '../../data/vacantes';
import { entradasSitemapEmpleos, xmlSitemapEmpleos } from './sitemap-empleos';
import { leerVacantesRemotas } from './vacantes-fuente';

const vacante = (slug: string, actualizada?: string): Vacante => ({
  slug,
  cargo: slug,
  ciudad: 'Tunja',
  tipo: 'Tiempo completo',
  resumen: '',
  imagen: '',
  descripcion: [],
  requisitos: [],
  ...(actualizada ? { actualizada } : {}),
});

describe('entradasSitemapEmpleos', () => {
  it('la lista y cada vacante abierta, en orden, con URL absoluta', () => {
    expect(entradasSitemapEmpleos('https://dstunja.com/', '/', [vacante('facturacion'), vacante('logistica')])).toEqual([
      { loc: 'https://dstunja.com/empleos/' },
      { loc: 'https://dstunja.com/empleos/facturacion/' },
      { loc: 'https://dstunja.com/empleos/logistica/' },
    ]);
  });

  it('respeta el base de GitHub Pages', () => {
    const [lista, una] = entradasSitemapEmpleos('https://dstunja.github.io', '/proyecto_paginaWeb', [vacante('facturacion')]);
    expect(lista.loc).toBe('https://dstunja.github.io/proyecto_paginaWeb/empleos/');
    expect(una.loc).toBe('https://dstunja.github.io/proyecto_paginaWeb/empleos/facturacion/');
  });

  it('lastmod solo con fecha real; la lista toma la más reciente', () => {
    const e = entradasSitemapEmpleos('https://dstunja.com', '/', [
      vacante('a', '2026-10-01T00:00:00.000Z'),
      vacante('b'),
      vacante('c', '2026-10-09T12:00:00.000Z'),
    ]);
    expect(e[0].lastmod).toBe('2026-10-09T12:00:00.000Z');
    expect(e[1].lastmod).toBe('2026-10-01T00:00:00.000Z');
    expect(e[2]).not.toHaveProperty('lastmod');
  });

  it('sin vacantes abiertas queda solo /empleos/', () => {
    expect(entradasSitemapEmpleos('https://dstunja.com', '/', [])).toEqual([{ loc: 'https://dstunja.com/empleos/' }]);
  });
});

describe('xmlSitemapEmpleos', () => {
  it('es un urlset válido con una <url> por entrada', () => {
    const xml = xmlSitemapEmpleos('https://dstunja.com', '/', [vacante('facturacion', '2026-10-10T00:00:00.000Z')]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain('<url><loc>https://dstunja.com/empleos/facturacion/</loc><lastmod>2026-10-10T00:00:00.000Z</lastmod></url>');
  });

  it('escapa caracteres especiales de XML', () => {
    expect(xmlSitemapEmpleos('https://dstunja.com', "/a&b'/", [])).toContain('/a&amp;b&apos;/empleos/');
  });
});

describe('fecha "actualizada" desde Control360', () => {
  const remota = (actualizada: unknown) =>
    leerVacantesRemotas({ version: 1, vacantes: [{ slug: 'x', cargo: 'X', actualizada }] }, []);

  it('acepta fecha ISO y la normaliza', () => {
    const r = remota('2026-10-10');
    expect(r.ok && r.vacantes[0].actualizada).toBe('2026-10-10T00:00:00.000Z');
  });

  it('ignora lo que no es fecha', () => {
    for (const malo of ['ayer', '2026-13-45', 12345, null, '']) {
      const r = remota(malo);
      expect(r.ok && r.vacantes[0]).not.toHaveProperty('actualizada');
    }
  });
});

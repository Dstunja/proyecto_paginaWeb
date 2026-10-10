import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jsonLd, listaMigas, organizacion } from './datos-estructurados';

describe('organizacion', () => {
  const o = organizacion('https://dstunja.com', '/');

  it('declara la empresa con NIT, fundación, dirección, coordenadas y teléfono', () => {
    expect(o['@type']).toBe('LocalBusiness');
    expect(o.taxID).toBe('900417808-1');
    expect(o.foundingDate).toBe('2005');
    expect(o.telephone).toBe('+57 310 623 2429');
    expect(o.logo).toBe('https://dstunja.com/logo-distribuciones.png');
    expect(o.address).toMatchObject({ streetAddress: 'Cra 2 Este #58-79', addressLocality: 'Tunja', addressCountry: 'CO' });
    expect(o.geo.latitude).toBeGreaterThan(5);
    expect(o.geo.longitude).toBeLessThan(-73);
  });

  it('declara el horario de lunes a sábado y no el domingo', () => {
    const dias = o.openingHoursSpecification.flatMap((h) => h.dayOfWeek);
    expect(dias).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    expect(o.openingHoursSpecification[0]).toMatchObject({ opens: '07:30', closes: '17:30' });
  });
});

describe('listaMigas', () => {
  it('numera desde 1 con URLs absolutas', () => {
    const m = listaMigas(
      [
        { nombre: 'Inicio', ruta: '/' },
        { nombre: 'Empleos', ruta: '/empleos/' },
      ],
      'https://dstunja.com',
    );
    expect(m.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://dstunja.com/' },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: 'https://dstunja.com/empleos/' },
    ]);
  });
});

describe('jsonLd', () => {
  it('escapa "<" para que ningún texto cierre la etiqueta <script>', () => {
    const texto = jsonLd({ a: '</script><script>alert(1)</script>' });
    expect(texto).not.toContain('<');
    expect(JSON.parse(texto)).toEqual({ a: '</script><script>alert(1)</script>' });
  });
});

describe('robots.txt', () => {
  const robots = readFileSync(join(process.cwd(), 'public/robots.txt'), 'utf8');
  const reglas = robots
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  it('deja rastrear el sitio y cierra /api/', () => {
    expect(reglas).toContain('User-agent: *');
    expect(reglas).toContain('Allow: /');
    expect(reglas).toContain('Disallow: /api/');
  });

  it('apunta al índice de sitemaps de dstunja.com', () => {
    expect(reglas).toContain('Sitemap: https://dstunja.com/sitemap-index.xml');
  });
});

describe('site.webmanifest', () => {
  it('es JSON válido con los íconos de 192 y 512', () => {
    const m = JSON.parse(readFileSync(join(process.cwd(), 'public/site.webmanifest'), 'utf8'));
    expect(m.name).toBe('Distribuciones Santiago de Tunja');
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});

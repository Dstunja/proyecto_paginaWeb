/**
 * Pruebas del webhook de revalidación (src/lib/empleos/revalidar.ts) y de la
 * configuración de ISR (src/lib/empleos/isr.mjs).
 *
 * Lo que más importa: que sin el secreto exacto NADIE dispare regeneraciones,
 * que un secreto sin configurar no abra la puerta, que las rutas a regenerar
 * sean siempre la lista, el JSON y el detalle de cada slug (también cerrados)
 * y nada más, y que sin token de ISR el sitio siga funcionando.
 */
import { describe, expect, it } from 'vitest';
import {
  COMPONENTES_ISR,
  configIsr,
  EXCLUIR_DE_ISR,
  EXPIRACION_ISR_S,
  prerenderDe,
  tokenIsr,
} from './isr.mjs';
import {
  leerAviso,
  leerCuerpoAcotado,
  MAX_SLUGS,
  revalidarRutas,
  rutasARevalidar,
  secretoValido,
} from './revalidar';

const SECRETO = 'un-secreto-compartido-de-prueba-0123456789';
const TOKEN = 't'.repeat(40);

describe('secretoValido', () => {
  it('acepta solo Bearer con el secreto exacto', () => {
    expect(secretoValido(`Bearer ${SECRETO}`, SECRETO)).toBe(true);
    expect(secretoValido(`bearer   ${SECRETO}`, SECRETO)).toBe(true);
    expect(secretoValido(`Bearer ${SECRETO}x`, SECRETO)).toBe(false);
    expect(secretoValido(`Bearer ${SECRETO.slice(0, -1)}`, SECRETO)).toBe(false);
    expect(secretoValido(SECRETO, SECRETO)).toBe(false);
    expect(secretoValido(`Basic ${SECRETO}`, SECRETO)).toBe(false);
    expect(secretoValido('Bearer ', SECRETO)).toBe(false);
    expect(secretoValido(null, SECRETO)).toBe(false);
  });

  it('un secreto vacío o sin configurar nunca abre la puerta', () => {
    expect(secretoValido('Bearer ', '')).toBe(false);
    expect(secretoValido('Bearer x', undefined)).toBe(false);
    expect(secretoValido('Bearer  ', '   ')).toBe(false);
  });
});

describe('leerAviso', () => {
  it('acepta { slugs } y descarta uno a uno lo que no es slug', () => {
    expect(leerAviso({ slugs: ['facturacion', ' Logistica ', '../x', 'a b', 7, 'facturacion'] })).toEqual({
      ok: true,
      slugs: ['facturacion', 'logistica'],
    });
  });

  it('sin slugs es válido (p. ej. al reordenar)', () => {
    expect(leerAviso({})).toEqual({ ok: true, slugs: [] });
  });

  it('rechaza lo que no es un objeto o slugs que no es lista', () => {
    expect(leerAviso(null).ok).toBe(false);
    expect(leerAviso([]).ok).toBe(false);
    expect(leerAviso('x').ok).toBe(false);
    expect(leerAviso({ slugs: 'facturacion' }).ok).toBe(false);
  });

  it('no acepta más de MAX_SLUGS', () => {
    const muchos = Array.from({ length: MAX_SLUGS + 20 }, (_, i) => `vacante-${i}`);
    const r = leerAviso({ slugs: muchos });
    expect(r.ok && r.slugs.length).toBe(MAX_SLUGS);
  });
});

describe('rutasARevalidar', () => {
  it('siempre la lista y el JSON; luego el detalle de cada slug, sin repetir', () => {
    expect(rutasARevalidar(['facturacion', 'logistica', 'facturacion'])).toEqual([
      '/empleos/',
      '/api/empleos/vacantes.json',
      '/empleos/facturacion/',
      '/empleos/logistica/',
    ]);
  });

  it('sin slugs, solo la lista y el JSON', () => {
    expect(rutasARevalidar([])).toEqual(['/empleos/', '/api/empleos/vacantes.json']);
  });
});

describe('revalidarRutas', () => {
  it('pide cada ruta a su propio dominio con x-prerender-revalidate', async () => {
    const pedidos: { url: string; token: string | null }[] = [];
    const fetchFn = (async (url: URL, init: RequestInit) => {
      pedidos.push({ url: String(url), token: new Headers(init.headers).get('x-prerender-revalidate') });
      return new Response('ok', { status: String(url).includes('cerrada') ? 404 : 200 });
    }) as unknown as typeof fetch;

    const r = await revalidarRutas({
      origen: 'https://dstunja.com',
      rutas: rutasARevalidar(['cerrada']),
      token: TOKEN,
      fetchFn,
    });

    expect(pedidos.map((p) => p.url)).toEqual([
      'https://dstunja.com/empleos/',
      'https://dstunja.com/api/empleos/vacantes.json',
      'https://dstunja.com/empleos/cerrada/',
    ]);
    expect(pedidos.every((p) => p.token === TOKEN)).toBe(true);
    expect(r).toEqual([
      { ruta: '/empleos/', estado: 200 },
      { ruta: '/api/empleos/vacantes.json', estado: 200 },
      { ruta: '/empleos/cerrada/', estado: 404 },
    ]);
  });

  it('una ruta que falla no frena a las demás (estado 0)', async () => {
    const fetchFn = (async (url: URL) => {
      if (String(url).endsWith('.json')) throw new Error('ECONNRESET');
      return new Response('ok');
    }) as unknown as typeof fetch;
    const r = await revalidarRutas({ origen: 'https://dstunja.com', rutas: rutasARevalidar([]), token: TOKEN, fetchFn });
    expect(r).toEqual([
      { ruta: '/empleos/', estado: 200 },
      { ruta: '/api/empleos/vacantes.json', estado: 0 },
    ]);
  });
});

describe('leerCuerpoAcotado', () => {
  const pedido = (cuerpo: string, cabeceras: Record<string, string> = {}) =>
    new Request('https://dstunja.com/api/empleos/revalidar', { method: 'POST', body: cuerpo, headers: cabeceras });

  it('devuelve el texto si cabe', async () => {
    expect(await leerCuerpoAcotado(pedido('{"slugs":["a"]}'), 100)).toBe('{"slugs":["a"]}');
  });

  it('null si el cuerpo pasa del tope, diga lo que diga content-length', async () => {
    expect(await leerCuerpoAcotado(pedido('x'.repeat(200)), 100)).toBeNull();
    expect(await leerCuerpoAcotado(pedido('x', { 'content-length': '999999' }), 100)).toBeNull();
  });
});

describe('isr.mjs', () => {
  it('el token de ISR solo sirve con 32 caracteres o más', () => {
    expect(tokenIsr({})).toBeNull();
    expect(tokenIsr({ ISR_BYPASS_TOKEN: 'corto' })).toBeNull();
    expect(tokenIsr({ ISR_BYPASS_TOKEN: ` ${TOKEN} ` })).toBe(TOKEN);
  });

  it('sin token, ISR queda solo con la expiración de 5 minutos (el sitio no se cae)', () => {
    expect(configIsr({})).toEqual({ expiration: EXPIRACION_ISR_S, exclude: [EXCLUIR_DE_ISR] });
    expect(configIsr({ ISR_BYPASS_TOKEN: TOKEN })).toEqual({
      expiration: 300,
      exclude: [EXCLUIR_DE_ISR],
      bypassToken: TOKEN,
    });
  });

  it('ISR no toca las funciones de /api/ salvo el JSON de vacantes', () => {
    for (const ruta of ['/api/pqrs', '/api/pqrs/token', '/api/empleos/postular', '/api/empleos/revalidar', '/api/empleos/descarga']) {
      expect(EXCLUIR_DE_ISR.test(ruta), ruta).toBe(true);
    }
    for (const ruta of ['/api/empleos/vacantes.json', '/empleos', '/empleos/[slug]', '/pqrs']) {
      expect(EXCLUIR_DE_ISR.test(ruta), ruta).toBe(false);
    }
  });

  it('solo las páginas de empleos cambian de modo, y solo en Vercel', () => {
    for (const c of COMPONENTES_ISR) {
      expect(prerenderDe(c, true)).toBe(false);
      expect(prerenderDe(c, false)).toBe(true);
    }
    expect(prerenderDe('src/pages/pqrs.astro', true)).toBeUndefined();
    expect(prerenderDe('src/pages/api/empleos/revalidar.ts', true)).toBeUndefined();
    expect(prerenderDe('src/pages/index.astro', false)).toBeUndefined();
  });
});

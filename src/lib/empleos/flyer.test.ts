import { describe, expect, it } from 'vitest';
import {
  ANCHOS_FLYER,
  CONFIG_IMAGENES_VERCEL,
  HOST_FLYERS,
  atributosFlyer,
  esFlyerOptimizable,
} from './flyer.mjs';

const FLYER = `https://${HOST_FLYERS}/storage/v1/object/public/vacantes/dst/vendedor.jpg`;

describe('flyer.mjs', () => {
  it('solo optimiza flyers del bucket público de Control360', () => {
    expect(esFlyerOptimizable(FLYER)).toBe(true);
    expect(esFlyerOptimizable(`http://${HOST_FLYERS}/storage/v1/object/public/x.jpg`)).toBe(false);
    expect(esFlyerOptimizable(`https://${HOST_FLYERS}/storage/v1/object/sign/x.jpg`)).toBe(false);
    expect(esFlyerOptimizable('https://placehold.co/800x600/png')).toBe(false);
    expect(esFlyerOptimizable('/img/empleos/logistica.jpeg')).toBe(false);
  });

  it('fuera de Vercel deja la URL original', () => {
    expect(atributosFlyer(FLYER, { enVercel: false })).toEqual({ src: FLYER });
  });

  it('en Vercel arma src y srcset con /_vercel/image y solo anchos permitidos', () => {
    const { src, srcset } = atributosFlyer(FLYER, { enVercel: true, anchoMaximo: 828 });
    expect(src).toBe(`/_vercel/image?url=${encodeURIComponent(FLYER)}&w=828&q=75`);
    const anchos = srcset!.split(', ').map((c) => Number(c.split(' ')[1].replace('w', '')));
    expect(anchos).toEqual([320, 480, 640, 828]);
    for (const a of anchos) expect(ANCHOS_FLYER).toContain(a);
  });

  it('un marcador o un archivo local no pasa por el optimizador ni en Vercel', () => {
    expect(atributosFlyer('/img/empleos/x.jpg', { enVercel: true })).toEqual({ src: '/img/empleos/x.jpg' });
  });

  it('la configuración del adaptador acepta exactamente el bucket y los anchos', () => {
    expect(CONFIG_IMAGENES_VERCEL.sizes).toEqual([...ANCHOS_FLYER]);
    expect(CONFIG_IMAGENES_VERCEL.remotePatterns).toEqual([
      { protocol: 'https', hostname: HOST_FLYERS, pathname: '/storage/v1/object/public/**' },
    ]);
  });
});

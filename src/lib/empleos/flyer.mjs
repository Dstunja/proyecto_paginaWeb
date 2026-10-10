// @ts-check
/**
 * Flyers de las vacantes servidos por el optimizador de imágenes de Vercel.
 *
 * POR QUÉ. Talento Humano sube el flyer en Control360 y llega aquí como URL del
 * bucket público de Supabase, a tamaño completo (a menudo varios cientos de KB,
 * en JPEG o PNG). En un teléfono se pintaba entero aunque la tarjeta midiera
 * 350 px. Vercel tiene un optimizador en `/_vercel/image` que recorta al ancho
 * pedido, convierte a AVIF/WebP según el navegador y lo guarda en su CDN; aquí
 * solo se arman esas URL y el `srcset`.
 *
 * QUÉ SE OPTIMIZA. Solo las URL del bucket público de Control360
 * (`HOST_FLYERS` + `/storage/v1/object/public/`), que son las mismas que
 * `remotePatterns` declara en astro.config.mjs: Vercel rechaza cualquier otra.
 * Lo demás (archivos de public/, marcadores de placehold.co) sale tal cual.
 *
 * DÓNDE. Solo en Vercel (`VERCEL` definida, en el build y en las funciones de
 * ISR). Fuera de Vercel `/_vercel/image` no existe, así que se usa la URL
 * original.
 *
 * Este archivo es .mjs (y no .ts) porque también lo importa astro.config.mjs.
 */

/** Bucket público de Supabase de Control360 (el mismo de img-src en la CSP). */
export const HOST_FLYERS = 'txefdbdnaactqjaxygzb.supabase.co';

/** Prefijo de los objetos públicos del bucket. */
export const RUTA_PUBLICA_FLYERS = '/storage/v1/object/public/';

/**
 * Anchos que el optimizador acepta (`images.sizes` de Vercel). Una URL con otro
 * `w` responde 400, así que el `srcset` solo usa estos.
 */
export const ANCHOS_FLYER = /** @type {const} */ ([320, 480, 640, 828, 1080]);

/** Calidad de la compresión (1-100). 75 es el punto habitual: no se nota. */
export const CALIDAD_FLYER = 75;

/**
 * La configuración de imágenes para el adaptador de Vercel (`imagesConfig`).
 * Va aparte para que astro.config.mjs y las pruebas usen exactamente la misma.
 */
export const CONFIG_IMAGENES_VERCEL = {
  sizes: [...ANCHOS_FLYER],
  formats: /** @type {('image/avif' | 'image/webp')[]} */ (['image/avif', 'image/webp']),
  minimumCacheTTL: 60 * 60 * 24 * 30,
  domains: [],
  remotePatterns: [{ protocol: /** @type {'https'} */ ('https'), hostname: HOST_FLYERS, pathname: `${RUTA_PUBLICA_FLYERS}**` }],
};

/**
 * ¿Es un flyer del bucket de Control360 que el optimizador puede servir?
 * @param {string} src
 */
export function esFlyerOptimizable(src) {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === HOST_FLYERS && url.pathname.startsWith(RUTA_PUBLICA_FLYERS);
  } catch {
    return false;
  }
}

/**
 * URL del optimizador de Vercel para un ancho dado.
 * @param {string} src
 * @param {number} ancho  uno de ANCHOS_FLYER
 */
export function urlFlyerOptimizada(src, ancho) {
  return `/_vercel/image?url=${encodeURIComponent(src)}&w=${ancho}&q=${CALIDAD_FLYER}`;
}

/**
 * `src` y `srcset` para un <img> de flyer.
 *
 * @param {string} src  URL del flyer (o ruta local / marcador)
 * @param {{ enVercel: boolean, anchoMaximo?: number }} opciones
 *   `anchoMaximo`: el mayor ancho que tiene sentido pedir (p. ej. 828 para una
 *   tarjeta: 414 px a 2x). El `src` de respaldo es el mayor de los permitidos.
 * @returns {{ src: string, srcset?: string }}
 */
export function atributosFlyer(src, { enVercel, anchoMaximo = 1080 }) {
  if (!enVercel || !esFlyerOptimizable(src)) return { src };
  const anchos = ANCHOS_FLYER.filter((a) => a <= anchoMaximo);
  const usados = anchos.length > 0 ? anchos : [ANCHOS_FLYER[0]];
  return {
    src: urlFlyerOptimizada(src, usados[usados.length - 1]),
    srcset: usados.map((a) => `${urlFlyerOptimizada(src, a)} ${a}w`).join(', '),
  };
}

// @ts-check
/**
 * Qué partes del sitio se regeneran solas (ISR) y con qué reglas.
 *
 * POR QUÉ. Talento Humano publica, cierra, edita y reordena las vacantes en
 * Control360. Mientras /empleos/ era 100 % estático, un cambio allá solo se veía
 * aquí con el siguiente despliegue: el 10·10 se cerró "Facturación" en
 * Control360 y dstunja.com la siguió mostrando. Ahora lo que depende de las
 * vacantes se sirve con ISR (Incremental Static Regeneration) de Vercel: la
 * página queda en la caché de la CDN como si fuera estática, pero
 *   1. Control360 avisa por webhook (POST /api/empleos/revalidar) y la página se
 *      vuelve a generar en segundos (revalidación bajo demanda con la cabecera
 *      `x-prerender-revalidate`), y
 *   2. si el aviso se pierde, la copia caduca sola a los 5 minutos (respaldo).
 *
 * QUÉ ENTRA. Solo las tres rutas que leen las vacantes: /empleos/ (tarjetas y
 * el <select> del formulario, que vive en la misma página), /empleos/<slug>/ y
 * el JSON público /api/empleos/vacantes.json, más /sitemap-empleos.xml (para que
 * los buscadores vean cada vacante abierta). Todo lo demás (inicio, PQRS,
 * catálogo…) sigue prerenderizado al compilar, como siempre.
 *
 * DÓNDE. Solo en Vercel. En el espejo de GitHub Pages no hay funciones, así que
 * ahí estas rutas se siguen compilando como HTML estático (ver la integración
 * de astro.config.mjs que decide `prerender` por ruta).
 *
 * UNA SOLA COPIA POR PÁGINA. La caché de ISR guarda una copia por ruta exacta:
 * "/empleos" y "/empleos/" serían dos copias y el webhook solo regenera la
 * segunda. Por eso vercel.json redirige (301) /empleos y /empleos/<slug> sin
 * barra final a su versión con barra, que es la que usan todos los enlaces.
 *
 * Este archivo es .mjs (y no .ts) porque lo importa astro.config.mjs, que Node
 * carga antes de que exista Vite; las pruebas lo importan igual.
 */

/** Archivos de src/pages/ que pasan a ISR en Vercel. */
export const COMPONENTES_ISR = [
  'src/pages/empleos.astro',
  'src/pages/empleos/[slug].astro',
  'src/pages/api/empleos/vacantes.json.ts',
  'src/pages/sitemap-empleos.xml.ts',
];

/** Segundos que vive una copia sin aviso de Control360 (respaldo del webhook). */
export const EXPIRACION_ISR_S = 300;

/** Vercel exige un token largo; con menos de esto no se usa. */
export const LARGO_MINIMO_TOKEN = 32;

/** Variable de entorno con el token de revalidación de ISR. */
export const VARIABLE_TOKEN_ISR = 'ISR_BYPASS_TOKEN';

/**
 * Rutas bajo demanda que NO van a ISR: las funciones de verdad (PQRS, postular,
 * descargas, limpiezas, el propio webhook). Un POST nunca debe pasar por una
 * caché. Se excluye todo /api/ menos el JSON de vacantes.
 */
export const EXCLUIR_DE_ISR = /^\/api\/(?!empleos\/vacantes\.json$)/;

/**
 * El token de ISR si sirve (definido y de 32 caracteres o más), o null.
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
export function tokenIsr(env) {
  const valor = env[VARIABLE_TOKEN_ISR]?.trim();
  return valor && valor.length >= LARGO_MINIMO_TOKEN ? valor : null;
}

/**
 * La opción `isr` del adaptador de Vercel. Sin token válido el sitio NO se cae:
 * ISR queda solo con la expiración de 5 minutos y el webhook responde 503.
 * @param {Record<string, string | undefined>} env
 */
export function configIsr(env) {
  const token = tokenIsr(env);
  return {
    expiration: EXPIRACION_ISR_S,
    exclude: [EXCLUIR_DE_ISR],
    ...(token ? { bypassToken: token } : {}),
  };
}

/**
 * ¿Esta ruta se renderiza bajo demanda? En Vercel, las de COMPONENTES_ISR sí;
 * fuera de Vercel (GitHub Pages, `npm run build` local) se prerenderizan.
 * Devuelve `undefined` para las demás: se respeta lo que diga cada archivo.
 * @param {string} componente ruta del archivo, relativa a la raíz y con `/`
 * @param {boolean} enVercel
 * @returns {boolean | undefined}
 */
export function prerenderDe(componente, enVercel) {
  if (!COMPONENTES_ISR.includes(componente)) return undefined;
  return !enVercel;
}

/**
 * Rutas que respetan el `base` de astro.config.mjs.
 *
 * Astro NO reescribe automáticamente los `href` de los enlaces ni las rutas a
 * archivos de `public/`: si el sitio se publica bajo un prefijo (hoy
 * `/proyecto_paginaWeb` en GitHub Pages), un `<a href="/pqrs/">` apuntaría a la
 * raíz del dominio y daría 404. Estas funciones anteponen `BASE_URL` para que
 * el sitio funcione igual con prefijo (GitHub Pages) y sin él (Hostinger),
 * sin tener que tocar ningún componente al mudarlo.
 */

/** `/proyecto_paginaWeb/` hoy; `/` cuando se quite `base`. Siempre con `/` final. */
const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/**
 * Antepone el `base` a una ruta interna.
 *
 * Deja intactas las direcciones que no son rutas del sitio (http, mailto, tel,
 * anclas puras), para poder usarla sin condicionales en listas mixtas.
 *
 * @example ruta('/pqrs/')            -> '/proyecto_paginaWeb/pqrs/'
 * @example ruta('/#haz-tu-pedido')   -> '/proyecto_paginaWeb/#haz-tu-pedido'
 * @example ruta('https://wa.me/...') -> sin cambios
 */
export function ruta(href: string): string {
  if (!href.startsWith('/')) return href; // externo, mailto:, tel:, #ancla
  return `${BASE}${href.slice(1)}`;
}

/**
 * ¿El enlace corresponde a la página que se está viendo?
 *
 * Compara descontando el `base` y las barras finales, porque
 * `Astro.url.pathname` sí incluye el prefijo (`/proyecto_paginaWeb/pqrs/`)
 * mientras que los enlaces se declaran sin él (`/pqrs/`).
 */
export function esActual(href: string, pathname: string): boolean {
  const limpiar = (v: string) => v.replace(/\/+$/, '') || '/';
  const prefijo = limpiar(BASE);
  let actual = limpiar(pathname);

  if (prefijo !== '/' && (actual === prefijo || actual.startsWith(`${prefijo}/`))) {
    actual = limpiar(actual.slice(prefijo.length));
  }

  return limpiar(href) === actual;
}

/**
 * Analítica del sitio: capa sobre el `dataLayer` de Google Tag Manager.
 *
 * POR QUÉ ASÍ
 * -----------
 * El sitio es 100 % estático (Astro en Vercel, con espejo en GitHub Pages): no
 * hay backend donde guardar visitas ni sistema de login propio con el que
 * proteger un panel. Por eso la recolección y el panel los pone GA4, y el
 * control de acceso lo resuelve la propia cuenta de Google: la propiedad se
 * comparte solo con el correo de la persona autorizada. Ver docs/ANALITICA.md.
 *
 * GA4 no se carga directamente: el sitio inyecta el contenedor de Tag Manager
 * (ver Analitica.astro) y la etiqueta de GA4 se crea dentro de ese contenedor.
 * Desde aquí solo se empujan eventos al `dataLayer`; qué se hace con ellos se
 * decide en la interfaz de GTM, sin volver a tocar el código.
 *
 * Este módulo SOLO corre en el navegador (se importa desde los `<script>` de
 * los componentes, nunca desde el frontmatter de un `.astro`).
 *
 * Nada de aquí falla si GTM no llegó a cargar: en `npm run dev`, sin ID de
 * contenedor o con un bloqueador de anuncios, los eventos se acumulan en un
 * array suelto que nadie lee y el resto del sitio funciona igual.
 */

/** Clave de localStorage donde se recuerda la decisión sobre las cookies. */
export const CLAVE_CONSENTIMIENTO = 'dst_consentimiento';

/** `aceptado` habilita la analítica; `necesario` la deja apagada. */
export type Consentimiento = 'aceptado' | 'necesario';

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

/** Parámetros admitidos por GA4 en un evento personalizado. */
export type ParametrosEvento = Record<string, string | number | boolean>;

/**
 * Registra un evento personalizado empujándolo al `dataLayer` de Google Tag
 * Manager.
 *
 * El formato `{ event: 'nombre', ...datos }` es el que GTM sabe leer: cada
 * `event` se conecta a su etiqueta desde la interfaz de Tag Manager, y de ahí
 * pasa a GA4. Antes esta función llamaba a `gtag('event', ...)` directamente;
 * ahora la etiqueta de GA4 vive dentro del contenedor (ver Analitica.astro).
 *
 * El `dataLayer` se crea aquí si todavía no existe. Eso hace que un evento
 * disparado antes de que GTM termine de cargar no se pierda ni lance un error:
 * queda en la cola y el contenedor lo procesa al arrancar. Y si GTM nunca llega
 * a cargar —en `npm run dev`, sin ID de contenedor o con un bloqueador— esto
 * sigue siendo un `push` a un array suelto, así que el resto del sitio funciona
 * exactamente igual.
 *
 * @param nombre  en snake_case y máximo 40 caracteres (límite de GA4).
 * @param params  parámetros del evento. Nunca datos personales del cliente.
 *
 * @example registrarEvento('seccion_vista', { seccion: 'cobertura' })
 */
export function registrarEvento(nombre: string, params?: ParametrosEvento): void {
  if (typeof window === 'undefined') return;
  const capa = (window.dataLayer = window.dataLayer ?? []);
  capa.push({ event: nombre, ...(params ?? {}) });
}

/**
 * Deja un término de búsqueda apto para enviarse a GA4.
 *
 * Los buscadores del sitio (municipio, producto) son campos libres: alguien
 * puede escribir ahí su correo o su teléfono. Esos datos no deben salir del
 * navegador, así que el término se sustituye por `[omitido]` cuando contiene
 * una arroba o siete o más dígitos seguidos.
 */
export function limpiarTermino(texto: string): string {
  const limpio = texto.trim();
  if (limpio === '') return '';
  if (limpio.includes('@')) return '[omitido]';
  if (/\d{7,}/.test(limpio)) return '[omitido]';
  // GA4 corta los valores de texto en 100 caracteres; se recorta antes para
  // que en los informes no aparezcan variantes truncadas del mismo término.
  return limpio.slice(0, 60).toLowerCase();
}

/** Decisión guardada en una visita anterior, o `null` si todavía no eligió. */
export function leerConsentimiento(): Consentimiento | null {
  try {
    const valor = window.localStorage.getItem(CLAVE_CONSENTIMIENTO);
    return valor === 'aceptado' || valor === 'necesario' ? valor : null;
  } catch {
    // Navegación privada o cookies bloqueadas: se trata como "sin decidir".
    return null;
  }
}

/**
 * Guarda la decisión y se la comunica a GA4 con Consent Mode.
 *
 * Mientras `analytics_storage` esté en `denied`, gtag.js no escribe cookies ni
 * identifica al visitante entre páginas; al pasar a `granted` empieza a
 * hacerlo. El cambio se aplica en la misma visita, sin recargar.
 */
export function guardarConsentimiento(valor: Consentimiento): void {
  try {
    window.localStorage.setItem(CLAVE_CONSENTIMIENTO, valor);
  } catch {
    // Si no se puede guardar, la franja volverá a aparecer en la próxima
    // visita. Es molesto, pero preferible a fallar.
  }

  window.gtag?.('consent', 'update', {
    analytics_storage: valor === 'aceptado' ? 'granted' : 'denied',
  });
}

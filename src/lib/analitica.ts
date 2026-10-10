/**
 * Analítica del sitio: eventos propios sobre Vercel Web Analytics.
 *
 * POR QUÉ ASÍ
 * -----------
 * Las visitas las cuenta Vercel Web Analytics (el componente `<Analytics />` de
 * BaseLayout.astro): sin cookies, sin identificar a nadie entre sesiones y con
 * el script servido desde el propio dominio. Por eso ya no hay franja de
 * cookies. Antes había Google Tag Manager detrás de un aviso de consentimiento,
 * pero en producción nunca llegó a tener un ID de contenedor: no medía nada.
 * Ver docs/ANALITICA.md.
 *
 * Los EVENTOS PROPIOS (secciones vistas, clics en WhatsApp, envíos) son de los
 * planes Pro y Enterprise de Vercel. El proyecto está en Hobby, así que
 * `registrarEvento` no manda nada mientras `EVENTOS_PERSONALIZADOS` sea falso:
 * así no se gastan peticiones que Vercel descartaría. Los componentes siguen
 * llamándola, de modo que el día que el plan cambie basta con encender la
 * constante.
 *
 * Este módulo SOLO corre en el navegador (se importa desde los `<script>` de
 * los componentes, nunca desde el frontmatter de un `.astro`). Nada de aquí
 * falla si el script de Vercel no cargó (desarrollo, bloqueadores).
 */
import { track } from '@vercel/analytics';

/**
 * Eventos propios de Vercel Web Analytics: solo en Pro/Enterprise. EDITAR AQUÍ
 * (poner `true`) si el proyecto pasa a un plan que los admita.
 */
export const EVENTOS_PERSONALIZADOS = false;

/** Parámetros admitidos en un evento personalizado (planos, sin objetos). */
export type ParametrosEvento = Record<string, string | number | boolean>;

/**
 * Registra un evento personalizado en Vercel Web Analytics.
 *
 * @param nombre  en snake_case, corto.
 * @param params  parámetros del evento. Nunca datos personales del cliente.
 *
 * @example registrarEvento('seccion_vista', { seccion: 'cobertura' })
 */
export function registrarEvento(nombre: string, params?: ParametrosEvento): void {
  if (!EVENTOS_PERSONALIZADOS || typeof window === 'undefined') return;
  try {
    track(nombre, params);
  } catch {
    // La analítica nunca rompe la página.
  }
}

/**
 * Deja un término de búsqueda apto para enviarse a la analítica.
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
  // Se recorta para que en los informes no aparezcan variantes truncadas del
  // mismo término.
  return limpio.slice(0, 60).toLowerCase();
}

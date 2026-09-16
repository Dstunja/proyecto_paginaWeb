/*
 * Marca <html> con `js-revelado` ANTES de que se pinte el <body>.
 *
 * El CSS esconde lo que se va a revelar al hacer scroll solo cuando esta clase
 * está puesta; ponerla más tarde haría que el contenido apareciera y se ocultara
 * de golpe. Por eso se carga como script clásico, síncrono, en el <head>.
 *
 * La clase solo se añade si hay IntersectionObserver y el sistema no pide menos
 * movimiento: sin ella todo se ve directamente.
 *
 * Es un archivo y no un <script> en línea para que la Content-Security-Policy
 * (vercel.json) no tenga que permitir 'unsafe-inline' en script-src.
 * Lo carga src/layouts/BaseLayout.astro.
 */
if (
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  'IntersectionObserver' in window
) {
  document.documentElement.classList.add('js-revelado');
}

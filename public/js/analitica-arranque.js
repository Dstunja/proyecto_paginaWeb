/*
 * Arranque de gtag (Google Analytics 4) con Consent Mode.
 *
 * Lo carga src/components/Analitica.astro, solo en producción y solo si hay
 * PUBLIC_GA_ID. El ID llega en el atributo `data-ga-id` de la propia etiqueta
 * <script>, así este archivo es estático y la Content-Security-Policy
 * (vercel.json) no tiene que permitir scripts en línea.
 *
 * Tiene que ejecutarse antes que gtag.js y que cualquier `registrarEvento`: por
 * eso es un script clásico y síncrono en el <head>, y gtag.js va detrás con
 * `async`.
 */
(function () {
  var etiqueta = document.currentScript;
  var id = etiqueta && etiqueta.getAttribute('data-ga-id');
  if (!id) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  // Por defecto NADA se almacena: ni cookies de analítica ni publicidad.
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  // Si la persona ya aceptó en una visita anterior, se restablece su decisión
  // antes del primer page_view para no perder esa visita.
  try {
    if (window.localStorage.getItem('dst_consentimiento') === 'aceptado') {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    }
  } catch (e) {}

  gtag('js', new Date());
  gtag('config', id, {
    anonymize_ip: true,
    send_page_view: true,
  });
})();

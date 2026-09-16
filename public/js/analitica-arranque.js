/*
 * Arranque de Google Tag Manager con Consent Mode.
 *
 * Lo carga src/components/Analitica.astro, solo en producción y solo si hay
 * PUBLIC_GTM_CONTAINER_ID. El ID llega en el atributo `data-gtm-id` de la
 * propia etiqueta <script>, así este archivo es estático y la
 * Content-Security-Policy (vercel.json) no tiene que permitir scripts en línea
 * en `script-src`.
 *
 * POR QUÉ EL CONTENEDOR Y NO gtag.js
 * ----------------------------------
 * La etiqueta de GA4 vive DENTRO del contenedor de Tag Manager, creada a mano
 * en su interfaz. Cargar las dos cosas a la vez haría que GA4 contara cada
 * página vista dos veces, así que aquí solo se carga el contenedor. Los eventos
 * del sitio se mandan con `registrarEvento()` de src/lib/analitica.ts, que
 * empuja al `dataLayer` en el formato que GTM sabe leer (`{event: '...'}`).
 *
 * El consentimiento se declara ANTES de pedir el contenedor: si GTM arrancara
 * primero, sus etiquetas podrían dispararse con el consentimiento sin declarar.
 * Por eso este archivo es un script clásico y síncrono en el <head>.
 *
 * El `gtag` que se define aquí es el envoltorio estándar de Google sobre
 * `dataLayer`: es lo que permite que `guardarConsentimiento()` siga funcionando
 * igual, sin que le importe si detrás hay gtag.js o GTM.
 */
(function () {
  var etiqueta = document.currentScript;
  var id = etiqueta && etiqueta.getAttribute('data-gtm-id');
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

  // Fragmento oficial del contenedor, con el ID que llegó por `data-gtm-id`.
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var primero = document.getElementsByTagName('script')[0];
  var js = document.createElement('script');
  js.async = true;
  js.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
  primero.parentNode.insertBefore(js, primero);
})();

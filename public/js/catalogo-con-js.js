/*
 * Catálogo del armador de pedidos: marca que hay JavaScript y pone la red de
 * seguridad del aviso de carga.
 *
 * `data-js` en <html> hace que el CSS muestre el buscador, los filtros y el
 * aviso de carga, que sin JavaScript no sirven. Tiene que ejecutarse en el
 * acto, no cuando llegue el módulo del catálogo: por eso es un script clásico
 * y síncrono.
 *
 * Si a los diez segundos el módulo no ha llegado (red caída, script bloqueado),
 * el aviso pasa a `falló` y se convierte en una explicación con salida por
 * WhatsApp.
 *
 * Es un archivo y no un <script> en línea para que la Content-Security-Policy
 * (vercel.json) no tenga que permitir 'unsafe-inline' en script-src.
 * Lo carga src/components/pedido/CatalogoPedido.astro.
 */
document.documentElement.dataset.js = '1';
setTimeout(function () {
  var aviso = document.querySelector('[data-cargando]');
  if (aviso) aviso.dataset.cargando = 'falló';
}, 10000);

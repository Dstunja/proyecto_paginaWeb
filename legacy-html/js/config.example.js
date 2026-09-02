// PLANTILLA DE CONFIGURACIÓN — copiar como js/config.js en el despliegue.
//
// js/config.js está en .gitignore: NO se versiona y NO debe escribirse a mano
// dentro del HTML. En el servidor se genera desde variables de entorno, p. ej.:
//
//   envsubst < js/config.example.js > js/config.js
//   # o en el pipeline de CI:
//   echo "window.DST_CONFIG={MAPS_PROVIDER:'google',GOOGLE_MAPS_EMBED_KEY:'$GOOGLE_MAPS_EMBED_KEY'};" > js/config.js
//
// IMPORTANTE: cualquier key usada por Google Maps Embed API viaja en la petición
// del navegador, así que nunca es 100 % secreta. La protección real es
// restringirla por referente HTTP (solo dstunja.com) y a la Maps Embed API
// desde Google Cloud Console. Este archivo evita que quede escrita en el HTML
// y en el repositorio.
//
// Si no existe js/config.js, el sitio usa OpenStreetMap, que no requiere key.

window.DST_CONFIG = {
  MAPS_PROVIDER: 'osm',            // 'osm' (sin key) | 'google'
  GOOGLE_MAPS_EMBED_KEY: '${GOOGLE_MAPS_EMBED_KEY}',
  MAP_QUERY: 'Cra 2 Este #58-79, Tunja, Boyacá, Colombia',
  MAP_ZOOM: 8,
  MAP_BBOX: '-74.55,5.35,-72.85,6.85',
  MAP_MARKER: '5.5353,-73.3678'
};

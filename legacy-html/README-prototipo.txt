DISTRIBUCIONES SANTIAGO DE TUNJA - PROTOTIPO LOCAL
====================================================

COMO ABRIRLO
------------
1. Descomprime este ZIP en una carpeta de tu computador.
2. Abre index.html directamente en el navegador (doble clic).
   - El buscador de municipios y el menu movil funcionan sin necesidad
     de servidor.
   - Si algo no carga bien con doble clic, abre la carpeta con un
     servidor local simple, por ejemplo:
       python3 -m http.server 8080
     y entra a http://localhost:8080 en el navegador.

ARCHIVOS
--------
index.html         -> pagina de inicio (la que trabajamos a fondo)
nosotros.html       -> pagina secundaria (contenido de ejemplo, editalo)
catalogo.html       -> pagina secundaria (contenido de ejemplo, editalo)
empleos.html        -> pagina secundaria (contenido de ejemplo, editalo)
contactanos.html    -> pagina secundaria (contenido de ejemplo, editalo)
pqrs.html           -> pagina secundaria (contenido de ejemplo, editalo)
css/styles.css       -> todos los estilos (colores, tipografia, layout)
js/main.js           -> menu movil, buscador de cobertura, boton Pideky,
                        tabs de Mision/Vision y mapa de cobertura
js/config.example.js -> plantilla de configuracion del mapa (API key)
.gitignore           -> excluye js/config.js (con la key) del repositorio

QUE SE MEJORO RESPECTO AL SITIO ACTUAL
---------------------------------------
- Boton flotante de WhatsApp visible en toda la pagina.
- CTA de WhatsApp destacado en el menu principal.
- El boton "Abrir Pideky" ahora avisa si falta el enlace real
  (antes no hacia nada). Busca "EDITAR AQUI" en js/main.js e
  index.html para poner la URL real cuando la tengas.
- Bloque de cifras (21 anos, 87 municipios, +7600 puntos de venta)
  con mas jerarquia visual.
- Seccion de marcas con titulo "Marcas que distribuimos" en vez de
  un carrusel sin contexto.
- Buscador de cobertura por municipio (funcional, con datos de
  ejemplo en js/main.js - reemplaza la lista MUNICIPIOS por la real).
- Menu movil funcional (antes no existia una version mobile clara).
- Tipografia nueva: Nunito / Nunito Sans (sans-serif redondeada, gruesa
  y amigable, en linea con el estilo corporativo de Nutresa). Antes se
  usaba Space Grotesk + Inter.
- Seccion "Mision y Vision" con pestanas interactivas: funcionan con
  clic y con teclado (flechas, Home, End), no dependen de :hover y por
  tanto sirven en movil. Transicion de 240 ms.
- Mapa de cobertura en la seccion "Cobertura nacional", con ficha de la
  sede principal al lado.

MAPA Y API KEY
---------------
Por defecto el mapa usa OpenStreetMap, que NO necesita API key: no hay
ninguna clave escrita en el HTML ni visible en el DOM.

Si en algun momento se quiere usar Google Maps Embed API:
  1. Copia js/config.example.js como js/config.js y pon ahi la key
     (idealmente generando el archivo en el despliegue a partir de una
     variable de entorno, no a mano).
  2. Cambia MAPS_PROVIDER a 'google'.
  3. Descomenta la linea <script src="js/config.js"></script> al final
     de index.html.
js/config.js esta en .gitignore, asi que la key nunca se versiona.

OJO: cualquier key de Google Maps Embed API viaja en la peticion del
navegador, asi que nunca es 100% secreta. La proteccion real es
restringirla en Google Cloud Console por referente HTTP (solo
dstunja.com) y limitarla a la Maps Embed API. Sacarla del HTML evita
que quede publicada en el codigo fuente y en el repositorio.

PARA PERSONALIZAR
------------------
- Colores y tipografia: css/styles.css, al inicio en ":root".
  Las fuentes estan en --font-display y --font-body; el @import de
  Google Fonts es la primera linea del archivo.
- Textos de Mision y Vision: index.html, busca "EDITAR AQUI" dentro de
  la seccion #mision-vision (ahora hay texto de ejemplo).
- Encuadre del mapa: js/main.js, variable MAP_BBOX / bbox por defecto.
- Textos: directamente en cada archivo .html.
- Lista de municipios del buscador: js/main.js, variable MUNICIPIOS.
- Enlace real de Pideky: index.html, atributo data-url del boton
  "Abrir Pideky", y explicacion en js/main.js.

ESTO ES UN PROTOTIPO, NO EL SITIO REAL
----------------------------------------
Estos archivos no estan conectados a dstunja.com ni a WordPress.
Sirven para probar cambios de diseno y navegacion. Cuando quede
aprobado, un desarrollador deberia trasladar estos cambios al
tema de WordPress real (o usar este HTML como referencia).

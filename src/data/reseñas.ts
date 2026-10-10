/**
 * Reseñas de clientes que se muestran en el inicio (componente Resenas.astro).
 *
 * HOY NO HAY RESEÑAS CARGADAS, y a propósito: hasta octubre de 2026 aquí
 * había cuatro testimonios con nombres inventados y una calificación de
 * ejemplo (4,8 · 34) presentados como "Reseñas reales en Google". Eso es
 * publicidad engañosa y se retiró (auditoría, hallazgo D2). Mientras
 * `resenas` esté vacío y `resumenResenas` no traiga promedio ni total, el
 * inicio muestra solo un botón "Ver nuestras reseñas en Google" que lleva a la
 * ficha real del negocio (por su Place ID, src/data/site.ts).
 *
 * NUNCA cargar aquí reseñas de ejemplo ni cifras aproximadas. Solo opiniones
 * reales, copiadas tal cual de la ficha de Google (o traídas por la API), con
 * su autor, y el promedio y total exactos que muestra Google ese día.
 *
 * Cómo cargar reseñas reales A MANO, sin API: abrir la ficha de Google Maps,
 * copiar en `resenas` el nombre del autor, las estrellas, el texto sin editar
 * y la antigüedad ("hace 2 meses"); poner en `url` el enlace a la reseña; y
 * llenar `promedio` y `total` en `resumenResenas`. Hay que refrescarlas con
 * cada publicación (las reglas de Google no permiten guardarlas más de 30
 * días), así que lo recomendable es la API (pasos de abajo).
 *
 * La forma de
 * cada reseña imita la que devuelve la API de Google Places, para que el día
 * que se conecte la cuenta de Google Cloud no haya que tocar el componente:
 * basta con reemplazar de dónde salen `resenas` y `resumenResenas`.
 *
 * Los identificadores van sin eñe ni tildes (`resenas`, `Resena`) para no
 * depender de la codificación en importaciones y búsquedas.
 *
 * ---------------------------------------------------------------------------
 * CÓMO CONECTARLO DESPUÉS A LA API REAL DE GOOGLE PLACES
 * ---------------------------------------------------------------------------
 * 1) Cuenta y permisos (una sola vez, tiene costo):
 *    - Crear un proyecto en Google Cloud y activarle facturación.
 *    - Habilitar "Places API (New)".
 *    - Crear una API key y restringirla (por API, y por IP del servidor donde
 *      se hace el build). NO restringirla por dominio: la consulta se hace en
 *      el servidor de build, no desde el navegador.
 *    - Buscar el Place ID del negocio con el "Place ID Finder" de Google y
 *      guardarlo junto con la key.
 *
 * 2) Variables de entorno (se leen en TIEMPO DE BUILD, ver .env.example):
 *      GOOGLE_PLACES_API_KEY=...
 *      GOOGLE_PLACE_ID=ChIJ...
 *    Nunca usar el prefijo PUBLIC_: eso publicaría la key en el navegador.
 *
 * 3) Consulta (una sola petición por build; devuelve máximo 5 reseñas, las que
 *    Google considera "más útiles", y no se pueden filtrar ni ordenar):
 *
 *      const campos = 'rating,userRatingCount,googleMapsUri,reviews';
 *      const respuesta = await fetch(
 *        `https://places.googleapis.com/v1/places/${import.meta.env.GOOGLE_PLACE_ID}?languageCode=es&fields=${campos}`,
 *        { headers: { 'X-Goog-Api-Key': import.meta.env.GOOGLE_PLACES_API_KEY } },
 *      );
 *      const lugar = await respuesta.json();
 *
 * 4) Traducción de la respuesta a los tipos de este archivo:
 *
 *      const resenas: Resena[] = (lugar.reviews ?? []).map((r) => ({
 *        autor: r.authorAttribution.displayName,
 *        foto: r.authorAttribution.photoUri ?? '',
 *        url: r.authorAttribution.uri ?? '',
 *        estrellas: r.rating,
 *        texto: (r.originalText ?? r.text)?.text ?? '',
 *        fecha: r.relativePublishTime,   // 'hace 2 meses'
 *      }));
 *
 *      const resumenResenas: ResumenResenas = {
 *        promedio: lugar.rating,
 *        total: lugar.userRatingCount,
 *        url: lugar.googleMapsUri,
 *      };
 *
 * 5) Dónde hacerlo: como el sitio es estático, lo natural es consultar en el
 *    build. Dos opciones, de menor a mayor esfuerzo:
 *    a) En el frontmatter de src/pages/index.astro (se ejecuta en el build) y
 *      pasarle los datos al componente por props:
 *        <Resenas resenas={...} resumen={...} />
 *    b) Con un script tipo scripts/geocodificar.mjs que baje las reseñas y
 *       reescriba este archivo; así el sitio compila aunque la API falle.
 *    En ambos casos conviene dejar `resenas` de aquí como respaldo cuando no
 *    haya key o la petición falle, para que la sección nunca quede vacía.
 *
 * 6) Reglas de uso de Google: hay que mostrar el nombre del autor y su foto tal
 *    como vienen, enlazar a la reseña en Google y no editar el texto. El
 *    contenido no se puede almacenar más de 30 días, así que si se guarda en
 *    un archivo hay que refrescarlo con cada publicación.
 */

import { googlePlaceId } from './site';

export interface Resena {
  /** Nombre del autor tal como lo publica Google (authorAttribution.displayName). */
  autor: string;
  /** Foto de perfil (authorAttribution.photoUri). Vacío = se muestran las iniciales. */
  foto?: string;
  /** Enlace a la reseña en Google Maps (authorAttribution.uri). Vacío = sin enlace. */
  url?: string;
  /** Calificación de 1 a 5. */
  estrellas: number;
  /** Texto de la reseña, sin comillas: el componente las pone. */
  texto: string;
  /** Antigüedad como la escribe Google: 'hace 3 meses' (relativePublishTime). */
  fecha: string;
}

export interface ResumenResenas {
  /** Promedio del negocio (rating). Sin dato real, se deja sin definir. */
  promedio?: number;
  /** Cuántas calificaciones hay en total (userRatingCount). Sin dato real, sin definir. */
  total?: number;
  /** Ficha del negocio en Google Maps (googleMapsUri). */
  url: string;
}

/**
 * EDITAR AQUÍ: reseñas REALES de la ficha de Google, copiadas sin editar.
 * Vacío = el inicio no muestra tarjetas de reseñas, solo el botón a la ficha.
 */
export const resenas: Resena[] = [];

/**
 * EDITAR AQUÍ: promedio y total EXACTOS de la ficha de Google Maps.
 *
 * Mientras no se copien de la ficha (o lleguen de la API en `rating` y
 * `userRatingCount`), van sin definir y el inicio no muestra ninguna cifra:
 * una calificación que no coincida con la ficha de Google es peor que ninguna.
 *
 * El enlace abre la ficha real del negocio por su Place ID (formato
 * documentado de las "Maps URLs" de Google).
 */
export const resumenResenas: ResumenResenas = {
  url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    'Distribuciones Santiago de Tunja',
  )}&query_place_id=${googlePlaceId}`,
};

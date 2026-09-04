/**
 * Reseñas de clientes que se muestran en el inicio (componente Resenas.astro).
 *
 * Hoy los datos son LOCALES: se editan a mano en este archivo. La forma de
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
  /** Promedio del negocio (rating). */
  promedio: number;
  /** Cuántas calificaciones hay en total (userRatingCount). */
  total: number;
  /** Ficha del negocio en Google Maps (googleMapsUri). */
  url: string;
}

/**
 * EDITAR AQUÍ: mientras no esté conectada la API, estas son reseñas de EJEMPLO
 * (no son opiniones reales de clientes). Reemplazarlas por reseñas reales con
 * autorización, o dejar que la API las sobrescriba.
 */
export const resenas: Resena[] = [
  {
    autor: 'Luis Alberto Pineda',
    foto: '',
    url: '',
    estrellas: 5,
    texto:
      'Llevo tres años pidiéndoles para la tienda y el camión nunca me ha fallado. El asesor pasa puntual cada semana y siempre resuelve.',
    fecha: 'hace 2 meses',
  },
  {
    autor: 'Yenny Rodríguez',
    foto: '',
    url: '',
    estrellas: 5,
    texto:
      'Excelente surtido de Nutresa y precios que sí dejan margen. Me ayudaron a organizar la exhibición del negocio y se notó en las ventas.',
    fecha: 'hace 4 meses',
  },
  {
    autor: 'Carlos Fonseca',
    foto: '',
    url: '',
    estrellas: 4,
    texto:
      'Muy buen servicio y entregas cumplidas en Duitama. A veces se agota algún producto de promoción, pero avisan a tiempo y lo reponen al pedido siguiente.',
    fecha: 'hace 6 meses',
  },
  {
    autor: 'Marisol Vargas',
    foto: '',
    url: '',
    estrellas: 5,
    texto:
      'Pedí por WhatsApp y me despacharon el mismo día. Gente seria y muy amable, se nota la experiencia que tienen en la región.',
    fecha: 'hace 8 meses',
  },
];

/**
 * EDITAR AQUÍ: promedio y total de calificaciones del negocio en Google.
 * Cuando se conecte la API estos dos números llegan en `rating` y
 * `userRatingCount`; el enlace es el de la ficha en Google Maps.
 */
export const resumenResenas: ResumenResenas = {
  promedio: 4.8,
  total: 34,
  url: 'https://www.google.com/maps/search/?api=1&query=Distribuciones%20Santiago%20de%20Tunja%2C%20Tunja%2C%20Boyac%C3%A1',
};

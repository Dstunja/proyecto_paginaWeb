/**
 * Innovaciones y novedades de la empresa, ordenadas de la más reciente a la
 * más antigua. Alimentan la página /innovacion/.
 *
 * IMÁGENES
 * --------
 * `imagen` apunta a un archivo dentro de public/img/innovacion/. Mientras no
 * exista, el sitio muestra un marcador de posición azul con el título, así que
 * se puede publicar el texto antes de tener la foto.
 *
 * Formato recomendado: JPG o WebP en 16:9 (por ejemplo 1200x675).
 */

export interface Innovacion {
  /** Mes o fecha visible, tal como se quiere leer: 'Marzo 2026'. */
  fecha: string;
  /** Fecha ISO solo para ordenar. Formato AAAA-MM. */
  orden: string;
  titulo: string;
  descripcion: string;
  /** Ruta dentro de public/. Vacío = marcador de posición. */
  imagen: string;
  /** Etiqueta corta opcional: 'Tecnología', 'Logística', 'Equipo'... */
  etiqueta?: string;
}

/**
 * EDITAR AQUÍ: novedades reales de la empresa (una por mes o por evento).
 * Si el arreglo queda vacío, la página muestra un mensaje de "pronto" en vez
 * de una rejilla vacía.
 */
export const innovaciones: Innovacion[] = [];

/** Novedades de la más reciente a la más antigua. */
export const innovacionesOrdenadas = [...innovaciones].sort((a, b) =>
  b.orden.localeCompare(a.orden),
);

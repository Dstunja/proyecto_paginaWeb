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
export const innovaciones: Innovacion[] = [
  {
    fecha: 'Marzo 2026',
    orden: '2026-03',
    etiqueta: 'Tecnología',
    titulo: 'Pedidos en línea con Pideky',
    descripcion:
      'Los tenderos de Tunja y alrededores ya pueden hacer su pedido desde el celular, ver el catálogo de su zona y pagar en línea sin registro previo.',
    // EDITAR AQUÍ: reemplazar con imagen real de Pedidos en línea con Pideky
    // -> public/img/innovacion/pideky.jpg
    imagen: '/img/innovacion/pideky.jpg',
  },
  {
    fecha: 'Febrero 2026',
    orden: '2026-02',
    etiqueta: 'Logística',
    titulo: 'Renovación de la flota de reparto',
    descripcion:
      'Incorporamos nuevos vehículos a las rutas de Boyacá y Santander para acortar los tiempos de entrega y mejorar el cuidado del producto en ruta.',
    // EDITAR AQUÍ: reemplazar con imagen real de Renovación de la flota
    // -> public/img/innovacion/flota.jpg
    imagen: '/img/innovacion/flota.jpg',
  },
  {
    fecha: 'Enero 2026',
    orden: '2026-01',
    etiqueta: 'Equipo',
    titulo: 'Formación comercial para asesores',
    descripcion:
      'Arrancó el plan de formación del equipo comercial, enfocado en asesoría al tendero, manejo de inventario y uso de las herramientas digitales.',
    // EDITAR AQUÍ: reemplazar con imagen real de Formación comercial
    // -> public/img/innovacion/formacion.jpg
    imagen: '/img/innovacion/formacion.jpg',
  },
];

/** Novedades de la más reciente a la más antigua. */
export const innovacionesOrdenadas = [...innovaciones].sort((a, b) =>
  b.orden.localeCompare(a.orden),
);

/**
 * Especiales del mes: productos con una colaboración o una edición de
 * temporada. Alimentan la sección "Especiales del mes" del inicio.
 *
 * ESTA LISTA SE CAMBIA MES A MES. Es contenido de temporada, no catálogo: aquí
 * solo van las ediciones especiales, colaboraciones y lanzamientos que están
 * sonando ahora. El catálogo permanente vive en src/data/productos.ts y no se
 * toca desde aquí.
 *
 * CÓMO ACTUALIZARLA CADA MES
 * --------------------------
 *  1. Cambiar `periodoTemporada` al mes que se está mostrando.
 *  2. Dejar en `productosTemporada` solo los productos vigentes.
 *
 * Si el arreglo queda VACÍO, la sección entera desaparece del inicio: no queda
 * un bloque vacío ni un título sin nada debajo (ver EspecialesMes.astro). Ese
 * es el comportamiento correcto cuando no hay nada especial que mostrar.
 *
 * IMÁGENES
 * --------
 * `imagen` apunta a un archivo dentro de public/img/temporada/. Mientras el
 * archivo no exista, el sitio muestra un marcador de posición azul de
 * placehold.co con el nombre del producto, así que la sección se puede
 * publicar antes de tener las fotos. Al dejar la foto real en su carpeta, la
 * siguiente compilación la toma sin tocar el código.
 *
 * Formato recomendado: JPG o WebP en 16:10 (por ejemplo 1000x625), con el
 * empaque centrado y fondo claro.
 */

export interface ProductoTemporada {
  /** Nombre del producto tal como se quiere leer en la tarjeta. */
  nombre: string;
  /** Marca a la que pertenece: 'Festival', 'Jumbo'… */
  marca: string;
  /** Descripción corta, de una o dos líneas: 'Edición especial X'. */
  descripcion: string;
  /** Ruta dentro de public/. Si el archivo no existe, se usa un marcador. */
  imagen: string;
  /** Etiqueta corta opcional: 'Nuevo', 'Edición limitada'… */
  etiqueta?: string;
}

/**
 * Mes o temporada que se está mostrando, tal como se quiere leer.
 *
 * EDITAR AQUÍ: actualizarlo cada vez que cambien los productos de abajo, para
 * que la sección no anuncie un mes que ya pasó.
 */
export const periodoTemporada = 'Septiembre 2026';

/**
 * EDITAR AQUÍ: los productos de temporada vigentes.
 *
 * Los textos de abajo son los datos que se tienen hoy de cada colaboración;
 * conviene confirmarlos con el material oficial de la marca antes de publicar.
 */
export const productosTemporada: ProductoTemporada[] = [
  {
    nombre: 'Galletas Festival',
    marca: 'Festival',
    descripcion: 'Edición especial de la colaboración con KPop Demon Hunters.',
    etiqueta: 'Edición limitada',
    // EDITAR AQUÍ: reemplazar con imagen real del producto
    // -> public/img/temporada/festival-kpop-demon-hunters.jpg
    imagen: '/img/temporada/festival-kpop-demon-hunters.jpg',
  },
  {
    nombre: 'Chocolatina Jumbo Bombie',
    marca: 'Jumbo',
    descripcion: 'Edición especial de la colaboración con Ryan Castro.',
    etiqueta: 'Nuevo',
    // EDITAR AQUÍ: reemplazar con imagen real del producto
    // -> public/img/temporada/jumbo-bombie-ryan-castro.jpg
    imagen: '/img/temporada/jumbo-bombie-ryan-castro.jpg',
  },
];

/** ¿Hay algo de temporada que mostrar? Si no, la sección no se dibuja. */
export const hayEspecialesDelMes = productosTemporada.length > 0;

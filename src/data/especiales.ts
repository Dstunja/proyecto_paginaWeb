/**
 * Especiales del mes: productos con una colaboración o una edición especial de
 * marca. Alimentan la sección "Especiales del mes" del inicio.
 *
 * NO CONFUNDIR CON src/data/temporada.ts
 * --------------------------------------
 * Son dos cosas distintas y las dos están vivas en el inicio:
 *
 *   - Este archivo (especiales.ts) son las COLABORACIONES y ediciones
 *     especiales de las marcas —Festival con KPop Demon Hunters, Jumbo con
 *     Ryan Castro—. Se curan a mano y se cambian mes a mes: no dependen del
 *     calendario, sino de qué lanzó la marca.
 *
 *   - temporada.ts son las TEMPORADAS COMERCIALES del año (Amor y Amistad,
 *     Halloween, Navidad), cada una con su rango de fechas, y se prenden y
 *     apagan solas según el día en que se visite el sitio.
 *
 * El catálogo permanente, aparte de las dos, vive en src/data/productos.ts.
 *
 * CÓMO ACTUALIZAR ESTA LISTA CADA MES
 * -----------------------------------
 *  1. Cambiar `periodoEspeciales` al mes que se está mostrando.
 *  2. Dejar en `especialesDelMes` solo los productos vigentes.
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

export interface ProductoEspecial {
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
 * Mes que se está mostrando, tal como se quiere leer.
 *
 * EDITAR AQUÍ: actualizarlo cada vez que cambien los productos de abajo, para
 * que la sección no anuncie un mes que ya pasó.
 */
export const periodoEspeciales = 'Septiembre 2026';

/**
 * EDITAR AQUÍ: las ediciones especiales y colaboraciones vigentes.
 *
 * Los textos de abajo son los datos que se tienen hoy de cada colaboración;
 * conviene confirmarlos con el material oficial de la marca antes de publicar.
 */
export const especialesDelMes: ProductoEspecial[] = [
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

/** ¿Hay alguna edición especial que mostrar? Si no, la sección no se dibuja. */
export const hayEspecialesDelMes = especialesDelMes.length > 0;

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * `periodoEspeciales` convertido a 'AAAA-MM', que es el formato con el que la
 * línea de tiempo de /innovacion/ ordena sus entradas (el campo `orden` de
 * src/data/innovaciones.ts).
 *
 * Se deriva del texto en vez de pedir una segunda fecha escrita a mano: al
 * cambiar de mes solo se toca `periodoEspeciales` y los especiales se
 * recolocan solos entre las novedades de la empresa.
 *
 * Si el texto no tiene la forma 'Mes AAAA' —porque alguien escribió algo como
 * 'Temporada escolar'— se devuelve un valor que ordena por encima de todo: los
 * especiales son lo vigente, y quedar arriba es mejor que hundirse al final de
 * la línea de tiempo.
 */
export const ordenEspeciales: string = (() => {
  const [mes, anio] = periodoEspeciales.trim().toLowerCase().split(/\s+/);
  const numeroMes = MESES.indexOf(mes ?? '') + 1;
  if (!numeroMes || !/^\d{4}$/.test(anio ?? '')) return '9999-99';
  return `${anio}-${String(numeroMes).padStart(2, '0')}`;
})();

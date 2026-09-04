/**
 * Especiales del mes: productos con una colaboración o una edición especial de
 * marca. Alimentan la sección "Especiales del mes" del inicio.
 *
 * QUÉ ENTRA AQUÍ
 * --------------
 * Las COLABORACIONES y ediciones especiales de las marcas —Festival con KPop
 * Demon Hunters, Jumbo con Ryan Castro—. Se curan a mano y se cambian mes a
 * mes: no dependen del calendario, sino de qué lanzó la marca.
 *
 * Es la única fuente de destacados del inicio. El catálogo permanente vive
 * aparte, en src/data/productos.ts.
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
 * `imagen` es una ruta dentro de public/ (hoy las fotos reales están en
 * public/img/innovacion/ y las pendientes apuntan a public/img/temporada/).
 * Mientras el archivo no exista, el sitio muestra un marcador de posición azul
 * de placehold.co con el nombre del producto, así que la sección se puede
 * publicar antes de tener las fotos. Al dejar la foto real en su carpeta, la
 * siguiente compilación la toma sin tocar el código.
 *
 * Las fotos deben ir LIMPIAS: sin precio, sin oferta, sin tabla de datos.
 * Sirve cualquier proporción (vertical u horizontal): la tarjeta encaja la
 * foto completa sin recortarla y rellena el resto con un desenfoque de la
 * misma imagen.
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
  /* ------------------------------------------------------------------------
     Con foto real. Los siete están confirmados con cobertura NACIONAL (para
     todos los clientes), así que no llevan restricción de zona. Las fotos
     están en public/img/innovacion/, ya limpias: sin precio ni texto de
     oferta. Van primero para que el carrusel abra con fotos y no con
     marcadores de posición.
     ------------------------------------------------------------------------ */
  {
    nombre: 'Jumbo Pistacho Dubai Style',
    marca: 'Jumbo',
    descripcion: 'Chocolatina con relleno de crema de pistacho estilo Dubái, barra de 90 g.',
    etiqueta: 'Nuevo',
    imagen: '/img/innovacion/jumbo-pistacho-dubai.jpg',
  },
  {
    nombre: 'Jet Pistacho Dubai Style',
    marca: 'Jet',
    descripcion: 'Chocolatina Jet con relleno de pistacho estilo Dubái, caja de 8 unidades.',
    etiqueta: 'Nuevo',
    imagen: '/img/innovacion/jet-pistacho-dubai.jpg',
  },
  {
    nombre: 'Jet Burbujas Pistacho Dubai',
    marca: 'Jet',
    descripcion: 'Chocolate aireado con relleno de pistacho estilo Dubái, caja de 4 unidades.',
    etiqueta: 'Nuevo',
    imagen: '/img/innovacion/jet-burbujas-pistacho-dubai.jpg',
  },
  {
    nombre: 'Bénet Magnesio Gomas',
    marca: 'Bénet',
    descripcion: 'Gomas de citrato de magnesio sabor arándano azul, frasco de 48 gomas.',
    imagen: '/img/innovacion/benet-magnesio.jpg',
  },
  {
    nombre: 'Badia Ajo Fino Picado con Limón y Albahaca',
    marca: 'Badia',
    descripcion: 'Ajo finamente picado con limón y albahaca, frasco de 226,7 g.',
    imagen: '/img/innovacion/badia-ajo-limon-albahaca.jpg',
  },
  {
    nombre: 'Badia Ajo Fino Picado con Pimienta Roja',
    marca: 'Badia',
    descripcion: 'Ajo finamente picado con pimienta roja, frasco de 226,7 g.',
    imagen: '/img/innovacion/badia-ajo-pimienta-roja.jpg',
  },
  {
    nombre: 'Badia Ajo Negro Picado en Agua',
    marca: 'Badia',
    descripcion: 'Ajo negro finamente picado en agua, frasco de 226,7 g.',
    imagen: '/img/innovacion/badia-ajo-negro.jpg',
  },

  /* ------------------------------------------------------------------------
     Colaboraciones todavía sin foto: se muestran con marcador de posición.
     ------------------------------------------------------------------------ */
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

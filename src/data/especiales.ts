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
 *  2. Dejar en `especialesCurados` solo los productos vigentes.
 *  3. Ponerle a cada uno su `codigo` SAP, si ya está confirmado (ver «Código y
 *     precio» abajo).
 *
 * Si el arreglo queda VACÍO, la sección entera desaparece del inicio: no queda
 * un bloque vacío ni un título sin nada debajo (ver EspecialesMes.astro). Ese
 * es el comportamiento correcto cuando no hay nada especial que mostrar.
 *
 * CÓDIGO Y PRECIO
 * ---------------
 * `codigo` es el código SAP de la referencia del catálogo (src/data/productos.ts)
 * a la que corresponde el especial. De ella salen, al compilar, la presentación
 * y el precio que muestra la tarjeta, con el mismo criterio que el catálogo del
 * armador de pedidos: `detalleReferencia` (src/lib/carrito.ts) y `bloquePrecio`
 * (src/lib/plantillasCatalogo.ts). Aquí NO se escribe ningún precio: se corrige
 * donde se corrige el del catálogo (src/data/precios.ts), y así el especial y
 * su ficha nunca pueden decir cifras distintas.
 *
 * Si el código no existe en el catálogo, o aparece en más de una referencia, la
 * compilación FALLA diciendo qué especial es. Un código mal copiado publicaría
 * «Precio a consultar», o el precio de otro producto, sin que nadie se enterara.
 *
 * Un especial SIN código se muestra sin presentación ni precio. Es lo correcto
 * mientras no esté confirmado a qué referencia corresponde: cruzar por parecido
 * de nombre no es fiable, porque dos referencias de la misma marca pueden
 * cambiar solo en la presentación.
 *
 * Ojo con la `descripcion`: va en la misma tarjeta que el precio, así que no
 * puede contradecir la unidad a la que corresponde la cifra. Si el PSP es por
 * unidad, la descripción no debe decir «caja de 8».
 *
 * PENDIENTES
 * ----------
 * `pendiente` guarda por qué un especial todavía no se puede publicar. Mientras
 * tenga texto el especial NO sale en ninguna parte —ni en el inicio ni en
 * /innovacion/—, pero se queda en la lista con su motivo para no perder el
 * rastro. Al confirmarlo se borra el campo; si resulta ser una ficha de
 * prueba, se borra el especial entero.
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
  /**
   * Código SAP de su referencia en src/data/productos.ts. De ahí salen la
   * presentación y el precio de la tarjeta. Sin código, la tarjeta no muestra
   * ninguno de los dos. Ver «Código y precio» arriba.
   */
  codigo?: string;
  /**
   * Por qué todavía no se publica. Con texto, el especial no sale en el sitio.
   * Ver «Pendientes» arriba.
   */
  pendiente?: string;
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
 *
 * Los códigos SAP se cruzaron contra el deck "MASIVO 1.0" página por página,
 * comprobando además que la unidad del PSP cuadra con la descripción de la
 * tarjeta. Jumbo Pistacho y los dos Jet ya compartían foto con su referencia
 * del catálogo, que es donde las fotos se asignan por código.
 */
const especialesCurados: ProductoEspecial[] = [
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
    codigo: '1089478',
  },
  {
    nombre: 'Jet Pistacho Dubai Style',
    marca: 'Jet',
    // En el deck es "Jet Postres Dubai Style". Se vende en plegadiza de 8, pero
    // su PSP es POR UNIDAD de 29 g: la descripción decía "caja de 8 unidades",
    // y junto al precio se leía como si la caja costara eso.
    descripcion: 'Chocolatina Jet con relleno de pistacho estilo Dubái, unidad de 29 g.',
    etiqueta: 'Nuevo',
    imagen: '/img/innovacion/jet-pistacho-dubai.jpg',
    codigo: '1089477',
  },
  {
    nombre: 'Jet Burbujas Pistacho Dubai',
    marca: 'Jet',
    // Aquí el PSP sí es por la caja de 4 (plegadiza), así que la descripción
    // puede decirlo.
    descripcion: 'Chocolate aireado con relleno de pistacho estilo Dubái, caja de 4 unidades.',
    etiqueta: 'Nuevo',
    imagen: '/img/innovacion/jet-burbujas-pistacho-dubai.jpg',
    codigo: '1089476',
  },
  {
    nombre: 'Bénet Magnesio Gomas',
    marca: 'Bénet',
    descripcion: 'Gomas de citrato de magnesio sabor arándano azul, frasco de 48 gomas.',
    imagen: '/img/innovacion/benet-magnesio.jpg',
    // PENDIENTE DE CÓDIGO: la foto y la descripción son "Magnesio, sabor
    // arándano azul", pero la página del deck del único candidato (2037218)
    // es "Citrato de Magnesio, sabor mora": mismo frasco de 48 gomas, otro
    // producto. Sin código hasta que el asesor confirme cuál es; mientras, la
    // tarjeta se publica como antes, sin presentación ni precio.
  },
  {
    nombre: 'Badia Ajo Fino Picado con Limón y Albahaca',
    marca: 'Badia',
    descripcion: 'Ajo finamente picado con limón y albahaca, frasco de 226,7 g.',
    imagen: '/img/innovacion/badia-ajo-limon-albahaca.jpg',
    codigo: '2034008',
  },
  {
    nombre: 'Badia Ajo Fino Picado con Pimienta Roja',
    marca: 'Badia',
    descripcion: 'Ajo finamente picado con pimienta roja, frasco de 226,7 g.',
    imagen: '/img/innovacion/badia-ajo-pimienta-roja.jpg',
    codigo: '2034009',
  },
  {
    nombre: 'Badia Ajo Negro Picado en Agua',
    marca: 'Badia',
    descripcion: 'Ajo negro finamente picado en agua, frasco de 226,7 g.',
    imagen: '/img/innovacion/badia-ajo-negro.jpg',
    codigo: '2034015',
  },

  /* ------------------------------------------------------------------------
     Colaboraciones todavía sin foto: se muestran con marcador de posición.
     ------------------------------------------------------------------------ */
  {
    // Antes decía "Bombie": es Blondie, como lo llaman el deck ("Jumbo Ryan
    // Castro 2.0 Blondie"), el maestro de SAP ("RyaCast Blan") y el empaque
    // ("EDICIÓN BLONDIE").
    nombre: 'Chocolatina Jumbo Blondie',
    marca: 'Jumbo',
    descripcion: 'Edición especial de la colaboración con Ryan Castro.',
    etiqueta: 'Nuevo',
    // EDITAR AQUÍ: reemplazar con imagen real del producto (la barra suelta,
    // sin precio ni texto de oferta)
    // -> public/img/temporada/jumbo-blondie-ryan-castro.jpg
    imagen: '/img/temporada/jumbo-blondie-ryan-castro.jpg',
    // Hay dos presentaciones de la misma barra de 170 g: 1092005 (caja x 6) y
    // 1092006 (caja x 3). Va la de 3 porque el deck la asigna a los segmentos
    // TD, CL, MM y CE —la de 6 va a S, CR, MY y SU— y porque es la única de
    // las dos que está en el maestro de precios de SAP de la distribuidora.
    // El PSP de las dos es el mismo y es POR BARRA, no por caja.
    codigo: '1092006',
  },

  /* ------------------------------------------------------------------------
     PENDIENTES: no se publican (ver «Pendientes» en la cabecera).
     ------------------------------------------------------------------------ */
  {
    nombre: 'Galletas Festival',
    marca: 'Festival',
    descripcion: 'Edición especial de la colaboración con KPop Demon Hunters.',
    etiqueta: 'Edición limitada',
    imagen: '/img/temporada/festival-kpop-demon-hunters.jpg',
    // NO cargar código ni foto hasta que el asesor lo confirme. Si resulta ser
    // una ficha de prueba, se borra esta entrada en vez de completarla.
    pendiente:
      'Confirmar con el asesor: la referencia no está en el deck de Nutresa y no hay evidencia pública de la colaboración con KPop Demon Hunters.',
  },
];

/**
 * Los especiales que SÍ se publican: la lista de arriba sin los pendientes.
 *
 * Es lo único que se exporta, a propósito: así ninguna vista —el inicio o
 * /innovacion/— puede sacar por descuido un especial sin confirmar.
 */
export const especialesDelMes: ProductoEspecial[] = especialesCurados.filter(
  (producto) => !producto.pendiente?.trim(),
);

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

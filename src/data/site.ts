/**
 * Fuente única de verdad del sitio: datos de la empresa, navegación, marcas y
 * cobertura. Editar aquí en vez de tocar cada página.
 */

export const empresa = {
  nombre: 'Distribuciones Santiago de Tunja',
  razonSocial: 'Distribuciones Santiago de Tunja S.A.S.',
  sigla: 'DST',
  descripcion:
    'Distribuidores líderes del departamento de Boyacá, Cundinamarca y Santander. Calidad y cumplimiento en cada entrega.',
  telefono: '310 623 2429',
  telefonoE164: '+573106232429',
  whatsapp: 'https://wa.me/573106232429',
  email: 'informacioncomercialdst@gmail.com',
  direccion: 'Cra 2 Este #58‑79',
  ciudad: 'Tunja',
  departamento: 'Boyacá',
  pais: 'CO',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Cra%202%20Este%2058-79%2C%20Tunja%2C%20Boyac%C3%A1',
} as const;

export const redes = [
  {
    nombre: 'Facebook',
    icono: 'facebook',
    url: 'https://www.facebook.com/p/Distribuciones-Santiago-de-Tunja-61552074267660/',
  },
  { nombre: 'X', icono: 'x', url: 'https://x.com/DSTunja123' },
  { nombre: 'Instagram', icono: 'instagram', url: 'https://www.instagram.com/dis.santiagotunja/' },
  {
    nombre: 'WhatsApp',
    icono: 'whatsapp',
    url: 'https://whatsapp.com/channel/0029VbCwVYV6GcG6JJFLvg22',
  },
] as const;

export const navegacion = [
  { texto: 'Inicio', href: '/' },
  { texto: 'Nosotros', href: '/nosotros/' },
  { texto: 'Catálogo', href: '/catalogo/' },
  { texto: 'Innovación', href: '/innovacion/' },
  { texto: 'Empleos', href: '/empleos/' },
  { texto: 'Contáctanos', href: '/contactanos/' },
  { texto: 'PQRS', href: '/pqrs/' },
] as const;

/** Barra de cifras del hero: cada una con su ícono. */
export const cifras = [
  { valor: '21', etiqueta: 'años de experiencia', icono: 'award' },
  { valor: '1', etiqueta: 'punto de venta', icono: 'store' },
  { valor: '87', etiqueta: 'municipios', icono: 'map-pin' },
  { valor: '3', etiqueta: 'departamentos', icono: 'map' },
] as const;

/**
 * Marcas de la franja "Marcas que distribuimos" del inicio.
 *
 * Es una fila de logotipos, así que aquí solo van las marcas que tienen su
 * archivo en src/assets/marcas/: una marca en texto plano en medio de los
 * logos se lee como un hueco, no como una marca más. Las demás del portafolio
 * siguen apareciendo en el catálogo y en el armador de pedidos, que sí las
 * muestran como píldora de texto cuando no hay logo.
 *
 * El inicio filtra esta lista contra los archivos que existen de verdad (ver
 * src/pages/index.astro), de modo que si un logo se borra o se renombra, la
 * marca desaparece de la franja en vez de dejar una imagen rota.
 *
 * El listado completo del portafolio, con las 34 marcas del catálogo, está en
 * src/data/productos.ts (MARCAS); esta lista no lo reemplaza.
 */
export const marcasDeLaFranja = [
  'Zenú', // EDITAR AQUÍ: foto de empaque, reemplazar con logo limpio
  'Noel',
  'Ducales',
  'Saltín Noel',
  'Dux', // EDITAR AQUÍ: foto de empaque, reemplazar con logo limpio
  'Festival',
  'Sello Rojo', // EDITAR AQUÍ: foto de empaque, reemplazar con logo limpio
  'La Bastilla',
  'Colcafé',
  'Matiz', // EDITAR AQUÍ: foto de empaque, reemplazar con logo limpio
  'Jet',
  'Jumbo', // EDITAR AQUÍ: foto de empaque, reemplazar con logo limpio
  'Corona',
  'Choco Listo', // EDITAR AQUÍ: recorte descuadrado, reemplazar con logo limpio
  'Doria',
  'Gol',
  'Haka',
  'La Especial', // EDITAR AQUÍ: foto de empaque, reemplazar con logo limpio
  'Bénet',
  'Badia',
] as const;

/*
 * Los siete logotipos marcados arriba no son logotipos sino recortes de una
 * foto del empaque, así que tienen poco detalle real y se ven blandos al lado
 * de los demás. No hay forma de inventarles resolución desde el código: hay
 * que reemplazar el archivo en src/assets/marcas/.
 *
 * Por orden de urgencia:
 *   - Dux: el recorte deja ver pedazos de los sellos de advertencia
 *     nutricional ("EXCESO GRASAS SATURADAS") y texto cortado del empaque.
 *   - La Especial y Matiz: recortes con bordes del empaque a la vista.
 *   - Choco Listo: el logotipo queda descuadrado y cortado por la derecha.
 *   - Zenú, Sello Rojo y Jumbo: los tres que ya venían de antes.
 *
 * Dónde buscar el reemplazo: la biblioteca de medios del sitio actual en
 * WordPress (dstunja.com/wp-admin -> Medios). Lo ideal es un .svg o un .png
 * con fondo transparente de al menos 600 px de ancho.
 *
 * NUTRESA queda fuera de esta lista a propósito, y por eso su archivo se
 * llama comercial-nutresa.jpg y no nutresa.jpg: con el nombre de la marca lo
 * tomarían solas la franja y la píldora del catálogo, y el logotipo es el
 * corporativo de "Comercial Nutresa", la comercializadora del grupo, no la
 * marca de producto "Nutresa" del portafolio. En una franja titulada "Marcas
 * que distribuimos" invierte la relación real —DST distribuye PARA Comercial
 * Nutresa, no distribuye a Comercial Nutresa— y en la categoría "Nueces y
 * otros" del catálogo confundiría la marca de frutos secos con la razón
 * social. Mientras tanto Nutresa se sigue mostrando como texto.
 *
 * Para activarlo, si se decide que sí representa bien a la marca: renombrar
 * el archivo a nutresa.jpg y agregar 'Nutresa' a la lista de arriba.
 */

/**
 * Nombres de marca del portafolio, para textos y referencias generales.
 * Para la franja de logos del inicio se usa `marcasDeLaFranja`.
 */
export const marcas = [
  'Nutresa', 'Zenú', 'Noel', 'Ducales', 'Saltín Noel', 'Sello Rojo', 'La Especial',
  'Rica', 'Choco Listo', 'Matiz', 'La Bastilla', 'Dux', 'Jumbo', 'Corona', 'Jet',
] as const;

export const cobertura = [
  { departamento: 'Boyacá', municipios: 67 },
  { departamento: 'Santander', municipios: 18 },
  { departamento: 'Cundinamarca', municipios: 2 },
] as const;

/**
 * Los municipios cubiertos (con sus coordenadas para el mapa) viven ahora en
 * src/data/municipios.ts, que es lo que usa la sección "Cobertura nacional".
 */

/**
 * EDITAR AQUÍ: URL real de la app / web de Pideky cuando exista.
 * Mientras esté vacía, el botón avisa que falta configurarla.
 */
export const PIDEKY_URL = '';

/**
 * Imagen principal del hero (portada). Hoy muestra la ilustración de la mascota
 * de la empresa (el búho conductor) sobre el camión de reparto.
 *
 * EDITAR AQUÍ: reemplazar cuando se suba la foto real de [bodega/equipo/flota].
 * Basta con dejar el archivo en public/img/marca/ y cambiar estas dos constantes
 * (la ruta y su texto alternativo): el hero de src/pages/index.astro las lee de
 * aquí y no hay que tocar el maquetado. Si HERO_IMAGEN se deja vacío, el hero
 * vuelve al panel de marca con el isotipo.
 */
export const HERO_IMAGEN = '/img/marca/mascota-camion.jpg';

/**
 * Texto alternativo de la imagen del hero. Debe describir la foto que esté
 * puesta en HERO_IMAGEN, así que se actualiza junto con ella.
 */
export const HERO_IMAGEN_ALT =
  'La mascota de Distribuciones Santiago de Tunja al volante del camión de reparto, cargado con el portafolio';

/** Valor agregado (home). */
export const valorAgregado = [
  {
    num: '01',
    icono: 'truck',
    titulo: 'Distribución eficiente',
    texto:
      'Llegamos a 87 municipios de tres departamentos, con entregas semanales garantizadas de manera segura y responsable.',
  },
  {
    num: '02',
    icono: 'package',
    titulo: 'Portafolio variado',
    texto:
      'Contamos con una amplia variedad de productos de la marca Nutresa, una de las compañías de alimentos más importantes de Latinoamérica.',
  },
  {
    num: '03',
    icono: 'headset',
    titulo: 'Modelo de atención masivo',
    texto:
      'Ofrecemos atención personalizada, televenta y digital (Pideky) para ayudarle a maximizar la rotación de sus inventarios.',
  },
] as const;

/**
 * Sección "Para tu negocio" (home).
 * Cada tarjeta es un enlace: además de contar el beneficio, lleva a la página
 * donde se puede actuar sobre él.
 */
export const beneficios = [
  {
    icono: 'shield-check',
    titulo: 'Productos de calidad',
    texto: 'Las mejores marcas del país, con manejo y almacenamiento cuidado en toda la ruta.',
    enlace: '/catalogo/',
    enlaceTexto: 'Ver el portafolio',
  },
  {
    icono: 'badge-percent',
    titulo: 'Precios competitivos',
    texto: 'Ofertas y promociones de la quincena pensadas para el margen de tu negocio.',
    enlace: '/catalogo/',
    enlaceTexto: 'Pedir la lista de precios',
  },
  {
    icono: 'user-check',
    titulo: 'Asesoría personalizada',
    texto: 'Un asesor de tu zona que conoce tu tienda y te ayuda a rotar el inventario.',
    enlace: '/contactanos/',
    enlaceTexto: 'Hablar con un asesor',
  },
  {
    icono: 'clock',
    titulo: 'Entregas confiables',
    texto: 'Frecuencia semanal y cumplimiento para que tu negocio no se detenga.',
    enlace: '/#cobertura',
    enlaceTexto: 'Ver la cobertura',
  },
] as const;

/**
 * EDITAR AQUÍ: testimonio real de un cliente (con su autorización).
 * `foto` puede ser la ruta de una imagen en public/; si queda vacía se
 * muestran las iniciales.
 */
export const testimonio = {
  texto:
    'Santiago de Tunja es un aliado que siempre está presente en nuestro negocio. Nunca nos han quedado mal con una entrega.',
  nombre: 'María Gómez',
  negocio: 'Tienda La Economía',
  ciudad: 'Duitama',
  estrellas: 5,
  foto: '',
} as const;

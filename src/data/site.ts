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

/**
 * Cuántos clientes atiende la empresa, en el texto EXACTO que se publica.
 *
 * Es una cifra redondeada a la baja y se escribe siempre igual —con el signo
 * "+" delante y el punto de miles— en todos los lugares donde aparezca: la
 * barra de cifras del inicio y el encabezado de la sección de cobertura. Antes
 * cada sitio mostraba un número distinto (el conteo crudo de la base de datos
 * en cobertura, "1 punto de venta" en la barra), y dos cifras que no cuadran
 * se leen como un error, no como dos medidas distintas.
 *
 * Ojo: src/data/clientes-municipio.ts sí tiene el conteo real por municipio,
 * pero ese dato es INTERNO —alimenta el tamaño de los puntos del mapa— y no se
 * publica. Al actualizarlo, esta cifra se revisa aparte y a mano.
 *
 * EDITAR AQUÍ cuando la empresa quiera publicar otra cifra.
 */
export const CLIENTES_TEXTO = '+7.000';

/** Barra de cifras del hero: cada una con su ícono. */
export const cifras = [
  { valor: '21', etiqueta: 'años de experiencia', icono: 'award' },
  { valor: CLIENTES_TEXTO, etiqueta: 'clientes atendidos', icono: 'users' },
  { valor: '87', etiqueta: 'municipios', icono: 'map-pin' },
  { valor: '3', etiqueta: 'departamentos', icono: 'map' },
] as const;

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

/**
 * Sección "Para tu negocio" (home): la ÚNICA propuesta de valor del inicio.
 *
 * Antes había dos bloques diciendo lo mismo con otras palabras —"Nuestro valor
 * agregado" (01/02/03) y estas cuatro tarjetas—, uno detrás del otro. Se
 * conservaron las tarjetas, que además de contar el beneficio llevan a la
 * página donde se puede actuar sobre él, y en ellas se absorbió lo que solo
 * decía el bloque numerado:
 *
 *   01 Distribución eficiente  -> "Entregas confiables" (87 municipios, 3
 *                                 departamentos, entrega semanal)
 *   02 Portafolio variado      -> "Productos de calidad" (aliados de Nutresa)
 *   03 Atención masiva         -> "Asesoría personalizada" (asesor de zona,
 *                                 televenta y pedido en línea)
 */
export const beneficios = [
  {
    icono: 'shield-check',
    titulo: 'Productos de calidad',
    texto:
      'El portafolio de Grupo Nutresa y las mejores marcas del país, con manejo y almacenamiento cuidado en toda la ruta.',
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
    texto:
      'Un asesor de tu zona que conoce tu tienda, con televenta y pedido en línea para que rotes el inventario sin esperas.',
    enlace: '/contactanos/',
    enlaceTexto: 'Hablar con un asesor',
  },
  {
    icono: 'truck',
    titulo: 'Entregas confiables',
    texto:
      'Reparto semanal a 87 municipios de tres departamentos, de forma segura y cumplida, para que tu negocio no se detenga.',
    enlace: '/#cobertura',
    enlaceTexto: 'Ver la cobertura',
  },
] as const;

/*
 * El testimonio suelto de ejemplo ("María Gómez, Tienda La Economía") se quitó
 * del inicio: era un cliente inventado presentado como real. Los testimonios
 * del sitio son ahora únicamente las reseñas de Google (Resenas.astro), que
 * cualquiera puede ir a verificar en la ficha del negocio.
 */

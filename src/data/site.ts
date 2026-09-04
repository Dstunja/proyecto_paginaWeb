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
 * Título legible de cada página, para la ruta de migas (Breadcrumb.astro).
 *
 * La clave es la ruta SIN el `base` y con la barra final, tal como se escribe
 * en `navegacion`. Es un mapa aparte y no el `texto` de `navegacion` porque no
 * todas las páginas están en el menú (privacidad, 404, las ofertas de empleo) y
 * porque el rótulo del menú puede ser más corto que el nombre de la página.
 *
 * Las migas NUNCA se arman con `Astro.url.pathname`: ese valor incluye el
 * prefijo del despliegue y produciría "/proyecto_paginaWeb/pedido/" en pantalla,
 * que no le dice nada a nadie. Si una página no está en este mapa, su plantilla
 * pasa el título por prop (ver `Props.migaTitulo` en PageHero.astro); y si no
 * hay ninguno de los dos, las migas simplemente no se dibujan.
 *
 * EDITAR AQUÍ al agregar una página nueva.
 */
export const titulosDePagina: Record<string, string> = {
  '/nosotros/': 'Nosotros',
  '/catalogo/': 'Catálogo',
  '/pedido/': 'Arma tu pedido',
  '/innovacion/': 'Innovación',
  '/empleos/': 'Empleos',
  '/contactanos/': 'Contáctanos',
  '/pqrs/': 'PQRS',
  '/privacidad/': 'Tratamiento de datos',
};

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
 * Clientes que se MUESTRAN en el resumen de la sección "Cobertura nacional".
 *
 * OJO: son cifras de comunicación, no el conteo real. La empresa comunica una
 * red de 7.000 clientes, así que el titular y los tres contadores de esa
 * sección salen de aquí y no de la base de datos.
 *
 * El conteo real por municipio sigue intacto en src/data/clientes-municipio.ts
 * y es el que alimenta los puntos del mapa, su tamaño y el buscador. Ese
 * archivo NO debe tocarse para cuadrar estas cifras.
 *
 * El reparto respeta la misma proporción que los datos reales —Boyacá 82,3 %,
 * Santander 15,2 %, Cundinamarca 2,5 %— para que la foto siga siendo fiel.
 *
 * EDITAR AQUÍ si cambia la cifra que se comunica: basta con ajustar los tres
 * números; el total se calcula sumándolos, así que el texto y los contadores no
 * pueden quedar contradiciéndose.
 */
const CLIENTES_COMUNICADOS = {
  Boyacá: 5763,
  Santander: 1063,
  Cundinamarca: 174,
} as const;

export const resumenCobertura = {
  clientesPorDepartamento: CLIENTES_COMUNICADOS,
  /** Suma de los tres departamentos: 7.000. */
  totalClientes: Object.values(CLIENTES_COMUNICADOS).reduce((suma, n) => suma + n, 0),
};

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

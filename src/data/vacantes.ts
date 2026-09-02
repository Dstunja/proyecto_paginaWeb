/**
 * Vacantes y convocatorias abiertas.
 *
 * Cada entrada genera una tarjeta en /empleos/ y su propia página de detalle
 * en /empleos/<slug>/, pensada para mostrar el flyer completo con todos los
 * requisitos.
 *
 * IMÁGENES
 * --------
 * El campo `imagen` apunta a un archivo dentro de public/img/empleos/.
 * Mientras el archivo no exista (o el campo esté vacío) el sitio muestra un
 * marcador de posición azul con el nombre de la vacante, así que nada se ve
 * roto: basta con dejar el archivo en la carpeta y volver a compilar.
 *
 * Formato recomendado: JPG o WebP, proporción 4:3 (por ejemplo 1200x900) para
 * la tarjeta. El flyer vertical también sirve: en la página de detalle se
 * muestra completo, sin recortar.
 */

export interface Vacante {
  /** Identificador para la URL: /empleos/<slug>/ */
  slug: string;
  cargo: string;
  ciudad: string;
  tipo: string;
  /** Frase corta para la tarjeta del listado. */
  resumen: string;
  /** Ruta dentro de public/. Vacío = marcador de posición. */
  imagen: string;
  /** Párrafos de la descripción larga (página de detalle). */
  descripcion: string[];
  requisitos: string[];
  /** Qué ofrece la empresa. Opcional. */
  ofrecemos?: string[];
}

/**
 * EDITAR AQUÍ: vacantes reales.
 * Si el arreglo queda vacío, /empleos/ muestra el mensaje de "no hay vacantes
 * abiertas" y la persona igual puede dejar su hoja de vida.
 */
export const vacantes: Vacante[] = [
  {
    slug: 'auxiliar-de-bodega',
    cargo: 'Auxiliar de bodega',
    ciudad: 'Tunja, Boyacá',
    tipo: 'Tiempo completo',
    resumen: 'Alistamiento, cargue y control de inventario en la sede principal.',
    // EDITAR AQUÍ: reemplazar con imagen real de Auxiliar de bodega
    // -> public/img/empleos/auxiliar-de-bodega.jpg
    imagen: '/img/empleos/auxiliar-de-bodega.jpg',
    descripcion: [
      'Buscamos una persona ordenada y con buena disposición física para el alistamiento de pedidos en nuestra bodega de Tunja.',
      'El trabajo es en equipo, con turnos definidos y acompañamiento del jefe de bodega desde el primer día.',
    ],
    requisitos: [
      'Bachiller académico culminado',
      'Experiencia mínima de 6 meses en bodega o almacén',
      'Manejo básico de inventarios',
      'Disponibilidad para trabajar por turnos',
    ],
    ofrecemos: ['Contrato a término fijo con posibilidad de renovación', 'Todas las prestaciones de ley', 'Dotación completa'],
  },
  {
    slug: 'conductor-repartidor',
    cargo: 'Conductor repartidor',
    ciudad: 'Boyacá y Santander',
    tipo: 'Tiempo completo',
    resumen: 'Entrega en ruta a puntos de venta. Se requiere licencia C1 vigente.',
    // EDITAR AQUÍ: reemplazar con imagen real de Conductor repartidor
    // -> public/img/empleos/conductor-repartidor.jpg
    imagen: '/img/empleos/conductor-repartidor.jpg',
    descripcion: [
      'Responsable de la entrega de producto en la ruta asignada, cumpliendo el itinerario y las condiciones de manejo de cada línea.',
      'Es la cara de la empresa frente al tendero: buscamos a alguien puntual, cuidadoso con el producto y amable en la atención.',
    ],
    requisitos: [
      'Licencia de conducción C1 vigente',
      'Experiencia mínima de 1 año en reparto o distribución',
      'Conocimiento de las vías de Boyacá y Santander',
      'Disponibilidad para viajar dentro de la región',
    ],
    ofrecemos: ['Vehículo y combustible a cargo de la empresa', 'Auxilio de alimentación en ruta', 'Todas las prestaciones de ley'],
  },
  {
    slug: 'asesor-comercial',
    cargo: 'Asesor comercial',
    ciudad: 'Zona centro',
    tipo: 'Tiempo completo',
    resumen: 'Atención y crecimiento de la cartera de tenderos asignada.',
    // EDITAR AQUÍ: reemplazar con imagen real de Asesor comercial
    // -> public/img/empleos/asesor-comercial.jpg
    imagen: '/img/empleos/asesor-comercial.jpg',
    descripcion: [
      'Atiende la cartera de tiendas de su zona, toma el pedido, presenta las promociones de la quincena y ayuda al tendero a rotar el inventario.',
      'Trabajo de calle con acompañamiento del supervisor comercial y metas claras por período.',
    ],
    requisitos: [
      'Bachiller o técnico en áreas comerciales',
      'Experiencia mínima de 1 año en ventas de consumo masivo',
      'Manejo de aplicaciones móviles de toma de pedidos',
      'Actitud de servicio y trabajo en equipo',
    ],
    ofrecemos: ['Salario básico más comisiones', 'Auxilio de transporte y rodamiento', 'Plan de formación comercial'],
  },
  {
    // EDITAR AQUÍ: este es el ejemplo de convocatoria tipo flyer ("Buscamos
    // vehículos"). Ajusta el texto y sube el flyer real a
    // public/img/empleos/buscamos-vehiculos.jpg
    slug: 'buscamos-vehiculos',
    cargo: 'Buscamos vehículos',
    ciudad: 'Boyacá, Santander y Cundinamarca',
    tipo: 'Convocatoria abierta',
    resumen: 'Vinculamos vehículos con conductor para las rutas de distribución.',
    imagen: '/img/empleos/buscamos-vehiculos.jpg',
    descripcion: [
      'Estamos vinculando vehículos de carga con conductor para atender las rutas de distribución en los tres departamentos.',
      'Si tienes tu vehículo al día y quieres trabajar con nosotros, envíanos tus datos y te contactamos con las condiciones de la ruta disponible.',
    ],
    requisitos: [
      'Vehículo tipo turbo o NHR en buen estado',
      'Documentos del vehículo al día (SOAT, técnico-mecánica, tarjeta de propiedad)',
      'Licencia de conducción vigente para la categoría del vehículo',
      'Seguridad social activa',
      'Disponibilidad de tiempo completo de lunes a sábado',
    ],
  },
];

/** Búsqueda por slug, para la página de detalle. */
export function vacantePorSlug(slug: string): Vacante | undefined {
  return vacantes.find((v) => v.slug === slug);
}

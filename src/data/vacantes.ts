/**
 * Vacantes y convocatorias abiertas.
 *
 * Cada entrada genera una tarjeta en /empleos/ y su propia página de detalle
 * en /empleos/<slug>/, con el flyer completo, los requisitos, lo que ofrece la
 * empresa y los datos de contacto.
 *
 * IMÁGENES
 * --------
 * El campo `imagen` apunta a un archivo dentro de public/img/empleos/. Si el
 * archivo no existe todavía se muestra un marcador de posición con el nombre
 * del cargo, así que nada se ve roto. La extensión del archivo real puede
 * diferir de la que está escrita aquí: se busca por nombre.
 */

/** Contacto de selección de personal, común a todas las convocatorias. */
export const contactoEmpleo = {
  email: 'ghsantiagodetunja@gmail.com',
  whatsapp: { numero: '573106232429', texto: '310 623 2429' },
} as const;

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
  /** Qué ofrece la empresa. */
  ofrecemos?: string[];
  /** Segundo número de WhatsApp, si la convocatoria lo tiene. */
  whatsappExtra?: { numero: string; texto: string };
}

/**
 * EDITAR AQUÍ: vacantes reales.
 * Si el arreglo queda vacío, /empleos/ muestra el mensaje de "no hay vacantes
 * abiertas" y la persona igual puede dejar su hoja de vida.
 */
export const vacantes: Vacante[] = [
  {
    slug: 'supervisor-ventas-tat',
    cargo: 'Supervisor de Ventas TAT',
    ciudad: 'Tunja, Boyacá',
    tipo: 'Tiempo completo',
    resumen: 'Lidera y acompaña en calle al equipo de ventas TAT de la zona.',
    imagen: '/img/empleos/supervisor-ventas-tat.jpg',
    descripcion: [
      'Buscamos un supervisor de ventas TAT para acompañar al equipo comercial en la zona de Tunja: seguimiento en calle, cumplimiento de metas y relación con los tenderos.',
    ],
    requisitos: [
      'Técnico o tecnólogo',
      '1 año de experiencia',
      'Fluidez verbal',
      'Moto propia',
      'Documentos al día',
    ],
    ofrecemos: [
      'Salario base',
      'Comisiones',
      'Bonos por cumplimiento',
      'Crecimiento laboral',
      'Buen ambiente laboral',
    ],
  },
  {
    slug: 'vendedor-tat',
    cargo: 'Vendedor TAT',
    ciudad: 'Tunja, Boyacá',
    tipo: 'Tiempo completo',
    resumen: 'Atiende la ruta de tiendas asignada y toma el pedido en el punto de venta.',
    imagen: '/img/empleos/vendedor-tat.jpg',
    descripcion: [
      'Buscamos vendedores TAT para atender la ruta de tiendas de Tunja: visita al punto de venta, toma de pedido y presentación del portafolio.',
    ],
    requisitos: [
      'Técnico o tecnólogo',
      '1 año de experiencia',
      'Fluidez verbal',
      'Preferiblemente con moto',
    ],
    ofrecemos: ['Salario base', 'Comisiones', 'Bonos por cumplimiento'],
  },
  {
    slug: 'buscamos-vehiculos',
    cargo: 'Buscamos Vehículos',
    ciudad: 'Tunja y alrededores',
    tipo: 'Convocatoria abierta',
    resumen: 'Vinculamos vehículos para recibir y entregar pedidos en Tunja y alrededores.',
    imagen: '/img/empleos/buscamos-vehiculos.png',
    descripcion: [
      'Estamos vinculando vehículos para recibir y entregar pedidos en Tunja y alrededores.',
      'Si tu vehículo está en buen estado y con los documentos al día, escríbenos y te contamos las condiciones de la ruta disponible.',
    ],
    requisitos: [
      'Vehículos en buen estado',
      'Documentos al día: SOAT, técnico-mecánica, impuestos y seguro',
      'Capacidad para carga de pedidos',
      'Disponibilidad y compromiso',
    ],
    ofrecemos: ['Alianzas estables', 'Oportunidad de crecimiento', 'Pagos puntuales'],
    whatsappExtra: { numero: '573108788754', texto: '310 878 8754' },
  },
];

/** Búsqueda por slug, para la página de detalle. */
export function vacantePorSlug(slug: string): Vacante | undefined {
  return vacantes.find((v) => v.slug === slug);
}

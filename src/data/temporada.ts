/**
 * "Especiales del mes": productos destacados según la temporada o fecha
 * especial que esté corriendo (Amor y Amistad, Halloween, Navidad...).
 *
 * Es contenido que se cambia cada cierto tiempo, no una sección fija del menú:
 * los productos de aquí aparecen en el inicio solo mientras corre su rango de
 * fechas y desaparecen solos cuando termina.
 *
 * NO CONFUNDIR CON src/data/especiales.ts
 * ---------------------------------------
 * Este archivo son las TEMPORADAS COMERCIALES del año, que se prenden y
 * apagan solas por fecha. Las COLABORACIONES y ediciones especiales de marca
 * (Festival con KPop Demon Hunters, Jumbo con Ryan Castro) van en
 * especiales.ts, se curan a mano y no dependen del calendario.
 *
 * Los dos archivos se editan por SEPARADO, pero en el inicio se muestran juntos
 * en un solo bloque, "Novedades y temporada" (NovedadesTemporada.astro):
 * primero la temporada vigente —tiene fecha de vencimiento— y después los
 * especiales del mes.
 *
 * FECHAS
 * ------
 * `inicio` y `fin` van en formato 'MM-DD' (mes y día, sin año) porque estas
 * fechas se repiten cada año. El rango incluye los dos extremos y puede
 * cruzar el fin de año (por ejemplo Navidad: '11-15' → '01-06').
 *
 * IMÁGENES
 * --------
 * `imagen` es una ruta dentro de public/img/temporada/. Mientras el archivo
 * no exista se muestra un marcador de posición de placehold.co con el nombre
 * del producto (ver `imagenOMarcador` en src/lib/imagenes.ts).
 */

export interface ProductoTemporada {
  nombre: string;
  /** Ruta dentro de public/. Vacío = marcador de posición. */
  imagen: string;
  marca: string;
  /** Opcional: frase corta de venta debajo del nombre. */
  nota?: string;
}

export interface Temporada {
  /** Nombre visible de la temporada, por ejemplo 'Amor y Amistad'. */
  nombre: string;
  /** Frase corta que acompaña al título. */
  descripcion: string;
  /** 'MM-DD' — primer día en que se muestra la sección. */
  inicio: string;
  /** 'MM-DD' — último día en que se muestra (incluido). */
  fin: string;
  productos: ProductoTemporada[];
}

/**
 * EDITAR AQUÍ: actualizar productos según la temporada activa.
 *
 * Cada mes basta con cambiar los productos de la temporada que viene, o
 * agregar una temporada nueva a esta lista con sus fechas. Los productos de
 * abajo son de ejemplo y usan imágenes de marcador de posición.
 */
export const temporadas: Temporada[] = [
  {
    nombre: 'Amor y Amistad',
    descripcion: 'Surte tu tienda para el mes de los detalles: chocolates, dulces y galletas.',
    inicio: '09-01',
    fin: '09-30',
    productos: [
      {
        nombre: 'Chocolatina Jet surtida',
        imagen: '/img/temporada/jet-surtida.jpg',
        marca: 'Jet',
        nota: 'La caja que nunca falta en el detalle.',
      },
      {
        nombre: 'Bombonbum surtido',
        imagen: '/img/temporada/bombonbum.jpg',
        marca: 'Colombina',
        nota: 'Ideal para armar anchetas y sorpresas.',
      },
      {
        nombre: 'Galletas Ducales familiar',
        imagen: '/img/temporada/ducales-familiar.jpg',
        marca: 'Ducales',
        nota: 'Presentación grande para compartir.',
      },
    ],
  },
  {
    nombre: 'Halloween',
    descripcion: 'Dulces y confites para la noche de brujas, listos para la vitrina.',
    inicio: '10-15',
    fin: '11-02',
    productos: [
      {
        nombre: 'Confites surtidos',
        imagen: '/img/temporada/confites-surtidos.jpg',
        marca: 'Colombina',
        nota: 'Bolsa grande para repartir.',
      },
      {
        nombre: 'Chocolatinas Jet mini',
        imagen: '/img/temporada/jet-mini.jpg',
        marca: 'Jet',
        nota: 'El clásico del "dulce o truco".',
      },
    ],
  },
  {
    nombre: 'Navidad',
    descripcion: 'El portafolio de la novena: galletas, café y chocolate de mesa.',
    inicio: '11-15',
    fin: '01-06',
    productos: [
      {
        nombre: 'Surtido navideño Noel',
        imagen: '/img/temporada/surtido-noel.jpg',
        marca: 'Noel',
        nota: 'La caja de galletas de la temporada.',
      },
      {
        nombre: 'Café Sello Rojo 500 g',
        imagen: '/img/temporada/sello-rojo.jpg',
        marca: 'Sello Rojo',
        nota: 'Para las novenas y la mesa de diciembre.',
      },
      {
        nombre: 'Chocolate Corona pastilla',
        imagen: '/img/temporada/corona-pastilla.jpg',
        marca: 'Corona',
        nota: 'Chocolate de mesa, alta rotación en diciembre.',
      },
    ],
  },
];

/** Convierte 'MM-DD' en un número comparable (0901 -> 901). */
function aNumero(mmdd: string): number {
  const [mes, dia] = mmdd.split('-').map(Number);
  return (mes ?? 0) * 100 + (dia ?? 0);
}

/** ¿La fecha cae dentro del rango, contando los rangos que cruzan el año? */
function estaVigente(temporada: Temporada, hoy: number): boolean {
  const inicio = aNumero(temporada.inicio);
  const fin = aNumero(temporada.fin);
  return inicio <= fin ? hoy >= inicio && hoy <= fin : hoy >= inicio || hoy <= fin;
}

/**
 * Temporada que corresponde a la fecha dada, o `null` si ninguna está
 * vigente (en cuyo caso la sección del inicio no se muestra).
 *
 * Si dos rangos se solapan gana el primero de la lista.
 */
export function temporadaActiva(fecha: Date = new Date()): Temporada | null {
  const hoy = (fecha.getMonth() + 1) * 100 + fecha.getDate();
  return temporadas.find((t) => estaVigente(t, hoy)) ?? null;
}

/** Rango en texto para mostrarlo junto al título: '1 sep – 30 sep'. */
export function rangoLegible(temporada: Temporada): string {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const legible = (mmdd: string) => {
    const [mes, dia] = mmdd.split('-').map(Number);
    return `${dia} ${MESES[(mes ?? 1) - 1]}`;
  };
  return `${legible(temporada.inicio)} – ${legible(temporada.fin)}`;
}

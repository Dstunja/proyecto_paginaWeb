/**
 * Equipo directivo que se muestra en /nosotros/.
 *
 * EDITAR AQUÍ: reemplazar con fotos y datos reales del equipo directivo.
 * Los nombres, cargos y frases de abajo son de ejemplo y las fotos son
 * marcadores de posición de placehold.co.
 *
 * FOTOS
 * -----
 * Deja cada foto en public/img/equipo/ y pon aquí su ruta, por ejemplo
 * '/img/equipo/gerente-general.jpg'. Mientras el archivo no exista se dibuja
 * un marcador con las iniciales de la persona, así que la sección nunca se ve
 * rota (ver `imagenOMarcador` en src/lib/imagenes.ts). Lo ideal son fotos
 * cuadradas (mismo alto y ancho), porque se recortan en círculo.
 */

export interface Persona {
  nombre: string;
  cargo: string;
  /** Ruta dentro de public/. Vacío = marcador de posición. */
  foto: string;
  /** Opcional: frase corta de la persona (una o dos líneas). */
  frase?: string;
}

export const equipo: Persona[] = [
  {
    nombre: 'Nombre Apellido',
    cargo: 'Gerente General',
    foto: '/img/equipo/gerente-general.jpg',
    frase: 'Cada entrega cumplida es una tienda que sigue abierta.',
  },
  {
    nombre: 'Nombre Apellido',
    cargo: 'Coordinador Comercial',
    foto: '/img/equipo/coordinador-comercial.jpg',
    frase: 'Conocer el negocio del cliente es la mitad de la venta.',
  },
  {
    nombre: 'Nombre Apellido',
    cargo: 'Coordinador Logístico',
    foto: '/img/equipo/coordinador-logistico.jpg',
    frase: 'La ruta se planea para que ningún municipio se quede esperando.',
  },
  {
    nombre: 'Nombre Apellido',
    cargo: 'Coordinadora de Talento Humano',
    foto: '/img/equipo/talento-humano.jpg',
  },
];

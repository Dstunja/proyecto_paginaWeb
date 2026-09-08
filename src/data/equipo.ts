/**
 * Equipo directivo que se muestra en /nosotros/.
 *
 * Los nombres y cargos de abajo son los reales. Quedan dos cosas pendientes:
 * las fotos (ver abajo) y el nombre de quien ocupa el cargo de Líder
 * Logístico, que todavía no está definido.
 *
 * FOTOS
 * -----
 * Deja cada foto en public/img/equipo/ y pon aquí su ruta, por ejemplo
 * '/img/equipo/gerente-general.jpg'. Mientras el archivo no exista se dibuja
 * un marcador con las iniciales de la persona, así que la sección nunca se ve
 * rota (ver `imagenOMarcador` en src/lib/imagenes.ts). Lo ideal son fotos
 * cuadradas (mismo alto y ancho), porque se recortan en círculo.
 *
 * FRASES
 * ------
 * Las cuatro están vacías a propósito y quedan PENDIENTES de que cada persona
 * aporte la suya. Antes había frases de ejemplo, pero al poner los nombres
 * reales pasaban a leerse como citas textuales de gente que nunca las dijo.
 * La tarjeta no dibuja nada cuando la frase está vacía, así que se pueden ir
 * llenando de una en una sin que la sección se descuadre.
 */

export interface Persona {
  /** Vacío = el cargo está sin cubrir; la tarjeta muestra «Próximamente». */
  nombre: string;
  cargo: string;
  /** Ruta dentro de public/. Vacío = marcador de posición. */
  foto: string;
  /** Frase corta de la persona (una o dos líneas). Vacío = no se muestra. */
  frase?: string;
}

export const equipo: Persona[] = [
  {
    nombre: 'Nelson Arias',
    cargo: 'Gerente General',
    foto: '/img/equipo/gerente-general.jpg',
    frase: '',
  },
  {
    nombre: 'Camilo Acero',
    cargo: 'Coordinador Comercial',
    foto: '/img/equipo/coordinador-comercial.jpg',
    frase: '',
  },
  {
    nombre: 'Erica Abril',
    cargo: 'Coordinadora de Recursos Humanos',
    foto: '/img/equipo/recursos-humanos.jpg',
    frase: '',
  },
  {
    // PENDIENTE: falta definir quién ocupa este cargo. Mientras `nombre` esté
    // vacío la tarjeta muestra «Próximamente» y el avatar lleva las iniciales
    // del cargo. Al saberlo, basta con escribir el nombre aquí.
    nombre: '',
    cargo: 'Líder Logístico',
    foto: '/img/equipo/lider-logistico.jpg',
    frase: '',
  },
];

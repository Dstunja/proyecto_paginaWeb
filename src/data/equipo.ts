/**
 * Equipo directivo que se muestra en /nosotros/.
 *
 * Los nombres y cargos de abajo son los reales. Quedan pendientes las fotos de
 * Nelson Arias y del Líder Logístico, y el nombre de quien ocupa ese último
 * cargo, que todavía no está definido.
 *
 * FOTOS
 * -----
 * Cada foto se nombra por la PERSONA, no por el cargo ('erica-abril.webp' y no
 * 'talento-humano.webp'): los cargos se renombran cada tanto y arrastraban con
 * ellos el nombre del archivo. La excepción es el Líder Logístico, que se queda
 * con el nombre del cargo porque todavía no se sabe quién lo ocupa.
 *
 * Mientras el archivo no exista se dibuja un marcador con las iniciales de la
 * persona, así que la sección nunca se ve rota (ver `imagenOMarcador` en
 * src/lib/imagenes.ts) y las fotos se pueden ir poniendo de una en una.
 *
 * La foto tiene que ser CUADRADA, porque la tarjeta la recorta en círculo. Las
 * que llegan del celular son verticales, así que no se suben tal cual: pasan
 * por `npm run fotos:equipo` (scripts/recortar-fotos-equipo.mjs), que recorta
 * el cuadrado centrado en la cara, lo deja en 480x480 WebP y le quita los
 * metadatos EXIF. Los originales sin recortar NO van al repositorio —son fotos
 * del personal—: viven en `recursos/fotos-equipo/`, que .gitignore excluye.
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
    // PENDIENTE: falta la foto. Hasta que esté, la tarjeta muestra 'NA'.
    foto: '/img/equipo/nelson-arias.jpg',
    frase: '',
  },
  {
    nombre: 'Camilo Acero',
    cargo: 'Líder Comercial',
    foto: '/img/equipo/camilo-acero.webp',
    frase: '',
  },
  {
    nombre: 'Erica Abril',
    cargo: 'Talento Humano',
    foto: '/img/equipo/erica-abril.webp',
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

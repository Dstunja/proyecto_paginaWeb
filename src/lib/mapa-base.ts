/**
 * Fondo (teselas) de los mapas del sitio.
 *
 * Está en un solo archivo para que los dos mapas —el de cobertura del inicio y
 * el de la sede en Contáctanos— se vean siempre igual y cambiar de proveedor
 * sea una línea.
 *
 * QUÉ USAR
 * --------
 * Hoy está activo **OpenStreetMap estándar**: el mapa clásico a color, con
 * calles, edificios, parques en verde, agua en azul y los nombres de
 * municipios y veredas.
 *
 * Si el sitio empieza a recibir mucho tráfico conviene pasar a CARTO Voyager
 * (igual de colorido, pero servido desde una CDN pensada para producción):
 * los servidores de teselas de OpenStreetMap son donados y su política de uso
 * pide no apoyarse en ellos para aplicaciones con mucho público. Para cambiar,
 * basta con exportar `FONDOS.cartoVoyager` en `FONDO`, abajo.
 *
 * En ambos casos la atribución es obligatoria por licencia y se muestra en la
 * esquina inferior derecha del mapa; no se debe quitar.
 */

export interface FondoMapa {
  url: string;
  opciones: {
    maxZoom: number;
    attribution: string;
    subdomains?: string;
  };
}

const ATRIBUCION_OSM =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

export const FONDOS: Record<string, FondoMapa> = {
  /** Mapa clásico de OpenStreetMap, a todo color. */
  openstreetmap: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opciones: {
      maxZoom: 19,
      attribution: ATRIBUCION_OSM,
    },
  },

  /** CARTO Voyager: mismos datos de OpenStreetMap, colores algo más suaves y
   *  CDN preparada para volúmenes altos. */
  cartoVoyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    opciones: {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: `${ATRIBUCION_OSM} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>`,
    },
  },
};

/** Fondo activo en todo el sitio. Cambiar aquí para usar el otro proveedor. */
export const FONDO: FondoMapa = FONDOS.openstreetmap;

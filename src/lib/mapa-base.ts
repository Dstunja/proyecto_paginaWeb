/**
 * Fondo (teselas) de los mapas del sitio.
 *
 * Está en un solo archivo para que los dos mapas —el de cobertura del inicio y
 * el de la sede en Contáctanos— se vean siempre igual y cambiar de proveedor
 * sea una línea.
 *
 * QUÉ USAR
 * --------
 * Hoy está activo **OpenStreetMap Humanitarian (HOT)**, servido por
 * OpenStreetMap France: los mismos datos de OpenStreetMap con un estilo más
 * claro y más verde, sin el sombreado de relieve del mapa estándar y con menos
 * ruido de etiquetas. Se eligió para que el fondo acompañe a los puntos de la
 * red en vez de competir con ellos.
 *
 * OJO CON CARTO: la entrada `cartoVoyager` de aquí abajo ya NO se puede activar
 * tal cual. Sus teselas anónimas se siguen sirviendo con HTTP 200 —no falla
 * nada de forma visible— pero vienen con la marca de agua «API KEY REQUIRED»
 * impresa sobre la propia imagen. Para usarla hace falta cuenta en CARTO y
 * añadir la clave a la URL. Se deja escrita porque es la que más se acerca al
 * aspecto de Google Maps el día que se consiga esa clave, no porque sirva hoy.
 *
 * En todos los casos la atribución es obligatoria por licencia y se muestra en
 * la esquina inferior derecha del mapa; no se debe quitar.
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
  /** Estilo Humanitarian (HOT) sobre datos de OpenStreetMap, servido por
   *  OpenStreetMap France. Claro, verde suave y sin relieve. El del sitio. */
  osmHot: {
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    opciones: {
      maxZoom: 19,
      subdomains: 'ab',
      attribution: `${ATRIBUCION_OSM} &middot; teselas <a href="https://www.hotosm.org/" target="_blank" rel="noopener">HOT</a> / <a href="https://openstreetmap.fr/" target="_blank" rel="noopener">OSM France</a>`,
    },
  },

  /** Mapa clásico de OpenStreetMap, a todo color. Más nombres y más relieve. */
  openstreetmap: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opciones: {
      maxZoom: 19,
      attribution: ATRIBUCION_OSM,
    },
  },

  /** CARTO Voyager. NO USAR SIN CLAVE: las teselas anónimas salen con la marca
   *  de agua «API KEY REQUIRED». Requiere cuenta en CARTO. */
  cartoVoyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    opciones: {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: `${ATRIBUCION_OSM} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>`,
    },
  },
};

/** Fondo activo en todo el sitio. Cambiar aquí para usar otro proveedor. */
export const FONDO: FondoMapa = FONDOS.osmHot;

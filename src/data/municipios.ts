/**
 * Municipios cubiertos y su ubicación, para el mapa de la sección "Cobertura
 * nacional".
 *
 * ============================================================================
 * EDITAR AQUÍ — las coordenadas deben validarse contra el listado real
 * ============================================================================
 * Se buscó el listado oficial en ListadoAutomatizacionDST.xlsx (Escritorio),
 * pero ese archivo contiene las funciones a automatizar por área, no los
 * municipios. Mientras llega el listado real de los 87 municipios:
 *
 *  - Aquí están cargados los 22 municipios que ya venían en el prototipo.
 *  - Las coordenadas son de la cabecera municipal, con precisión aproximada
 *    (sirven para ubicar el punto en el mapa, no para navegación).
 *  - `cobertura` en src/data/site.ts conserva las cifras oficiales
 *    (Boyacá 67, Santander 18, Cundinamarca 2), que son las que se muestran
 *    como contadores. El mapa avisa cuántos de esos municipios están cargados.
 *
 * Para completar el mapa: agregar una línea por municipio con su nombre,
 * departamento y coordenadas. El orden no importa.
 */

export type Departamento = 'Boyacá' | 'Santander' | 'Cundinamarca';

export interface Municipio {
  nombre: string;
  departamento: Departamento;
  /** Latitud de la cabecera municipal. */
  lat: number;
  /** Longitud de la cabecera municipal. */
  lng: number;
  /** Marca la sede principal: se dibuja con el punto pulsante. */
  sede?: boolean;
}

/** Color de cada departamento: se usa igual en los contadores y en el mapa. */
export const departamentos: {
  nombre: Departamento;
  color: string;
  /** Cifra oficial de municipios cubiertos. */
  total: number;
}[] = [
  { nombre: 'Boyacá', color: '#e5484d', total: 67 },
  { nombre: 'Santander', color: '#0e9594', total: 18 },
  { nombre: 'Cundinamarca', color: '#e08a1e', total: 2 },
];

export const colorDepartamento = (departamento: Departamento): string =>
  departamentos.find((d) => d.nombre === departamento)?.color ?? '#0d2c84';

export const municipios: Municipio[] = [
  // ---------------------------------------------------------------- Boyacá
  { nombre: 'Tunja', departamento: 'Boyacá', lat: 5.5353, lng: -73.3678, sede: true },
  { nombre: 'Duitama', departamento: 'Boyacá', lat: 5.8245, lng: -73.0343 },
  { nombre: 'Sogamoso', departamento: 'Boyacá', lat: 5.7147, lng: -72.9339 },
  { nombre: 'Chiquinquirá', departamento: 'Boyacá', lat: 5.6136, lng: -73.8175 },
  { nombre: 'Paipa', departamento: 'Boyacá', lat: 5.7803, lng: -73.1163 },
  { nombre: 'Villa de Leyva', departamento: 'Boyacá', lat: 5.6339, lng: -73.5244 },
  { nombre: 'Nobsa', departamento: 'Boyacá', lat: 5.7683, lng: -72.9411 },
  { nombre: 'Moniquirá', departamento: 'Boyacá', lat: 5.8763, lng: -73.5735 },
  { nombre: 'Ramiriquí', departamento: 'Boyacá', lat: 5.4003, lng: -73.3348 },
  { nombre: 'Garagoa', departamento: 'Boyacá', lat: 5.0824, lng: -73.3634 },
  { nombre: 'Puerto Boyacá', departamento: 'Boyacá', lat: 5.9761, lng: -74.5906 },
  { nombre: 'Samacá', departamento: 'Boyacá', lat: 5.4924, lng: -73.4854 },

  // ------------------------------------------------------------- Santander
  { nombre: 'Bucaramanga', departamento: 'Santander', lat: 7.1193, lng: -73.1227 },
  { nombre: 'Floridablanca', departamento: 'Santander', lat: 7.0625, lng: -73.0865 },
  { nombre: 'Girón', departamento: 'Santander', lat: 7.0708, lng: -73.1698 },
  { nombre: 'Piedecuesta', departamento: 'Santander', lat: 6.9946, lng: -73.0498 },
  { nombre: 'Barrancabermeja', departamento: 'Santander', lat: 7.0653, lng: -73.8547 },
  { nombre: 'San Gil', departamento: 'Santander', lat: 6.5549, lng: -73.1337 },
  { nombre: 'Socorro', departamento: 'Santander', lat: 6.4634, lng: -73.2627 },
  { nombre: 'Zapatoca', departamento: 'Santander', lat: 6.8149, lng: -73.2678 },

  // ---------------------------------------------------------- Cundinamarca
  { nombre: 'Zipaquirá', departamento: 'Cundinamarca', lat: 5.0221, lng: -74.0048 },
  { nombre: 'Chocontá', departamento: 'Cundinamarca', lat: 5.1447, lng: -73.6853 },
];

/** Municipio marcado como sede principal (Tunja). */
export const sede = municipios.find((m) => m.sede) ?? municipios[0];

/** Cuántos municipios hay cargados en el mapa, por departamento. */
export function cargadosPorDepartamento(departamento: Departamento): number {
  return municipios.filter((m) => m.departamento === departamento).length;
}

/** Total oficial de municipios cubiertos (87). */
export const totalOficial = departamentos.reduce((suma, d) => suma + d.total, 0);

import { clientesPorMunicipio } from './clientes-municipio';
import coordenadas from './coordenadas.json';

/**
 * Municipios cubiertos, con su número real de clientes y la ubicación de su
 * cabecera municipal.
 *
 * De dónde sale cada cosa:
 *   - clientes-municipio.ts  conteo real de clientes por municipio, sacado de
 *                            la base de datos (12.290 clientes).
 *   - coordenadas.json       lat/lng de cada cabecera, geocodificadas una sola
 *                            vez con Nominatim (`npm run geocodificar`). El
 *                            archivo es la caché: si una coordenada quedara
 *                            mal, se corrige ahí a mano.
 *
 * Este archivo solo cruza las dos fuentes; no hay datos escritos a mano.
 */

export type Departamento = 'Boyacá' | 'Santander' | 'Cundinamarca';

/** Los datos vienen sin tildes; aquí se les devuelve el nombre oficial. */
const NOMBRE_DEPARTAMENTO: Record<string, Departamento> = {
  Boyaca: 'Boyacá',
  Santander: 'Santander',
  Cundinamarca: 'Cundinamarca',
};

export interface Municipio {
  nombre: string;
  departamento: Departamento;
  /** Latitud de la cabecera municipal. */
  lat: number;
  /** Longitud de la cabecera municipal. */
  lng: number;
  /** Clientes atendidos en el municipio. */
  clientes: number;
}

interface EntradaCoordenada {
  lat: number;
  lng: number;
  fuente?: string;
}

const cache = coordenadas as Record<string, EntradaCoordenada>;

const sinTildes = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Nombre con tildes. Nominatim devuelve el nombre oficial en `fuente`
 * ("Chiquinquirá, Occidente, Boyacá…"), así que se toma de ahí siempre que
 * coincida con el nombre de la base de datos.
 */
function nombreOficial(nombreCrudo: string, entrada: EntradaCoordenada): string {
  const candidato = entrada.fuente?.split(',')[0]?.trim();
  return candidato && sinTildes(candidato) === sinTildes(nombreCrudo) ? candidato : nombreCrudo;
}

export const municipios: Municipio[] = clientesPorMunicipio
  .filter((fila) => fila.departamento in NOMBRE_DEPARTAMENTO)
  .map((fila) => {
    const entrada = cache[fila.municipio];
    if (!entrada) return null;
    return {
      nombre: nombreOficial(fila.municipio, entrada),
      departamento: NOMBRE_DEPARTAMENTO[fila.departamento],
      lat: entrada.lat,
      lng: entrada.lng,
      clientes: fila.clientes,
    };
  })
  .filter((m): m is Municipio => m !== null);

/** Municipios sin coordenada: deberían ser cero tras correr `npm run geocodificar`. */
export const municipiosSinUbicacion = clientesPorMunicipio
  .filter((fila) => fila.departamento in NOMBRE_DEPARTAMENTO && !cache[fila.municipio])
  .map((fila) => fila.municipio);

/**
 * Clientes fuera de la zona de cobertura (Bogotá, Medellín). No se dibujan en
 * el mapa, que es de la red de los tres departamentos, pero sí cuentan en el
 * total de la empresa.
 */
export const clientesFueraDeZona = clientesPorMunicipio
  .filter((fila) => !(fila.departamento in NOMBRE_DEPARTAMENTO))
  .reduce((suma, fila) => suma + fila.clientes, 0);

/** Color de cada departamento: el mismo en los contadores y en el mapa. */
const COLORES: Record<Departamento, string> = {
  Boyacá: '#e5484d',
  Santander: '#0e9594',
  Cundinamarca: '#e08a1e',
};

export const colorDepartamento = (departamento: Departamento): string =>
  COLORES[departamento] ?? '#0d2c84';

export const departamentos = (Object.keys(COLORES) as Departamento[]).map((nombre) => {
  const propios = municipios.filter((m) => m.departamento === nombre);
  return {
    nombre,
    color: COLORES[nombre],
    total: propios.length,
    clientes: propios.reduce((suma, m) => suma + m.clientes, 0),
  };
});

export const totalMunicipios = municipios.length;
export const totalClientes = municipios.reduce((suma, m) => suma + m.clientes, 0);

/** Cuántos municipios se dibujan en el mapa de la home. */
export const TOTAL_DESTACADOS = 18;

/**
 * Municipios principales por volumen de clientes.
 *
 * El mapa de la home solo dibuja estos: con los 87 puntos el mapa se lee como
 * una mancha y no se distingue nada. La cobertura completa ya se comunica con
 * los contadores por departamento que van encima del mapa.
 */
export const municipiosDestacados: Municipio[] = [...municipios]
  .sort((a, b) => b.clientes - a.clientes)
  .slice(0, TOTAL_DESTACADOS);

/** Ubicación exacta de la sede (Cra 2 Este #58-79), geocodificada aparte. */
export const sede = {
  nombre: 'Tunja',
  ...(cache.__sede__ ?? { lat: 5.5353, lng: -73.3678 }),
};

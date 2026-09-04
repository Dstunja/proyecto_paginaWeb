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
  /**
   * Días en que pasa la ruta de reparto, tal como se quiere leer:
   * 'martes y viernes', 'miércoles'. El buscador "¿Llegamos a tu municipio?"
   * lo muestra como "Ruta: martes y viernes" cuando está presente y, cuando no,
   * simplemente no dice nada del día.
   *
   * HOY ESTÁ VACÍO PARA TODOS LOS MUNICIPIOS: el dato no existe en ninguna de
   * las dos fuentes (ni en el Excel de clientes ni en las coordenadas), y no se
   * inventa ninguno. Prometerle a un tendero que la ruta pasa un martes y que
   * no pase es peor que no decírselo.
   */
  diaRuta?: string;
}

/**
 * EDITAR AQUÍ: días de ruta por municipio.
 *
 * Formato: `'Nombre del municipio': 'días tal como se quieren leer'`. El nombre
 * va como aparece en src/data/clientes-municipio.ts (sin tildes está bien: la
 * comparación las ignora).
 *
 *     export const DIAS_DE_RUTA: Record<string, string> = {
 *       'Tunja': 'lunes a viernes',
 *       'Chiquinquira': 'martes y viernes',
 *       'Villa De Leyva': 'jueves',
 *     };
 *
 * De dónde sacar el dato: de la programación de rutas del área comercial. No
 * hace falta llenarlos todos de una vez —los que falten simplemente no muestran
 * día— pero conviene que un municipio no aparezca con un día equivocado.
 */
export const DIAS_DE_RUTA: Record<string, string> = {};

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

/**
 * Día de ruta del municipio, comparando sin tildes ni mayúsculas para que
 * escribirlo como "Chiquinquirá" o "Chiquinquira" en DIAS_DE_RUTA dé igual.
 */
const RUTAS_NORMALIZADAS = new Map(
  Object.entries(DIAS_DE_RUTA).map(([nombre, dias]) => [sinTildes(nombre), dias]),
);

function buscarDiaDeRuta(nombreCrudo: string): string | undefined {
  const dias = RUTAS_NORMALIZADAS.get(sinTildes(nombreCrudo));
  return dias && dias.trim() !== '' ? dias.trim() : undefined;
}

export const municipios: Municipio[] = clientesPorMunicipio
  .filter((fila) => fila.departamento in NOMBRE_DEPARTAMENTO)
  .map((fila) => {
    const entrada = cache[fila.municipio];
    if (!entrada) return null;
    const diaRuta = buscarDiaDeRuta(fila.municipio);
    return {
      nombre: nombreOficial(fila.municipio, entrada),
      departamento: NOMBRE_DEPARTAMENTO[fila.departamento],
      lat: entrada.lat,
      lng: entrada.lng,
      clientes: fila.clientes,
      ...(diaRuta ? { diaRuta } : {}),
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

/** Ubicación exacta de la sede (Cra 2 Este #58-79), geocodificada aparte. */
export const sede = {
  nombre: 'Tunja',
  ...(cache.__sede__ ?? { lat: 5.5353, lng: -73.3678 }),
};

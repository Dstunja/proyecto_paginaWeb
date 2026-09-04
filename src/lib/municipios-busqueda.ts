/**
 * Búsqueda de municipios: una sola implementación para los dos buscadores.
 *
 * El mapa de la red (MapaRed.astro) ya buscaba municipios para resaltar su
 * punto; el buscador destacado "¿Llegamos a tu municipio?" hace la misma
 * pregunta desde arriba de la sección. Tener dos funciones de búsqueda
 * significaría que una tolere las tildes y la otra no, o que una encuentre
 * "Villa de Leyva" y la otra no: por eso la normalización y el índice viven
 * aquí y los dos componentes los importan.
 *
 * Funciones puras, sin `document` ni `window`: se usan igual en el frontmatter
 * (build) y en los `<script>` del navegador.
 */

/**
 * Lo mínimo que necesita la búsqueda: el nombre.
 *
 * Se declara así, y no importando `Municipio` de src/data/municipios.ts, para
 * que los `<script>` del navegador puedan usar estas funciones sin arrastrar al
 * paquete las filas de clientes ni el JSON de coordenadas. Tanto el municipio
 * completo del build como la versión ligera que viaja al navegador encajan.
 */
export interface ConNombre {
  nombre: string;
}

/**
 * Texto comparable: sin tildes, sin mayúsculas y sin espacios de más.
 *
 * Así "Chiquinquira", "chiquinquirá" y "  CHIQUINQUIRÁ " son la misma clave, y
 * nadie se queda sin cobertura por no poner una tilde en el teclado del
 * teléfono.
 */
export function normalizarMunicipio(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Índice `nombre normalizado -> municipio`, para buscar en tiempo constante. */
export function indexarMunicipios<T extends ConNombre>(lista: T[]): Map<string, T> {
  return new Map(lista.map((m) => [normalizarMunicipio(m.nombre), m]));
}

/** El municipio que se llama exactamente así, o `null`. */
export function buscarMunicipio<T extends ConNombre>(
  indice: Map<string, T>,
  texto: string,
): T | null {
  return indice.get(normalizarMunicipio(texto)) ?? null;
}

/**
 * Sugerencias mientras se escribe.
 *
 * Primero los que EMPIEZAN por lo escrito y después los que solo lo contienen:
 * quien teclea "sa" espera ver Samacá y Saboyá antes que Ventaquemada. Dentro
 * de cada grupo se conserva el orden de la lista, que viene ordenada por número
 * de clientes, así que los municipios más grandes salen primero.
 */
export function sugerirMunicipios<T extends ConNombre>(
  lista: T[],
  texto: string,
  maximo = 6,
): T[] {
  const q = normalizarMunicipio(texto);
  if (q.length < 2) return [];

  const empiezan: T[] = [];
  const contienen: T[] = [];

  for (const m of lista) {
    const nombre = normalizarMunicipio(m.nombre);
    if (nombre.startsWith(q)) empiezan.push(m);
    else if (nombre.includes(q)) contienen.push(m);
    if (empiezan.length >= maximo) break;
  }

  return [...empiezan, ...contienen].slice(0, maximo);
}

/**
 * Evento con el que el buscador destacado le pide al mapa que resalte un
 * municipio. Se comunica por `document` y no por una llamada directa porque
 * Astro empaqueta el script de cada componente por separado: no comparten
 * ámbito, pero sí el documento.
 */
export const EVENTO_MUNICIPIO = 'dst:municipio-elegido';

/** Lo que viaja en el evento: el nombre tal como está en los datos. */
export interface DetalleMunicipioElegido {
  nombre: string;
}

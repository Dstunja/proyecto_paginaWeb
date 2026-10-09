/**
 * De dónde salen las vacantes: Control360 primero, la lista del repositorio después.
 *
 * Talento Humano publica y cierra las vacantes desde Control360
 * (Postulaciones › Vacantes), y Control360 las expone en
 * GET /api/talento/vacantes/dst con la MISMA forma que este sitio ya publicaba
 * en /api/empleos/vacantes.json: { version: 1, vacantes: [{ slug, cargo,
 * ciudad, tipo, resumen, descripcion[], requisitos[], funciones[] }] }.
 *
 * CUÁNDO SE LEE. En tiempo de build (el sitio es estático): /empleos/, cada
 * /empleos/<slug>/, el <select> del formulario y el JSON público se generan con
 * lo que Control360 tenga en ese momento. Un cambio en Control360 se ve en la
 * página con el siguiente despliegue. La función de postular también la llama
 * en cada arranque, para validar el cargo contra la misma lista.
 *
 * SI FALLA, LA PÁGINA NO SE QUEDA SIN VACANTES. Sin `C360_VACANTES_URL`, con la
 * URL caída, con un JSON que no tiene la forma esperada o con cero vacantes,
 * se usa `src/data/vacantes.ts` tal cual estaba. Nunca se lanza: el build no
 * se cae por Control360.
 *
 * QUÉ SE ENRIQUECE. Control360 solo manda texto. El flyer (`imagen`), lo que
 * ofrece la empresa, las habilidades deseables y el WhatsApp extra siguen
 * viviendo en `src/data/vacantes.ts`: si una vacante de Control360 tiene el
 * mismo `slug` que una de la lista estática, hereda esos campos de ahí.
 */
import { vacantes as vacantesEstaticas, type Vacante } from '../../data/vacantes';
import type { Entorno } from '../pqrs/config';
import { leerPreguntas } from './preguntas';

/** Variable de entorno con la URL pública de Control360. */
export const VARIABLE_URL = 'C360_VACANTES_URL';

/** Cuánto se espera a Control360 antes de usar la lista estática. */
export const TIEMPO_MAXIMO_MS = 10_000;

export type FuenteVacantes = 'control360' | 'estatica';

export interface ResultadoVacantes {
  fuente: FuenteVacantes;
  vacantes: Vacante[];
  /** Por qué se cayó a la lista estática (solo cuando `fuente` es `estatica`). */
  motivo?: string;
}

/** Mismo alfabeto que exige Control360 y que usa la URL /empleos/<slug>/. */
const FORMA_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const textos = (x: unknown): string[] =>
  Array.isArray(x) ? x.map((s) => String(s ?? '').trim()).filter(Boolean) : [];
const texto = (x: unknown): string => String(x ?? '').trim();

/**
 * Convierte el JSON de Control360 en vacantes del sitio, o explica por qué no.
 * Es pura: no toca red ni entorno. Las entradas sin slug válido o sin cargo se
 * descartan una a una; si no queda ninguna, se considera que no hay lista.
 */
export function leerVacantesRemotas(
  json: unknown,
  estaticas: readonly Vacante[] = vacantesEstaticas,
): { ok: true; vacantes: Vacante[] } | { ok: false; motivo: string } {
  if (!json || typeof json !== 'object') return { ok: false, motivo: 'la respuesta no es un objeto' };
  const { version, vacantes } = json as { version?: unknown; vacantes?: unknown };
  if (version !== 1) return { ok: false, motivo: `versión desconocida (${String(version)})` };
  if (!Array.isArray(vacantes)) return { ok: false, motivo: 'falta la lista "vacantes"' };

  const porSlug = new Map(estaticas.map((v) => [v.slug, v]));
  const salida: Vacante[] = [];
  const vistos = new Set<string>();
  for (const cruda of vacantes) {
    if (!cruda || typeof cruda !== 'object') continue;
    const o = cruda as Record<string, unknown>;
    const slug = texto(o.slug);
    const cargo = texto(o.cargo);
    if (!FORMA_SLUG.test(slug) || !cargo || vistos.has(slug)) continue;
    vistos.add(slug);
    const base = porSlug.get(slug);
    // Las preguntas de filtro vienen SOLO de Control360 (sin la regla que
    // descarta); si no trae, el formulario no las pinta.
    const preguntas = leerPreguntas(o.preguntas);
    salida.push({
      slug,
      cargo,
      ciudad: texto(o.ciudad),
      tipo: texto(o.tipo),
      resumen: texto(o.resumen),
      imagen: base?.imagen ?? '',
      descripcion: textos(o.descripcion),
      requisitos: textos(o.requisitos),
      funciones: textos(o.funciones),
      ...(preguntas.length ? { preguntas } : {}),
      ...(base?.habilidades ? { habilidades: [...base.habilidades] } : {}),
      ...(base?.ofrecemos ? { ofrecemos: [...base.ofrecemos] } : {}),
      ...(base?.whatsappExtra ? { whatsappExtra: { ...base.whatsappExtra } } : {}),
    });
  }
  if (salida.length === 0) return { ok: false, motivo: 'Control360 no tiene vacantes publicadas' };
  return { ok: true, vacantes: salida };
}

/** En Astro el build y las funciones corren en Node, así que `process.env` existe. */
function entornoActual(): Entorno {
  return typeof process === 'undefined' ? {} : (process.env as Entorno);
}

export function urlVacantes(env: Entorno = entornoActual()): string | null {
  const valor = (env as Record<string, string | undefined>)[VARIABLE_URL]?.trim();
  return valor && /^https?:\/\//.test(valor) ? valor : null;
}

/**
 * Trae las vacantes, de Control360 si se puede y de la lista estática si no.
 * Recibe `fetch` y el entorno como parámetros para poder probarse sin red.
 */
export async function resolverVacantes(opciones: {
  env?: Entorno;
  fetchFn?: typeof fetch;
  estaticas?: readonly Vacante[];
} = {}): Promise<ResultadoVacantes> {
  const estaticas = [...(opciones.estaticas ?? vacantesEstaticas)];
  const url = urlVacantes(opciones.env ?? entornoActual());
  if (!url) return { fuente: 'estatica', vacantes: estaticas, motivo: `sin ${VARIABLE_URL}` };

  const fetchFn = opciones.fetchFn ?? fetch;
  try {
    const respuesta = await fetchFn(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (!respuesta.ok) {
      return { fuente: 'estatica', vacantes: estaticas, motivo: `Control360 respondió ${respuesta.status}` };
    }
    const leidas = leerVacantesRemotas(await respuesta.json(), estaticas);
    if (!leidas.ok) return { fuente: 'estatica', vacantes: estaticas, motivo: leidas.motivo };
    return { fuente: 'control360', vacantes: leidas.vacantes };
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    return { fuente: 'estatica', vacantes: estaticas, motivo: `no se pudo leer Control360: ${motivo}` };
  }
}

let memoria: Promise<ResultadoVacantes> | null = null;

/**
 * Las vacantes para las páginas, el formulario y la validación: una sola
 * lectura por proceso (el build las pide desde varias páginas y no tiene
 * sentido ir a Control360 cada vez). Deja en el log de dónde salieron.
 */
export function cargarVacantes(): Promise<ResultadoVacantes> {
  if (!memoria) {
    memoria = resolverVacantes().then((r) => {
      if (r.fuente === 'control360') {
        console.log(`[empleos] ${r.vacantes.length} vacantes leídas de Control360`);
      } else {
        console.warn(`[empleos] vacantes de src/data/vacantes.ts (${r.motivo})`);
      }
      return r;
    });
  }
  return memoria;
}

/** Solo para pruebas: olvida la lectura anterior. */
export function olvidarVacantesCargadas(): void {
  memoria = null;
}

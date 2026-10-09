// PREGUNTAS DE FILTRO DE UNA VACANTE — las que Control360 publica y el formulario hace antes de la hoja de vida.
//
// Por qué existe: Talento Humano escribe en Control360 (Postulaciones › Vacantes) hasta 8 preguntas
//   básicas por vacante (moto propia, licencia, años de experiencia, ciudad, disponibilidad…). Llegan
//   con las vacantes en GET /api/talento/vacantes/dst como `preguntas` (sin la regla que descarta:
//   eso se queda allá) y aquí se pintan en el formulario, se validan en el servidor y se mandan a
//   Control360 como `respuestas` para que la postulación entre marcada CUMPLE / NO CUMPLE.
// Dónde corre: build (lectura de las vacantes), navegador (el formulario las pinta a partir de un
//   JSON incrustado) y función de servidor (validación). Todo puro: sin red ni entorno.
// Cuidados: si la vacante no trae preguntas, el formulario queda como hoy y no se manda nada. Las
//   obligatorias se exigen en el servidor, no solo en el navegador. Los `name` de los campos son
//   `pregunta__<id>`; el id lo pone Control360 (minúsculas, guiones, ≤ 32).

export const TIPOS_PREGUNTA = ['SI_NO', 'OPCION', 'NUMERO', 'TEXTO'] as const;
export type TipoPregunta = (typeof TIPOS_PREGUNTA)[number];

export interface PreguntaVacante {
  id: string;
  texto: string;
  tipo: TipoPregunta;
  /** Solo con tipo OPCION. */
  opciones?: string[];
  obligatoria: boolean;
}

/** Lo que se manda a Control360 por cada pregunta respondida. */
export interface RespuestaPregunta {
  id: string;
  /** La pregunta tal como la vio la persona (por si cambia después en Control360). */
  texto_pregunta: string;
  respuesta: string;
}

/** Mismos topes que Control360 (filtro.ts allá). */
export const LIMITES = { preguntas: 8, texto: 200, opciones: 10, opcion: 60, respuesta: 300 } as const;

const FORMA_ID = /^[a-z0-9_-]{1,32}$/;
const texto = (x: unknown, max: number): string =>
  String(x ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Prefijo de los `name` del formulario: `pregunta__moto`, `pregunta__exp`… */
export const PREFIJO_CAMPO = 'pregunta__';
export const nombreCampo = (id: string): string => `${PREFIJO_CAMPO}${id}`;

/**
 * Lee las preguntas que vienen en una vacante del JSON de Control360. Es tolerante: lo que no
 * tenga forma de pregunta se descarta y nunca se lanza (el build no se cae por una pregunta rara).
 */
export function leerPreguntas(json: unknown): PreguntaVacante[] {
  if (!Array.isArray(json)) return [];
  const salida: PreguntaVacante[] = [];
  const vistos = new Set<string>();
  for (const cruda of json.slice(0, LIMITES.preguntas)) {
    if (!cruda || typeof cruda !== 'object') continue;
    const o = cruda as Record<string, unknown>;
    const id = texto(o.id, 32).toLowerCase();
    const enunciado = texto(o.texto, LIMITES.texto);
    const tipo = o.tipo;
    if (!FORMA_ID.test(id) || vistos.has(id) || !enunciado) continue;
    if (!(TIPOS_PREGUNTA as readonly unknown[]).includes(tipo)) continue;
    vistos.add(id);
    const pregunta: PreguntaVacante = {
      id,
      texto: enunciado,
      tipo: tipo as TipoPregunta,
      obligatoria: o.obligatoria === true,
    };
    if (pregunta.tipo === 'OPCION') {
      const opciones = (Array.isArray(o.opciones) ? o.opciones : [])
        .map((x) => texto(x, LIMITES.opcion))
        .filter(Boolean)
        .slice(0, LIMITES.opciones);
      // Una pregunta de opción sin opciones no se puede responder: fuera.
      if (opciones.length < 2) continue;
      pregunta.opciones = opciones;
    }
    salida.push(pregunta);
  }
  return salida;
}

/** Las preguntas de la vacante cuyo cargo es `cargo`, o [] (espontánea, cargo sin vacante). */
export function preguntasDelCargo(
  vacantes: readonly { cargo: string; preguntas?: PreguntaVacante[] }[],
  cargo: string,
): PreguntaVacante[] {
  return vacantes.find((v) => v.cargo === cargo)?.preguntas ?? [];
}

/** "Sí"/"si"/"SI" → SI; "No"/"no" → NO; lo demás, tal cual. */
function normalizarSiNo(valor: string): string {
  const v = valor.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (v === 'si') return 'SI';
  if (v === 'no') return 'NO';
  return valor;
}

export interface ResultadoRespuestas {
  /** Mensajes en español, uno por problema; vacío si todo está bien. */
  errores: string[];
  /** Solo las respondidas, en el orden de las preguntas. */
  respuestas: RespuestaPregunta[];
}

/**
 * Valida en el SERVIDOR lo que la persona respondió, con las mismas reglas que el navegador:
 * obligatorias presentes, SI_NO solo SI/NO, OPCION dentro de las opciones, NUMERO numérico,
 * TEXTO con tope. Devuelve TODOS los errores, como el resto del formulario.
 */
export function validarRespuestas(
  preguntas: readonly PreguntaVacante[],
  leer: (nombre: string) => string,
): ResultadoRespuestas {
  const errores: string[] = [];
  const respuestas: RespuestaPregunta[] = [];
  for (const p of preguntas) {
    const cruda = texto(leer(nombreCampo(p.id)), LIMITES.respuesta + 1);
    if (!cruda) {
      if (p.obligatoria) errores.push(`Falta responder: «${p.texto}».`);
      continue;
    }
    let respuesta = cruda;
    if (p.tipo === 'SI_NO') {
      respuesta = normalizarSiNo(cruda);
      if (respuesta !== 'SI' && respuesta !== 'NO') {
        errores.push(`La respuesta a «${p.texto}» debe ser Sí o No.`);
        continue;
      }
    } else if (p.tipo === 'OPCION') {
      const real = (p.opciones ?? []).find((o) => o.toLowerCase() === cruda.toLowerCase());
      if (!real) {
        errores.push(`La respuesta a «${p.texto}» no es una de las opciones.`);
        continue;
      }
      respuesta = real;
    } else if (p.tipo === 'NUMERO') {
      const n = Number(cruda.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        errores.push(`La respuesta a «${p.texto}» debe ser un número.`);
        continue;
      }
      respuesta = String(n);
    } else if (cruda.length > LIMITES.respuesta) {
      errores.push(`La respuesta a «${p.texto}» no puede pasar de ${LIMITES.respuesta} caracteres.`);
      continue;
    }
    respuestas.push({ id: p.id, texto_pregunta: p.texto, respuesta });
  }
  return { errores, respuestas };
}

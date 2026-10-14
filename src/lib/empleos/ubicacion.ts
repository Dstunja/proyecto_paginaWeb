// DÓNDE VIVE EL CANDIDATO FRENTE A LA SEDE — «Municipio donde vives» y la pregunta de traslado.
//
// Por qué existe: Control360 (13·10) pide «Municipio donde vives» en su formulario público y,
//   si no es la sede de la vacante, agrega la pregunta «¿Puedes vivir o trabajar en <sede>?».
//   Con eso RRHH ve la alerta «⚠️ Vive en Bogotá, la vacante es en Tunja…». Este sitio manda
//   lo mismo: `municipio` en el cuerpo firmado y la respuesta de traslado entre las `respuestas`.
// Dónde corre: navegador (el formulario decide si muestra la pregunta) y función de servidor
//   (la valida). Puro: sin red ni entorno.
// Cuidados:
//   · Es COPIA de src/features/talento/postulaciones/ubicacion.ts de Control360 (limpiar,
//     ciudadDeSede, esMismaSede, preguntaTraslado) y tiene que dar lo mismo: si aquí no se
//     pregunta y allá sí, Control360 rechaza la postulación por falta de una obligatoria.
//     Si allá cambia, se cambia aquí.
//   · Es una ALERTA, NUNCA un descarte: la pregunta no tiene regla.
//   · Ante la duda NO se pregunta: «Tunja, Boyacá», «tunja» y «Tunja y alrededores» son Tunja.

import type { PreguntaVacante } from './preguntas';

export const MUNICIPIO_MIN = 3;
export const MUNICIPIO_MAX = 80;

/** El id de la pregunta automática de traslado (el mismo que espera Control360). */
export const ID_TRASLADO = 'c360-traslado';

/** Minúsculas, sin tildes y sin espacios de sobra (normalizar.ts de Control360). */
export function normalizar(x: string): string {
  return (x || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** «  san  josé de pare ,boyacá » → «San josé de pare, boyacá». null si no sirve. */
export function limpiarMunicipio(x: unknown): string | null {
  const s = String(x ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .replace(/^[,\s]+|[,\s]+$/g, '');
  if (s.length < MUNICIPIO_MIN || s.length > MUNICIPIO_MAX) return null;
  if (!/[a-zA-ZÀ-ÿ]/.test(s)) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «Tunja, Boyacá» → «Tunja»; «Tunja y alrededores» → «Tunja». */
export function ciudadDeSede(sede: string | null | undefined): string {
  return String(sede ?? '')
    .split(/[,(]/)[0]
    .replace(/\s+y\s+alrededores.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const clave = (x: string) =>
  normalizar(x)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** ¿El municipio es la sede? Sin uno de los dos no se puede decir que no: true. */
export function esMismaSede(municipio: string | null | undefined, sede: string | null | undefined): boolean {
  const m = clave(ciudadDeSede(municipio));
  const s = clave(ciudadDeSede(sede));
  if (!m || !s) return true;
  if (m === s) return true;
  return m.startsWith(`${s} `) || s.startsWith(`${m} `);
}

/** ¿Hay que hacer la pregunta de traslado? Solo con municipio y sede, y si no coinciden. */
export const pideTraslado = (municipio: string | null | undefined, sede: string | null | undefined): boolean =>
  Boolean(String(municipio ?? '').trim() && String(sede ?? '').trim()) && !esMismaSede(municipio, sede);

/** La pregunta automática: Sí/No, obligatoria, sin regla. */
export function preguntaTraslado(sede: string): PreguntaVacante {
  return {
    id: ID_TRASLADO,
    texto: `¿Puedes vivir o trabajar en ${ciudadDeSede(sede) || sede}?`,
    tipo: 'SI_NO',
    obligatoria: true,
  };
}

/** Las preguntas que ve el candidato: las de la vacante y, si vive en otro lado, la de traslado. */
export function preguntasConTraslado(
  preguntas: readonly PreguntaVacante[],
  municipio: string | null | undefined,
  sede: string | null | undefined,
): PreguntaVacante[] {
  const sinAuto = preguntas.filter((p) => p.id !== ID_TRASLADO);
  return sede && pideTraslado(municipio, sede) ? [...sinAuto, preguntaTraslado(sede)] : sinAuto;
}

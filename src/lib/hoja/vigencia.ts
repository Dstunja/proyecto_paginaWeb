/**
 * Fechas y reglas de vigencia.
 *
 * El sitio es estático, así que "hoy" es el día en que corre el build. Vercel
 * compila en UTC, y a las 19:00 en Tunja ya es mañana en UTC: si se tomara la
 * fecha del sistema, un producto "vigente hasta hoy" desaparecería cinco horas
 * antes de tiempo. Por eso `hoyEnColombia` calcula el día en America/Bogota.
 *
 * Las fechas de la hoja son INCLUSIVAS: "Vigente hasta 2026-09-30" se publica
 * durante todo el 30 y desaparece el 1 de octubre. "Cierra el" igual.
 *
 * Como el sitio no se recompila solo cuando pasa una fecha, el Apps Script
 * dispara además un build cada noche (ver docs/CATALOGO-HOJA.md).
 */
import type { FechaISO } from './tipos.ts';

export const ZONA_HORARIA = 'America/Bogota';

/** Fecha de hoy en Colombia como 'AAAA-MM-DD'. Se puede fijar en pruebas. */
export function hoyEnColombia(ahora: Date = new Date()): FechaISO {
  // 'en-CA' formatea como AAAA-MM-DD, que es justo el formato ISO.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/**
 * Interpreta una celda de fecha. Admite:
 *  - ISO 'AAAA-MM-DD' (lo que se recomienda en la hoja).
 *  - Colombiano 'D/M/AAAA' o 'D-M-AAAA' (día primero, como el locale es-CO).
 *  - El número de serie de Google Sheets (días desde 1899-12-30), que es como
 *    llega una celda con formato de fecha cuando se lee sin formatear.
 * Devuelve null si no es una fecha válida (incluido 31/02).
 */
export function parsearFecha(texto: string): FechaISO | null {
  const t = texto.trim();
  if (!t) return null;

  let anio: number, mes: number, dia: number;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) {
    [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) {
    [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if (/^\d{4,6}(\.\d+)?$/.test(t)) {
    const serie = Math.floor(Number(t));
    const fecha = new Date(Date.UTC(1899, 11, 30) + serie * 86_400_000);
    [anio, mes, dia] = [fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate()];
  } else {
    return null;
  }

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return null;
  }
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** ¿`fecha` ya quedó atrás? El propio día de la fecha todavía cuenta. */
export function yaPaso(fecha: FechaISO | null, hoy: FechaISO): boolean {
  return fecha !== null && fecha < hoy;
}

/** ¿`fecha` todavía no llega? */
export function aunNoLlega(fecha: FechaISO | null, hoy: FechaISO): boolean {
  return fecha !== null && fecha > hoy;
}

/** Un producto se publica si está activo y su "Vigente hasta" no ha pasado. */
export function productoPublicable(p: { activo: boolean; vigenteHasta: FechaISO | null }, hoy: FechaISO): boolean {
  return p.activo && !yaPaso(p.vigenteHasta, hoy);
}

/**
 * Una oferta se publica si está activa, "Cierra el" no ha pasado y "Publicada
 * el" (si está) ya llegó.
 */
export function ofertaPublicable(
  o: { activa: boolean; publicadaEl: FechaISO | null; cierraEl: FechaISO | null },
  hoy: FechaISO,
): boolean {
  return o.activa && !yaPaso(o.cierraEl, hoy) && !aunNoLlega(o.publicadaEl, hoy);
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** 'Septiembre 2026' para la cabecera de "Especiales del mes". */
export function periodoDe(hoy: FechaISO): string {
  const [anio, mes] = hoy.split('-').map(Number);
  const nombre = MESES[(mes ?? 1) - 1] ?? '';
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

/** Tope de caída del catálogo respecto al último build: 30 %. */
export const TOPE_CAIDA = 0.3;

/**
 * ¿Los productos publicables cayeron más del tope respecto al build anterior?
 * Con `anterior` desconocido (primer build) no hay con qué comparar.
 */
export function caidaExcesiva(anterior: number | null, actual: number, tope = TOPE_CAIDA): boolean {
  if (anterior === null || anterior <= 0) return false;
  return actual < anterior * (1 - tope);
}

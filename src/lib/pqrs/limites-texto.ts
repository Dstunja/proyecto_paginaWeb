/**
 * Límites de los textos largos de la página de PQRS y la forma de contarlos.
 *
 * POR QUÉ ESTE MÓDULO. El servidor rechazaba los textos cortos con «Cuéntanos
 * brevemente qué necesitas» sin que la página dijera antes cuál era el mínimo:
 * la persona se enteraba al enviar. Ahora el mínimo se enseña bajo el campo y
 * un contador lo sigue al escribir (src/components/ContadorCaracteres.astro).
 * Para que el contador y el servidor no se contradigan, los dos leen de aquí
 * los límites Y la forma de contar.
 *
 * CÓMO CUENTA EL SERVIDOR. Recorta los espacios de los extremos y quita los
 * caracteres de control, que incluyen los saltos de línea (`limpiar`). Por eso
 * «hola\nmundo» cuenta 9 y no 10. El navegador cuenta igual con
 * `longitudComoServidor`, no con `value.length`.
 *
 * No toca el DOM, ni el entorno, ni datos del sitio: lo importan las funciones
 * de Vercel y los scripts del navegador por igual.
 */

export interface Limites {
  min: number;
  max: number;
}

export const LIMITES_TEXTO = {
  /** Descripción de la radicación comercial (src/lib/pqrs/solicitud.ts). */
  descripcion: { min: 10, max: 5000 },
  /** «¿Qué necesitas?» del bloque administrativo (src/lib/pqrs/administrativa.ts). */
  mensajeAdministrativo: { min: 10, max: 1500 },
} as const satisfies Record<string, Limites>;

/** Texto recortado, o cadena vacía si no es texto. */
export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Quita caracteres de control: no aportan nada y ensucian correo y JSON. */
export function limpiar(valor: string): string {
  let salida = '';
  for (const caracter of valor) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo < 0x20 || codigo === 0x7f) continue;
    salida += caracter;
  }
  return salida;
}

/** Longitud tal como la mide la validación del servidor. */
export function longitudComoServidor(valor: string): number {
  return limpiar(texto(valor)).length;
}

export interface EstadoLongitud {
  longitud: number;
  /** Caracteres que faltan para el mínimo (0 si ya llega). */
  faltan: number;
  /** Caracteres que sobran por encima del máximo (0 si no se pasa). */
  sobran: number;
  ok: boolean;
}

export function estadoLongitud(valor: string, limites: Limites): EstadoLongitud {
  const longitud = longitudComoServidor(valor);
  const faltan = Math.max(0, limites.min - longitud);
  const sobran = Math.max(0, longitud - limites.max);
  return { longitud, faltan, sobran, ok: faltan === 0 && sobran === 0 };
}

const caracteres = (n: number) => `${n} ${n === 1 ? 'carácter' : 'caracteres'}`;

/** «Mínimo 10 caracteres.»: lo que se enseña bajo el campo antes de escribir. */
export function ayudaMinimo(limites: Limites): string {
  return `Mínimo ${caracteres(limites.min)}.`;
}

/** Texto del contador según lo escrito. */
export function textoContador(valor: string, limites: Limites): string {
  const estado = estadoLongitud(valor, limites);
  if (estado.longitud === 0) return ayudaMinimo(limites);
  if (estado.faltan > 0) {
    return `${estado.faltan === 1 ? 'Falta' : 'Faltan'} ${caracteres(estado.faltan)} (mínimo ${limites.min}).`;
  }
  if (estado.sobran > 0) {
    return `${estado.sobran === 1 ? 'Sobra' : 'Sobran'} ${caracteres(estado.sobran)} (máximo ${limites.max}).`;
  }
  return `${estado.longitud} de ${limites.max} caracteres.`;
}

/**
 * Número de radicado de una PQRS: `PQRS-YYYYMMDD-XXXXXX`.
 *
 * La parte aleatoria usa un alfabeto sin caracteres ambiguos: fuera el 0 y la
 * O, el 1 y la I. El radicado se dicta por teléfono y se copia a mano de un
 * correo, así que la confusión sale cara.
 */

/** 32 símbolos: A-Z y 2-9, quitando O, I, 0 y 1. */
export const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const LONGITUD_SUFIJO = 6;

/**
 * La fecha va en hora de Colombia, no en UTC.
 *
 * Vercel ejecuta las funciones en UTC: una PQRS radicada a las 19:30 de Tunja
 * llevaría la fecha del día siguiente, y el radicado dejaría de casar con lo
 * que la persona vio en pantalla y con los plazos de ley.
 */
export function fechaColombia(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
  return partes.replace(/-/g, '');
}

/**
 * Sufijo aleatorio con `crypto.getRandomValues`, no con `Math.random`.
 *
 * Se descartan los bytes que caen fuera del mayor múltiplo de 32 para que las
 * 32 letras salgan con la misma probabilidad; tomar el módulo a secas sesgaría
 * las primeras.
 */
function sufijoAleatorio(aleatorio: Crypto = globalThis.crypto): string {
  const TOPE = 256 - (256 % ALFABETO.length); // 256 es múltiplo de 32: no descarta nada
  let salida = '';
  while (salida.length < LONGITUD_SUFIJO) {
    const bytes = new Uint8Array(LONGITUD_SUFIJO);
    aleatorio.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= TOPE) continue;
      salida += ALFABETO[byte % ALFABETO.length];
      if (salida.length === LONGITUD_SUFIJO) break;
    }
  }
  return salida;
}

export function generarRadicado(ahora: Date = new Date(), aleatorio?: Crypto): string {
  return `PQRS-${fechaColombia(ahora)}-${sufijoAleatorio(aleatorio ?? globalThis.crypto)}`;
}

/** Forma exacta de un radicado. Se usa para no aceptar rutas inventadas. */
export const FORMA_RADICADO = new RegExp(`^PQRS-\\d{8}-[${ALFABETO}]{${LONGITUD_SUFIJO}}$`);

export function esRadicadoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMA_RADICADO.test(valor);
}

/** Fecha de radicación en texto, para el correo y la pantalla de confirmación. */
export function fechaLegible(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(ahora);
}

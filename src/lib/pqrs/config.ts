/**
 * Configuración de la radicación de PQRS en el servidor.
 *
 * Todo se lee de variables de entorno EN CADA LLAMADA, no al importar el
 * módulo. Así las funciones de Vercel recogen un cambio de variable sin
 * necesidad de recompilar, y las pruebas pueden inyectar un entorno distinto
 * sin recargar módulos.
 */
import { EXTENSION_A_MIME, MAX_ARCHIVOS_POR_DEFECTO, MAX_MB_POR_DEFECTO } from '../adjuntos';

export type Entorno = Record<string, string | undefined>;

/** En Astro las rutas de API corren en Node, así que `process.env` existe. */
function entornoActual(): Entorno {
  return typeof process === 'undefined' ? {} : (process.env as Entorno);
}

/** Peso máximo por archivo, en MB. Variable: PQRS_ADJUNTO_MAX_MB. */
export function maxMb(env: Entorno = entornoActual()): number {
  const valor = Number(env.PQRS_ADJUNTO_MAX_MB);
  return Number.isFinite(valor) && valor > 0 ? valor : MAX_MB_POR_DEFECTO;
}

export function maxBytes(env: Entorno = entornoActual()): number {
  return Math.round(maxMb(env) * 1024 * 1024);
}

/** Cuántos soportes admite una radicación. Variable: PQRS_MAX_ARCHIVOS. */
export function maxArchivos(env: Entorno = entornoActual()): number {
  const valor = Number(env.PQRS_MAX_ARCHIVOS);
  return Number.isInteger(valor) && valor > 0 ? valor : MAX_ARCHIVOS_POR_DEFECTO;
}

/**
 * MIME que el token de subida deja pasar.
 *
 * Es la lista de `EXTENSION_A_MIME` sin repetidos (.jpg y .jpeg comparten
 * image/jpeg). Vercel Blob la comprueba contra el `Content-Type` que declara el
 * navegador, así que **filtra pero no demuestra nada**: la comprobación de
 * verdad es la de bytes mágicos que hace /api/pqrs al descargar el blob.
 */
export const MIME_PERMITIDOS: readonly string[] = [...new Set(Object.values(EXTENSION_A_MIME))];

/**
 * Acceso con el que se crean los blobs. Variable: PUBLIC_PQRS_BLOB_ACCESS.
 *
 * Por defecto `private`: los soportes de una queja no pueden quedar servidos en
 * una URL pública, aunque sea larga. Si el plan de la cuenta no admitiera blobs
 * privados, poner `public` deja el sistema funcionando, pero entonces la única
 * protección es que la ruta lleva un UUID no adivinable. Está documentado en
 * docs/PQRS-ADJUNTOS.md; no es equivalente y conviene volver a `private`.
 *
 * Lleva prefijo PUBLIC_ porque el navegador necesita el MISMO valor al llamar a
 * `upload()`: si servidor y cliente no coinciden, el blob se crea con un acceso
 * y se lee con otro. Una sola variable evita esa desincronización.
 */
export function accesoBlob(env: Entorno = entornoActual()): 'private' | 'public' {
  return env.PUBLIC_PQRS_BLOB_ACCESS === 'public' ? 'public' : 'private';
}

/** Correo al que llega cada radicación. Variable: PQRS_DESTINO. */
export function correoDestino(env: Entorno = entornoActual()): string {
  return env.PQRS_DESTINO ?? '';
}

/** Remitente de los correos. Debe ser un dominio verificado en Resend. */
export function correoRemitente(env: Entorno = entornoActual()): string {
  return env.PQRS_REMITENTE ?? 'PQRS Distribuciones Santiago de Tunja <pqrs@dstunja.com>';
}

// --- Rutas dentro del store de Blob ----------------------------------------

/** Los blobs recién subidos, todavía sin radicar, viven aquí. */
export const PREFIJO_PENDIENTES = 'pqrs/pendientes/';

/** Los blobs ya radicados viven aquí, bajo su número de radicado. */
export const PREFIJO_RADICADAS = 'pqrs/';

/** Horas que un pendiente sobrevive antes de que el cron lo borre. */
export const HORAS_RETENCION_PENDIENTES = 24;

/** Minutos que dura un enlace de descarga firmado del correo. */
export const MINUTOS_ENLACE_DESCARGA = 60 * 24 * 7;

/**
 * Un `sessionId` es un UUID v4 generado por el navegador. Se valida con esta
 * forma antes de meterlo en una ruta de blob: si no, `../` en el sessionId
 * dejaría escribir fuera del prefijo de pendientes.
 */
export const FORMA_SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function esSessionIdValido(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMA_SESSION_ID.test(valor);
}

/** Ruta de un soporte todavía sin radicar. */
export function rutaPendiente(sessionId: string, uuid: string, extension: string): string {
  return `${PREFIJO_PENDIENTES}${sessionId}/${uuid}${extension}`;
}

/** Ruta definitiva de un soporte, una vez la PQRS tiene radicado. */
export function rutaRadicada(radicado: string, uuid: string, extension: string): string {
  return `${PREFIJO_RADICADAS}${radicado}/${uuid}${extension}`;
}

/** Ruta del JSON que hace de registro de la radicación. */
export function rutaSolicitud(radicado: string): string {
  return `${PREFIJO_RADICADAS}${radicado}/solicitud.json`;
}

/** Prefijo de todos los pendientes de una sesión. */
export function prefijoSesion(sessionId: string): string {
  return `${PREFIJO_PENDIENTES}${sessionId}/`;
}

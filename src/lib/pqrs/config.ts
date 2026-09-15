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
 * Acceso con el que se crean y se leen los blobs: SIEMPRE privado.
 *
 * Hubo una variable, PUBLIC_PQRS_BLOB_ACCESS, que permitía `public` para
 * cuentas sin blobs privados. Se quitó: el store del proyecto (pqrs-adjuntos)
 * es privado, un store privado rechaza las subidas con acceso público, y los
 * soportes de una queja no pueden quedar servidos en una URL abierta. El
 * navegador usa el mismo valor fijo al llamar a `upload()`
 * (src/components/FormularioPqrs.astro).
 */
export const ACCESO_BLOB = 'private' as const;

/**
 * Buzón que recibe TODO lo de la página de PQRS. Variable: PQRS_DESTINO.
 *
 * Por defecto, informacioncomercialdst@gmail.com. No es un valor cualquiera:
 * mientras el remitente sea `onboarding@resend.dev` (sin dominio verificado),
 * Resend SOLO entrega al correo con el que está registrada la cuenta, y la
 * cuenta de PQRS está registrada con esa dirección.
 */
export const DESTINO_PQRS_POR_DEFECTO = 'informacioncomercialdst@gmail.com';

export function correoDestino(env: Entorno = entornoActual()): string {
  return env.PQRS_DESTINO?.trim() || DESTINO_PQRS_POR_DEFECTO;
}

/**
 * Remitente de los correos. Variable: PQRS_REMITENTE.
 *
 * Por defecto `onboarding@resend.dev`, el remitente de pruebas que Resend deja
 * usar sin verificar ningún dominio. Cuando haya un dominio verificado (por
 * ejemplo dstunja.com), basta con poner aquí una dirección de ese dominio.
 *
 * Empleos lo hereda si no tiene EMPLEOS_REMITENTE (src/lib/empleos/config.ts).
 */
export const REMITENTE_POR_DEFECTO = 'onboarding@resend.dev';

export function correoRemitente(env: Entorno = entornoActual()): string {
  return env.PQRS_REMITENTE?.trim() || REMITENTE_POR_DEFECTO;
}

/**
 * ¿Es el remitente de pruebas de Resend (`@resend.dev`)?
 *
 * Con él, Resend rechaza cualquier destinatario que no sea el titular de la
 * cuenta. El correo al área sí sale (el área ES la titular), pero la constancia
 * a quien radica fallaría siempre: por eso no se intenta mandar.
 */
export function esRemitenteDePrueba(remitente: string): boolean {
  const direccion = /<([^>]+)>/.exec(remitente)?.[1] ?? remitente;
  return direccion.trim().toLowerCase().endsWith('@resend.dev');
}

/**
 * Clave de Resend de PQRS. Variables: PQRS_RESEND_API_KEY, y si no está,
 * RESEND_API_KEY.
 *
 * Son dos porque PQRS y Empleos usan CUENTAS DE RESEND DISTINTAS: con el
 * remitente de pruebas cada cuenta solo entrega a su titular, y los buzones de
 * PQRS y de Talento Humano son de titulares distintos. Empleos usa
 * RESEND_API_KEY; PQRS usa la suya y solo cae a la otra si no la tiene.
 */
export function claveResend(env: Entorno = entornoActual()): string {
  return env.PQRS_RESEND_API_KEY?.trim() || env.RESEND_API_KEY?.trim() || '';
}

/** ¿Hay token del Blob store? Lo pone Vercel al conectar el store. */
export function blobConfigurado(env: Entorno = entornoActual()): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * Nombres de lo que falta para radicar. Nunca valores.
 *
 * Se consulta ANTES de hacer nada: sin Blob no hay dónde guardar la solicitud y
 * sin Resend nadie se entera de que existe. En los dos casos se responde 503
 * con `codigo: 'config-incompleta'` y el formulario lo avisa y ofrece el correo,
 * en vez de que la radicación reviente a mitad de camino.
 */
export function faltaParaRadicar(env: Entorno = entornoActual()): string[] {
  const faltan: string[] = [];
  if (!blobConfigurado(env)) faltan.push('BLOB_READ_WRITE_TOKEN');
  if (!claveResend(env)) faltan.push('PQRS_RESEND_API_KEY (o RESEND_API_KEY)');
  return faltan;
}

// --- Rutas dentro del store de Blob ----------------------------------------

/** Los blobs recién subidos, todavía sin radicar, viven aquí. */
export const PREFIJO_PENDIENTES = 'pqrs/pendientes/';

/** Los blobs ya radicados viven aquí, bajo su número de radicado. */
export const PREFIJO_RADICADAS = 'pqrs/';

/** Horas que un pendiente sobrevive antes de que el cron lo borre. */
export const HORAS_RETENCION_PENDIENTES = 24;

/**
 * Minutos que dura el enlace de descarga que va en el correo al área (7 días).
 *
 * Ese enlace apunta a /api/pqrs/descarga, que lo verifica y redirige a una URL
 * firmada de Vercel Blob de vida corta (`MINUTOS_ENLACE_BLOB`). Así la vida del
 * enlace del correo no depende de cuánto admita Vercel para una URL firmada.
 */
export const MINUTOS_ENLACE_DESCARGA = 60 * 24 * 7;

/** Minutos que dura la URL firmada de Blob a la que redirige la descarga. */
export const MINUTOS_ENLACE_BLOB = 5;

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

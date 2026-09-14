/**
 * El trabajo de POST /api/empleos/postular, separado del endpoint para poder
 * probarlo sin levantar un servidor.
 *
 * QUÉ HACE. Recibe el formulario de /empleos/ como multipart (los campos de
 * texto y la hoja de vida), lo valida, comprueba que no es un robot y manda UN
 * correo a Talento Humano con la hoja de vida adjunta. No genera radicado, no
 * guarda nada: el archivo vive en la memoria de la función lo que dura la
 * petición y se va con ella.
 *
 * ORDEN DE LAS COMPROBACIONES, como en la PQRS: primero lo barato y local
 * (forma del cuerpo, campo trampa, campos y bytes del archivo), luego el límite
 * por IP, después Turnstile y solo al final Resend, que son llamadas de red. Un
 * 400 llega sin gastar un token de Turnstile, que es de un solo uso.
 *
 * POR QUÉ EL ARCHIVO PASA POR LA FUNCIÓN y no por Vercel Blob como en PQRS: no
 * hay que conservarlo, así que subirlo a un almacenamiento para bajarlo,
 * adjuntarlo y borrarlo sería dar tres pasos para no guardar nada. El precio es
 * el tope de 4,5 MB de cuerpo de una función de Vercel, y por eso la hoja de
 * vida se limita a 4 MB (src/lib/empleos/hoja-de-vida.ts).
 */
import { limitar } from '../pqrs/limite-tasa';
import { ipDePeticion } from '../pqrs/solicitud';
import { verificarTurnstile } from '../pqrs/turnstile';
import { LIMITE_POSTULACIONES, type Entorno } from './config';
import { enviarCorreoPostulacion } from './correo';
import { esRobot, validarPostulacion } from './postulacion';

export interface RespuestaPostulacion {
  estado: number;
  cuerpo: { ok: true } | { ok: false; errores: string[] };
}

function error(estado: number, ...errores: string[]): RespuestaPostulacion {
  return { estado, cuerpo: { ok: false, errores } };
}

export async function atenderPostulacion(
  peticion: Request,
  env: Entorno,
): Promise<RespuestaPostulacion> {
  // --- 1. Cuerpo ------------------------------------------------------------
  const tipo = (peticion.headers.get('content-type') ?? '').toLowerCase();
  if (!tipo.startsWith('multipart/form-data')) {
    return error(400, 'El formulario debe enviarse como multipart/form-data.');
  }

  let formulario: FormData;
  try {
    formulario = await peticion.formData();
  } catch {
    return error(400, 'No pudimos leer el formulario. Recarga la página e inténtalo de nuevo.');
  }

  // --- 2. Campo trampa ------------------------------------------------------
  // Un robot que rellenó el campo oculto recibe un 200 vacío: no se le dice qué
  // lo delató y no se gasta ni una llamada de red en él.
  if (esRobot(formulario)) {
    return { estado: 200, cuerpo: { ok: true } };
  }

  // --- 3. Campos y hoja de vida ---------------------------------------------
  const validacion = await validarPostulacion(formulario);
  if (!validacion.ok) return error(400, ...validacion.errores);
  const datos = validacion.datos;

  const ip = ipDePeticion(peticion.headers);

  // --- 4. Límite de tasa ----------------------------------------------------
  const veredicto = await limitar(ip, LIMITE_POSTULACIONES, env);
  if (!veredicto.ok) {
    const minutos = Math.ceil(veredicto.segundosEspera / 60);
    return error(
      429,
      `Has enviado varias postulaciones seguidas. Espera ${minutos} minuto${minutos === 1 ? '' : 's'} e inténtalo de nuevo.`,
    );
  }

  // --- 5. Turnstile ---------------------------------------------------------
  const antirrobots = await verificarTurnstile(datos.turnstileToken, ip, env);
  if (!antirrobots.ok) {
    return error(403, antirrobots.error ?? 'La comprobación antirrobots no pasó.');
  }

  // --- 6. Correo ------------------------------------------------------------
  const envio = await enviarCorreoPostulacion(datos, env);
  if (!envio.ok) {
    /*
     * 500, y no 200 con un aviso: aquí no queda registro en ningún sitio, así
     * que si el correo no sale no queda NADA. Con un 500 el navegador cae al
     * `mailto:` y la persona sí consigue mandar su hoja de vida; con un 200 se
     * iría convencida de que nos llegó.
     *
     * El motivo concreto (una clave mal puesta, un dominio sin verificar en
     * Resend) se queda en el registro de Vercel y no viaja al navegador.
     */
    console.error('[empleos/postular] no se pudo enviar el correo:', envio.error);
    return error(500, 'No pudimos enviar tu postulación en este momento.');
  }

  return { estado: 200, cuerpo: { ok: true } };
}

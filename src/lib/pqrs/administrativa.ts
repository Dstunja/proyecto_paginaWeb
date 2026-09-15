/**
 * El trabajo de POST /api/pqrs/administrativa, separado del endpoint para poder
 * probarlo sin levantar un servidor.
 *
 * QUÉ ES ESTO Y QUÉ NO ES. Es el formulario corto del bloque administrativo de
 * la página de PQRS: nombre, teléfono, correo opcional y un mensaje. NO es una
 * radicación —no genera número, no guarda nada en el Blob y no admite
 * adjuntos—; solo manda un correo al equipo para que devuelva el contacto. Por
 * eso la respuesta es un simple `{ ok: true }` y no un radicado: prometer un
 * número de seguimiento que nadie ha creado sería mentir en pantalla.
 *
 * TAMBIÉN ES OPCIONAL. El bloque enseña el teléfono, el WhatsApp y el correo
 * primero; este formulario está debajo para quien prefiera que le llamen. Si la
 * función no existe (el espejo de GitHub Pages no tiene backend) el navegador
 * cae a un `mailto:`, así que nadie se queda sin poder escribir.
 *
 * ORDEN DE LAS COMPROBACIONES, igual que en radicar.ts: primero lo barato y
 * local (forma del JSON), luego el límite de tasa, y solo después Turnstile y
 * Resend, que son llamadas de red.
 */
import { enviarCorreoAdministrativo } from './correo';
import { claveResend, type Entorno } from './config';
import { LIMITES_TEXTO } from './limites-texto';
import { limitar } from './limite-tasa';
import { FORMA_CORREO, ipDePeticion, limpiar, texto } from './solicitud';
import { verificarTurnstile } from './turnstile';

export interface RespuestaAdministrativa {
  estado: number;
  cuerpo: { ok: true } | { ok: false; errores: string[]; codigo?: 'config-incompleta' };
}

export interface DatosAdministrativa {
  nombre: string;
  telefono: string;
  /** Vacío si no lo dejó: aquí el correo es opcional de verdad. */
  correo: string;
  mensaje: string;
  turnstileToken: string;
}

/**
 * Topes de longitud. Son más cortos que los de una PQRS porque esto es un
 * recado, no un relato de los hechos: el campo de la página pide «mensaje
 * corto» y el servidor tiene que decir lo mismo, o el aviso del navegador y el
 * del servidor se contradicen.
 */
const LIMITES = {
  nombre: 150,
  telefono: 30,
  correo: 150,
  // Mínimo y máximo del mensaje: los mismos que enseña el contador del campo.
  mensaje: LIMITES_TEXTO.mensajeAdministrativo,
} as const;

/** Cinco recados por IP cada diez minutos, como la radicación. */
const LIMITE = { maximo: 5, ventanaSegundos: 600, prefijo: 'pqrs:administrativa' };

export type ResultadoAdministrativa =
  | { ok: true; datos: DatosAdministrativa }
  | { ok: false; errores: string[] };

function error(estado: number, ...errores: string[]): RespuestaAdministrativa {
  return { estado, cuerpo: { ok: false, errores } };
}

/**
 * Comprueba el cuerpo JSON. Devuelve TODOS los errores, no solo el primero: a
 * quien le falten dos campos prefiere enterarse de los dos de una vez.
 */
export function validarAdministrativa(cuerpo: unknown): ResultadoAdministrativa {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return { ok: false, errores: ['El cuerpo de la petición no es un objeto JSON.'] };
  }
  const datos = cuerpo as Record<string, unknown>;
  const errores: string[] = [];

  const nombre = limpiar(texto(datos.nombre));
  if (nombre.length < 3) errores.push('El nombre es obligatorio.');
  else if (nombre.length > LIMITES.nombre) errores.push('El nombre es demasiado largo.');

  const telefono = limpiar(texto(datos.telefono));
  // El "57" inicial se descuenta para que un número escrito con indicativo no
  // parezca de más dígitos de los que tiene.
  const digitos = telefono.replace(/\D/g, '').replace(/^57/, '');
  if (digitos.length < 7 || digitos.length > 15) {
    errores.push('El teléfono debe tener entre 7 y 15 dígitos.');
  } else if (telefono.length > LIMITES.telefono) {
    errores.push('El teléfono es demasiado largo.');
  }

  // Opcional: solo se valida la forma si escribió algo. Un campo vacío no es un
  // error, es la respuesta legítima de quien prefiere que le llamen.
  const correo = limpiar(texto(datos.correo));
  if (correo !== '') {
    if (!FORMA_CORREO.test(correo)) errores.push('El correo no tiene un formato válido.');
    else if (correo.length > LIMITES.correo) errores.push('El correo es demasiado largo.');
  }

  const mensaje = limpiar(texto(datos.mensaje));
  if (mensaje.length < LIMITES.mensaje.min) {
    errores.push(`Cuéntanos brevemente qué necesitas, en al menos ${LIMITES.mensaje.min} caracteres.`);
  } else if (mensaje.length > LIMITES.mensaje.max) {
    errores.push(`El mensaje no puede pasar de ${LIMITES.mensaje.max} caracteres.`);
  }

  if (errores.length > 0) return { ok: false, errores };

  return {
    ok: true,
    datos: { nombre, telefono, correo, mensaje, turnstileToken: texto(datos.turnstileToken) },
  };
}

export async function atenderAdministrativa(
  peticion: Request,
  env: Entorno,
): Promise<RespuestaAdministrativa> {
  // --- 0. Configuración -----------------------------------------------------
  // Sin clave de Resend el recado no puede salir. Se dice antes de gastar nada:
  // 503 con un código que el formulario reconoce para avisar y abrir el correo.
  if (!claveResend(env)) {
    console.error('[pqrs/administrativa] falta PQRS_RESEND_API_KEY (o RESEND_API_KEY).');
    return {
      estado: 503,
      cuerpo: {
        ok: false,
        codigo: 'config-incompleta',
        errores: ['El envío en línea no está disponible en este momento.'],
      },
    };
  }

  // --- 1. Cuerpo ------------------------------------------------------------
  let bruto: unknown;
  try {
    bruto = await peticion.json();
  } catch {
    return error(400, 'El cuerpo de la petición no es JSON válido.');
  }

  const validacion = validarAdministrativa(bruto);
  if (!validacion.ok) return error(400, ...validacion.errores);
  const datos = validacion.datos;

  const ip = ipDePeticion(peticion.headers);

  // --- 2. Límite de tasa ----------------------------------------------------
  const veredicto = await limitar(ip, LIMITE, env);
  if (!veredicto.ok) {
    const minutos = Math.ceil(veredicto.segundosEspera / 60);
    return error(
      429,
      `Has enviado varias solicitudes seguidas. Espera ${minutos} minuto${minutos === 1 ? '' : 's'} e inténtalo de nuevo.`,
    );
  }

  // --- 3. Turnstile ---------------------------------------------------------
  const antirrobots = await verificarTurnstile(datos.turnstileToken, ip, env);
  if (!antirrobots.ok) {
    return error(403, antirrobots.error ?? 'La comprobación antirrobots no pasó.');
  }

  // --- 4. Correo ------------------------------------------------------------
  const envio = await enviarCorreoAdministrativo(datos, env);
  if (!envio.ok) {
    /*
     * 500, y no 200 con un aviso. La diferencia importa: aquí no hay registro
     * en el Blob que dé fe de que la solicitud existió, así que si el correo no
     * sale no queda NADA. Con un 500 el navegador cae al `mailto:` y la persona
     * sí consigue escribirnos; con un 200 se iría convencida de que nos llegó.
     *
     * El motivo concreto (una clave mal puesta, un dominio sin verificar en
     * Resend) se queda en el registro de Vercel y no viaja al navegador.
     */
    console.error('[pqrs/administrativa] no se pudo enviar el correo:', envio.error);
    return error(500, 'No pudimos enviar tu solicitud en este momento.');
  }

  return { estado: 200, cuerpo: { ok: true } };
}

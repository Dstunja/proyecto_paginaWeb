/**
 * Códigos de error de POST /api/pqrs/token, con su HTTP y su mensaje.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. Antes el endpoint devolvía **400 para todo**,
 * incluida la falta de configuración del servidor. Como `@vercel/blob` solo
 * mira si la respuesta es 2xx, el navegador recibía siempre el mismo
 * "Failed to retrieve the client token" y no había manera de distinguir "no
 * eres humano" de "al administrador se le olvidó conectar el Blob store". Eso
 * pasó de verdad en producción: `BLOB_READ_WRITE_TOKEN` no estaba definida y
 * durante días el único síntoma visible fue ese mensaje del SDK.
 *
 * El `codigo` es para el programa (el formulario decide con él si ofrecer el
 * respaldo por correo); el `mensaje` es para la persona y por eso está en
 * español, sin jerga y sin filtrar nada del servidor. Los detalles técnicos van
 * al registro de Vercel, nunca al cuerpo de la respuesta.
 */
import { FORMATOS_LEGIBLES } from '../adjuntos';

export type CodigoError =
  | 'config-incompleta'
  | 'cuerpo-invalido'
  | 'sesion-invalida'
  | 'ruta-ajena'
  | 'tipo-sin-soporte'
  | 'archivo-no-permitido'
  | 'antirrobots'
  | 'demasiadas-peticiones';

export interface CuerpoError {
  ok: false;
  codigo: CodigoError;
  mensaje: string;
}

export interface Respuesta<T = unknown> {
  estado: number;
  cuerpo: CuerpoError | T;
}

/**
 * HTTP de cada código.
 *
 * 415 y 422 no son adorno: distinguen "este archivo no vale" (cambia el
 * archivo) de "esta solicitud no admite archivos" (cambia el tipo de PQRS), que
 * es lo primero que hay que saber para arreglarlo.
 */
export const ESTADO: Record<CodigoError, number> = {
  'config-incompleta': 500,
  'cuerpo-invalido': 400,
  'sesion-invalida': 400,
  'ruta-ajena': 400,
  'antirrobots': 403,
  'archivo-no-permitido': 415,
  'tipo-sin-soporte': 422,
  'demasiadas-peticiones': 429,
};

/** Lo que lee la persona. Ninguno menciona variables ni rutas del servidor. */
export const MENSAJE: Record<CodigoError, string> = {
  'config-incompleta':
    'El servicio de adjuntos no está configurado. Contacta al administrador del sitio.',
  'cuerpo-invalido': 'Los datos de la subida no son válidos. Recarga la página e inténtalo de nuevo.',
  'sesion-invalida': 'La sesión de subida caducó. Recarga la página e inténtalo de nuevo.',
  'ruta-ajena': 'La ruta de subida no corresponde a esta sesión. Recarga la página.',
  'antirrobots': 'No se pudo verificar que no eres un robot. Recarga la página e inténtalo de nuevo.',
  'archivo-no-permitido': `Este tipo de archivo no está permitido. Solo aceptamos ${FORMATOS_LEGIBLES}.`,
  'tipo-sin-soporte': 'Este tipo de solicitud no admite archivos de soporte.',
  'demasiadas-peticiones': 'Demasiadas subidas seguidas. Espera un momento e inténtalo de nuevo.',
};

/**
 * Construye la respuesta de error. `mensaje` permite afinar el texto sin
 * inventarse un código nuevo (por ejemplo, decir cuántos minutos hay que
 * esperar); si no se pasa, manda el de la tabla.
 */
export function fallo(codigo: CodigoError, mensaje?: string): Respuesta<never> {
  return {
    estado: ESTADO[codigo],
    cuerpo: { ok: false, codigo, mensaje: mensaje ?? MENSAJE[codigo] },
  };
}

/**
 * La red de seguridad de las postulaciones: guardar en Vercel Blob lo que el
 * correo no consiguió llevar.
 *
 * POR QUÉ EXISTE. Hasta ahora, si Resend fallaba, la hoja de vida se perdía: el
 * archivo vivía en la memoria de la función y se iba con la petición, y lo único
 * que quedaba era abrirle al candidato su gestor de correo para que la adjuntara
 * otra vez a mano. La mayoría no lo hacía, y en el celular ese `mailto:` muchas
 * veces no abría nada. Ahora, antes de dar por perdida una postulación, se
 * escribe en el Blob: la hoja de vida y un `registro.json` con los datos del
 * formulario. Con eso la postulación existe aunque el correo llegue tarde o no
 * llegue, y Talento Humano la puede recuperar.
 *
 * NO ES LA VÍA NORMAL. El camino bueno sigue siendo el correo con el archivo
 * adjunto; esto solo se ejecuta cuando ese camino ya falló (ver
 * ./postular.ts). Si todo va bien, en el Blob no se escribe nada.
 *
 * DÓNDE. Store `pqrs-adjuntos`, el mismo de PQRS, bajo el prefijo `empleos/` y
 * con `access: 'private'`: un blob privado no se abre con su URL a secas. El
 * correo de aviso lleva un enlace firmado a /api/empleos/descarga, igual que
 * hace PQRS con sus soportes.
 *
 * DATOS PERSONALES Y LEY 1581. El `registro.json` lleva nombre, correo, teléfono
 * y el texto de experiencia, que es exactamente lo que el candidato autorizó a
 * tratar con fines de selección al marcar la casilla obligatoria del formulario.
 * Lo que NO tiene es la IP, ni la huella del archivo, ni nada que no haya escrito
 * él. ATENCIÓN: no hay borrado automático de esta carpeta. El cron
 * /api/pqrs/limpieza solo toca `pqrs/pendientes/`. Fijar cuánto se conservan
 * estas hojas de vida y programar su borrado es una decisión pendiente, y es una
 * obligación de la ley, no una mejora opcional (ver docs/EMPLEOS-POSTULACION.md).
 */
import * as almacen from '../pqrs/almacen';
import { fechaColombia, sufijoAleatorio } from '../pqrs/radicado';
import type { Entorno } from './config';
import type { PostulacionValidada } from './postulacion';

/** Prefijo de todo lo de Empleos dentro del store. */
export const PREFIJO_EMPLEOS = 'empleos/';

/**
 * Identificador de una postulación guardada: `EMP-20260929-A7K2M9`.
 *
 * Misma forma y mismo alfabeto sin caracteres ambiguos que el radicado de PQRS,
 * porque sirve para lo mismo: que alguien lo lea de un correo y lo busque en el
 * panel de Vercel sin confundir un 0 con una O. NO es un número de radicado y no
 * se le promete al candidato: una postulación de empleo no tiene plazo legal.
 */
export function generarIdPostulacion(ahora: Date = new Date()): string {
  return `EMP-${fechaColombia(ahora)}-${sufijoAleatorio()}`;
}

/** Ruta de la hoja de vida dentro del store. */
export function rutaHojaDeVida(id: string, uuid: string, extension: string): string {
  return `${PREFIJO_EMPLEOS}${id}/${uuid}${extension}`;
}

/** Ruta del JSON con los datos del formulario. */
export function rutaRegistro(id: string): string {
  return `${PREFIJO_EMPLEOS}${id}/registro.json`;
}

export interface PostulacionGuardada {
  id: string;
  /** Ruta del archivo en el store, la que se firma para el enlace. */
  rutaHojaDeVida: string;
}

export type ResultadoGuardado =
  | { ok: true; guardada: PostulacionGuardada }
  | { ok: false; error: string };

/**
 * Escribe la postulación completa en el Blob.
 *
 * ORDEN: primero la hoja de vida, después el registro. Si el registro falla, el
 * archivo ya está a salvo y se devuelve `ok` igual: perder el JSON es perder los
 * datos de contacto, que también van en el correo de aviso; perder el archivo
 * es perder la postulación, y eso es lo que no puede pasar.
 */
export async function guardarPostulacion(
  datos: PostulacionValidada,
  env: Entorno,
  ahora: Date = new Date(),
): Promise<ResultadoGuardado> {
  const id = generarIdPostulacion(ahora);
  const ruta = rutaHojaDeVida(id, crypto.randomUUID(), datos.hojaDeVida.extension);

  try {
    await almacen.guardarBytes(ruta, datos.hojaDeVida.bytes, datos.hojaDeVida.mime, env);
  } catch (fallo) {
    return { ok: false, error: `hoja de vida: ${(fallo as Error).message}` };
  }

  try {
    await almacen.guardarJson(
      rutaRegistro(id),
      {
        id,
        recibidaEn: ahora.toISOString(),
        verificada: !datos.sinVerificar,
        codigoTurnstile: datos.codigoTurnstile || null,
        candidato: {
          nombre: datos.nombre,
          correo: datos.correo,
          telefono: datos.telefono,
        },
        cargo: datos.cargo,
        experiencia: datos.experiencia || null,
        autorizacionLey1581: true,
        hojaDeVida: {
          ruta,
          nombreOriginal: datos.hojaDeVida.nombreOriginal,
          mime: datos.hojaDeVida.mime,
          bytes: datos.hojaDeVida.tamano,
        },
      },
      env,
    );
  } catch (fallo) {
    // La hoja de vida ya está guardada: la postulación no se pierde.
    console.error('[empleos/almacen] no se pudo escribir el registro:', (fallo as Error).message);
  }

  return { ok: true, guardada: { id, rutaHojaDeVida: ruta } };
}

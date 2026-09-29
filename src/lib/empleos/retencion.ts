/**
 * Cuánto se conservan las hojas de vida guardadas en el Blob, y el borrado que
 * lo cumple.
 *
 * POR QUÉ EXISTE ESTO. Cuando el correo a Talento Humano no sale, la hoja de
 * vida y los datos del formulario se guardan bajo `empleos/EMP-…/` para no
 * perder la postulación (ver ./almacen.ts). Eso resuelve un problema y crea
 * otro: un almacén de datos personales que crece y que nadie vacía. La Ley 1581
 * de 2012 pide una finalidad y un plazo, y «para siempre» no es un plazo: el
 * dato deja de poder conservarse cuando ya no sirve a la finalidad que la
 * persona autorizó, que aquí es un proceso de selección concreto.
 *
 * SEIS MESES. Es lo que se usa habitualmente para hojas de vida de selección:
 * cubre el proceso que motivó la postulación y deja margen para volver sobre un
 * candidato cuando se abre una vacante parecida, que es justo la razón por la
 * que una empresa guarda hojas de vida. Más allá, lo que queda no es una
 * postulación viva sino un archivo de datos personales sin uso. El número se
 * puede cambiar con `EMPLEOS_RETENCION_MESES` sin tocar código, porque es una
 * decisión del negocio y no una constante técnica.
 *
 * NACE DESACTIVADO, Y ES A PROPÓSITO. Mientras `EMPLEOS_RETENCION_ACTIVA` no
 * valga exactamente `'1'`, `limpiarPostulaciones` hace un SIMULACRO: mira qué
 * borraría y no borra nada. Un borrado programado que se estrena solo, sobre
 * datos que no se pueden recuperar, es la clase de cosa que hay que encender a
 * mano y mirando. El simulacro sirve además para ver, antes de encenderlo,
 * cuántas postulaciones se llevaría por delante la primera pasada.
 */
import * as almacen from '../pqrs/almacen';
import { PREFIJO_EMPLEOS } from './almacen';
import type { Entorno } from './config';

/** Plazo por defecto, en meses. Variable: EMPLEOS_RETENCION_MESES. */
export const MESES_RETENCION_POR_DEFECTO = 6;

export function mesesRetencion(env: Entorno): number {
  const valor = Number(env.EMPLEOS_RETENCION_MESES);
  return Number.isFinite(valor) && valor > 0 ? valor : MESES_RETENCION_POR_DEFECTO;
}

/**
 * ¿Borra de verdad, o solo mira?
 *
 * Se exige el valor exacto `'1'`. Ni `true`, ni `si`, ni una cadena vacía que
 * alguien dejó al copiar variables: para encender un borrado irreversible hay
 * que escribir justo lo que dice la documentación.
 */
export function retencionActiva(env: Entorno): boolean {
  return env.EMPLEOS_RETENCION_ACTIVA === '1';
}

/** Una postulación guardada, con todos sus archivos. */
interface Postulacion {
  id: string;
  rutas: string[];
  /** La subida más reciente del grupo: es la edad de la postulación. */
  ultimaSubida: number;
}

/**
 * Agrupa los blobs por identificador de postulación.
 *
 * Se borra la carpeta entera o no se borra nada. Filtrar blob a blob dejaría
 * carpetas a medias —el `registro.json` sin la hoja de vida, o al revés— que
 * son peores que no haber borrado: ocupan sitio, siguen teniendo datos
 * personales y ya no sirven para nada.
 */
function agrupar(blobs: Array<{ pathname: string; subidoEn: Date }>): Postulacion[] {
  const grupos = new Map<string, Postulacion>();

  for (const blob of blobs) {
    // empleos/EMP-20260929-A7K2M9/loquesea → el id es el segundo tramo.
    const id = blob.pathname.split('/')[1];
    if (!id) continue;

    const grupo = grupos.get(id) ?? { id, rutas: [], ultimaSubida: 0 };
    grupo.rutas.push(blob.pathname);
    grupo.ultimaSubida = Math.max(grupo.ultimaSubida, blob.subidoEn.getTime());
    grupos.set(id, grupo);
  }

  return [...grupos.values()];
}

export interface ResultadoLimpieza {
  /** Si es `true`, no se borró nada: solo se miró. */
  simulacro: boolean;
  meses: number;
  /** Postulaciones que hay en el store. */
  revisadas: number;
  /** Las que pasaron del plazo. */
  caducadas: number;
  /** Archivos borrados (0 en simulacro). */
  archivosBorrados: number;
  /**
   * Identificadores de las caducadas. Un `EMP-…` no dice nada de nadie: no
   * lleva nombre, ni correo, ni teléfono. Van en la respuesta para poder
   * comprobar, antes de encender el borrado, qué se llevaría por delante.
   */
  ids: string[];
}

/**
 * Borra las postulaciones guardadas que pasaron del plazo.
 *
 * @param ahora  inyectable para las pruebas.
 */
export async function limpiarPostulaciones(
  env: Entorno,
  ahora: Date = new Date(),
): Promise<ResultadoLimpieza> {
  const meses = mesesRetencion(env);
  const simulacro = !retencionActiva(env);

  const limite = new Date(ahora);
  limite.setMonth(limite.getMonth() - meses);

  const postulaciones = agrupar(await almacen.listar(PREFIJO_EMPLEOS, env));
  const caducadas = postulaciones.filter((p) => p.ultimaSubida < limite.getTime());

  let archivosBorrados = 0;
  if (!simulacro) {
    for (const caducada of caducadas) {
      await almacen.borrar(caducada.rutas, env);
      archivosBorrados += caducada.rutas.length;
    }
  }

  return {
    simulacro,
    meses,
    revisadas: postulaciones.length,
    caducadas: caducadas.length,
    archivosBorrados,
    ids: caducadas.map((c) => c.id),
  };
}

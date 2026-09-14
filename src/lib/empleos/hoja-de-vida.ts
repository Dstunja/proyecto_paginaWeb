/**
 * Reglas de la hoja de vida del formulario de Empleos.
 *
 * Igual que src/lib/adjuntos.ts, este módulo NO toca el DOM ni el entorno: lo
 * importan el navegador (para avisar antes de enviar) y la función de Vercel
 * (para decidir de verdad). Formatos, tope y texto de ayuda salen de aquí y de
 * ningún otro sitio, así que el aviso del campo y el rechazo del servidor no se
 * pueden contradecir.
 *
 * SOLO PDF, DOC Y DOCX. Una hoja de vida es un documento, no una foto. La
 * comprobación del contenido (bytes mágicos: `%PDF`, contenedor OLE2 para .doc
 * y ZIP con carpeta `word/` para .docx) la hace `validarArchivo` de
 * adjuntos.ts; aquí solo se restringe la lista de extensiones antes de
 * llamarla, para que un .png no reciba un mensaje que hable de JPG y PNG.
 *
 * TOPE DE 4 MB, Y NO 5. El archivo viaja dentro del cuerpo de la petición a la
 * función de Vercel, y Vercel rechaza cuerpos de más de 4,5 MB con un 413 antes
 * de que nuestro código vea nada. Con 4 MB de archivo más los campos de texto
 * queda margen. El formulario de PQRS admite 5 MB porque sus archivos no pasan
 * por la función: van del navegador a Vercel Blob (ver docs/PQRS-ADJUNTOS.md).
 */
import {
  EXTENSION_A_MIME,
  FORMATOS_LEGIBLES,
  extensionDe,
  lectorDeBlob,
  nombreParaMostrar,
  validarArchivo,
  type ArchivoAValidar,
  type ResultadoValidacion,
} from '../adjuntos';

/** Peso máximo de la hoja de vida, en MB. Ver la cabecera para el porqué. */
export const MAX_MB_HOJA_DE_VIDA = 4;

/** Extensiones admitidas, con el punto y en minúsculas. */
export const EXTENSIONES_HOJA_DE_VIDA: readonly string[] = ['.pdf', '.doc', '.docx'];

/** Valor del atributo `accept` del <input type="file">. */
export const ACEPTA_HOJA_DE_VIDA = EXTENSIONES_HOJA_DE_VIDA.join(',');

/** Lista legible de formatos, para los mensajes. */
export const FORMATOS_HOJA_DE_VIDA = 'PDF, DOC o DOCX';

/** Texto de ayuda que se muestra junto al campo, antes de elegir nada. */
export const AYUDA_HOJA_DE_VIDA = `${FORMATOS_HOJA_DE_VIDA}, máximo ${MAX_MB_HOJA_DE_VIDA} MB.`;

/** MIME que debe tener el contenido de cada extensión admitida. */
export const MIME_HOJA_DE_VIDA: readonly string[] = EXTENSIONES_HOJA_DE_VIDA.map(
  (extension) => EXTENSION_A_MIME[extension] as string,
);

/**
 * Aplica todas las reglas a un archivo: extensión admitida, peso, doble
 * extensión y que el contenido sea de verdad lo que dice la extensión.
 *
 * Devuelve el MIME real y el nombre saneado, que es el que va en el adjunto
 * del correo.
 */
export async function validarHojaDeVida(archivo: ArchivoAValidar): Promise<ResultadoValidacion> {
  const extension = extensionDe(archivo.nombre);
  if (!EXTENSIONES_HOJA_DE_VIDA.includes(extension)) {
    return {
      ok: false,
      error: `«${nombreParaMostrar(archivo.nombre)}»: formato no permitido. La hoja de vida debe ser ${FORMATOS_HOJA_DE_VIDA}.`,
    };
  }
  const resultado = await validarArchivo(archivo, { maxMb: MAX_MB_HOJA_DE_VIDA });
  if (resultado.ok) return resultado;
  // Los mensajes de adjuntos.ts nombran también JPG y PNG, que aquí no valen:
  // se sustituye la lista por la de la hoja de vida.
  return { ok: false, error: resultado.error.replace(FORMATOS_LEGIBLES, FORMATOS_HOJA_DE_VIDA) };
}

/** Atajo de navegador: valida un File tal cual sale del <input type="file">. */
export function validarFileHojaDeVida(file: File): Promise<ResultadoValidacion> {
  return validarHojaDeVida({ nombre: file.name, tamano: file.size, leer: lectorDeBlob(file) });
}

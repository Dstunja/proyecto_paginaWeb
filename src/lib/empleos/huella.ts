/**
 * Huella de una hoja de vida, para contar envíos sin contar personas.
 *
 * PARA QUÉ. El límite por IP a secas castiga a quien no debe: los operadores
 * móviles colombianos sacan a muchos clientes por una misma IP pública, así que
 * cinco candidatos que se postulan desde el celular en la misma hora pueden
 * parecer uno insistiendo. Contar por IP MÁS huella del archivo separa los dos
 * casos: la misma persona reenviando su misma hoja de vida repite huella, y dos
 * candidatos distintos detrás de la misma IP no.
 *
 * QUÉ ENTRA EN LA HUELLA: el nombre saneado, el tamaño exacto y los primeros
 * kilobytes del archivo. No el archivo entero: dos hojas de vida distintas no
 * coinciden en esos tres a la vez, y hashear 4 MB en cada petición sería pagar
 * por una certeza que no hace falta.
 *
 * NO ES UN IDENTIFICADOR DE PERSONA y no se guarda en ningún sitio: vive lo que
 * dura la petición, se usa como parte de una clave de contador que caduca sola
 * y nunca viaja al navegador ni al correo. Del hash no se puede sacar el nombre
 * ni el contenido de la hoja de vida.
 */
import type { HojaDeVidaValidada } from './postulacion';

/** Cuántos bytes del principio del archivo entran en el hash. */
const BYTES_MUESTRA = 4096;

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Doce caracteres hexadecimales. Bastan: esto no protege un secreto, solo
 * reparte envíos en cubos de un contador que se vacía cada diez minutos.
 */
export async function huellaHojaDeVida(hojaDeVida: HojaDeVidaValidada): Promise<string> {
  const muestra = hojaDeVida.bytes.subarray(0, BYTES_MUESTRA);
  const cabecera = new TextEncoder().encode(
    `${hojaDeVida.nombreSeguro}|${hojaDeVida.tamano}|`,
  );

  const entrada = new Uint8Array(cabecera.length + muestra.length);
  entrada.set(cabecera, 0);
  entrada.set(muestra, cabecera.length);

  const resumen = await crypto.subtle.digest('SHA-256', entrada);
  return hex(resumen).slice(0, 12);
}

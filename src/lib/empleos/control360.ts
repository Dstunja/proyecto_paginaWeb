// CONTROL360 — envía cada postulación a la bandeja de Talento Humano de Control360, firmada.
//
// Por qué existe: hasta hoy las hojas de vida solo llegaban al correo de Gestión Humana y no
//   quedaban en ningún sistema. Con esto entran también a Control360, donde RRHH las gestiona.
// Dónde corre: función de servidor de Vercel (Node), llamada desde src/lib/empleos/postular.ts.
// Cuidados:
//   - APAGADO por defecto: si faltan C360_POSTULACIONES_URL o C360_POSTULACIONES_SECRET, no envía
//     nada y la página funciona exactamente como antes.
//   - NUNCA reemplaza al correo: corre en paralelo y nunca lanza. Si Control360 falla o tarda más
//     de ESPERA_MS, el correo llega igual y la persona no se entera.
//   - La firma es la que exige la ruta de Control360 (src/features/talento/postulaciones/firma.ts
//     allá): HMAC-SHA256 en hexadecimal de `${timestamp}.` seguido de los bytes del cuerpo, con el
//     timestamp en SEGUNDOS. El archivo viaja dentro del JSON, así que la firma lo cubre.
//   - El secreto es por empresa y no se escribe nunca en el código ni en los registros.

import { createHmac, randomUUID } from 'node:crypto';
import type { Entorno } from '../pqrs/config';
import { AUTORIZACION_VERSION } from './autorizacion';
import type { PostulacionValidada } from './postulacion';

export const CABECERA_TIMESTAMP = 'x-c360-timestamp';
export const CABECERA_FIRMA = 'x-c360-firma';

/** Cuánto se espera a Control360 antes de rendirse. El correo no espera por esto. */
export const ESPERA_MS = 8000;

export interface ConfigControl360 {
  url: string;
  secreto: string;
}

/** La configuración, o null si falta cualquiera de las dos variables (envío apagado). */
export function configControl360(env: Entorno): ConfigControl360 | null {
  const url = env.C360_POSTULACIONES_URL?.trim();
  const secreto = env.C360_POSTULACIONES_SECRET?.trim();
  if (!url || !secreto) return null;
  return { url, secreto };
}

/**
 * El cuerpo JSON, con los nombres de campo que lee Control360 (cuerpo.ts allá).
 *
 * Teléfono y experiencia vacíos van como null: Control360 los valida solo si vienen.
 * La autorización va como booleano de verdad; la cadena "true" se rechaza allá.
 * `vacanteSlug` y `respuestas` (el filtro de la vacante) van SOLO cuando la vacante
 * tiene preguntas: sin ellos Control360 deja la postulación SIN FILTRO, que es lo
 * que corresponde a una espontánea o a una vacante sin preguntas.
 */
export function cuerpoParaControl360(datos: PostulacionValidada, envioId: string): string {
  const filtro = datos.respuestas
    ? {
        vacanteSlug: datos.vacanteSlug ?? null,
        respuestas: datos.respuestas.map((r) => ({
          id: r.id,
          texto_pregunta: r.texto_pregunta,
          respuesta: r.respuesta,
        })),
      }
    : {};
  return JSON.stringify({
    envioId,
    nombre: datos.nombre,
    correo: datos.correo,
    telefono: datos.telefono.trim() || null,
    cargo: datos.cargo,
    experiencia: datos.experiencia.trim() || null,
    autorizacion: true,
    autorizacionVersion: AUTORIZACION_VERSION,
    ...filtro,
    archivo: {
      nombre: datos.hojaDeVida.nombreOriginal,
      base64: Buffer.from(datos.hojaDeVida.bytes).toString('base64'),
    },
  });
}

/** HMAC-SHA256 hexadecimal de `${timestamp}.` + cuerpo, como lo verifica Control360. */
export function firmar(secreto: string, timestamp: string, cuerpo: string): string {
  const h = createHmac('sha256', secreto);
  h.update(`${timestamp}.`, 'utf8');
  h.update(cuerpo, 'utf8');
  return h.digest('hex');
}

export type ResultadoControl360 =
  | { resultado: 'apagado' }
  | { resultado: 'aceptada'; estado: number }
  | { resultado: 'rechazada'; estado: number }
  | { resultado: 'error'; detalle: string };

/**
 * Envía la postulación. Nunca lanza: cualquier fallo vuelve como resultado.
 *
 * `envioId` es la llave de idempotencia de Control360: si esta misma petición se reintentara,
 * allá no se crea una segunda fila. Uno nuevo por postulación.
 */
export async function enviarAControl360(
  datos: PostulacionValidada,
  env: Entorno,
  opciones: { fetchImpl?: typeof fetch; ahoraSeg?: number; envioId?: string; esperaMs?: number } = {},
): Promise<ResultadoControl360> {
  const config = configControl360(env);
  if (!config) return { resultado: 'apagado' };

  const envioId = opciones.envioId ?? randomUUID();
  const timestamp = String(opciones.ahoraSeg ?? Math.floor(Date.now() / 1000));
  const cuerpo = cuerpoParaControl360(datos, envioId);
  const firma = firmar(config.secreto, timestamp, cuerpo);

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), opciones.esperaMs ?? ESPERA_MS);
  try {
    const respuesta = await (opciones.fetchImpl ?? fetch)(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CABECERA_TIMESTAMP]: timestamp,
        [CABECERA_FIRMA]: firma,
      },
      body: cuerpo,
      signal: control.signal,
    });
    return respuesta.ok
      ? { resultado: 'aceptada', estado: respuesta.status }
      : { resultado: 'rechazada', estado: respuesta.status };
  } catch (e) {
    const detalle = e instanceof Error && e.name === 'AbortError' ? 'tiempo-agotado' : 'red';
    return { resultado: 'error', detalle };
  } finally {
    clearTimeout(reloj);
  }
}

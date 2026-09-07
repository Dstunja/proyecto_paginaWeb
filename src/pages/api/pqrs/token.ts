/**
 * POST /api/pqrs/token — permiso para subir un soporte directamente al Blob.
 *
 * POR QUÉ NO SE SUBE POR AQUÍ. Una función de Vercel rechaza cuerpos de más de
 * 4,5 MB, y el tope por archivo es 5 MB: un PDF grande nunca llegaría. Así que
 * el archivo va del navegador a Vercel Blob sin pasar por la función, y lo
 * único que hace este endpoint es firmar un permiso acotado (`handleUpload`).
 *
 * El permiso que se firma restringe tipo de contenido, tamaño y ruta. Aun así,
 * el `Content-Type` que valida Blob es el que declara el navegador: la
 * comprobación seria (bytes mágicos) la hace /api/pqrs al descargar el blob.
 * Este token es la primera puerta, no la única.
 */
import type { APIRoute } from 'astro';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  MIME_PERMITIDOS,
  esSessionIdValido,
  maxBytes,
  prefijoSesion,
  type Entorno,
} from '../../../lib/pqrs/config';
import { limitar } from '../../../lib/pqrs/limite-tasa';
import { ipDePeticion } from '../../../lib/pqrs/solicitud';
import { verificarTurnstile } from '../../../lib/pqrs/turnstile';
import { requiereSoporte } from '../../../lib/adjuntos';

export const prerender = false;

/** Datos que el navegador manda en `clientPayload`, como JSON. */
interface CargaCliente {
  sessionId?: unknown;
  tipo?: unknown;
  turnstileToken?: unknown;
}

const LIMITE = { maximo: 20, ventanaSegundos: 600, prefijo: 'pqrs:token' };

function json(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const env = process.env as Entorno;
  const ip = ipDePeticion(request.headers);

  const veredicto = await limitar(ip, LIMITE, env);
  if (!veredicto.ok) {
    return json(429, {
      ok: false,
      errores: ['Demasiadas subidas seguidas. Espera un momento e inténtalo de nuevo.'],
    });
  }

  let cuerpo: HandleUploadBody;
  try {
    cuerpo = (await request.json()) as HandleUploadBody;
  } catch {
    return json(400, { ok: false, errores: ['El cuerpo de la petición no es JSON válido.'] });
  }

  try {
    const respuesta = await handleUpload({
      request,
      body: cuerpo,
      token: env.BLOB_READ_WRITE_TOKEN,

      onBeforeGenerateToken: async (pathname, cargaBruta) => {
        let carga: CargaCliente = {};
        try {
          carga = cargaBruta ? (JSON.parse(cargaBruta) as CargaCliente) : {};
        } catch {
          throw new Error('Los datos de la subida no son válidos.');
        }

        const sessionId = typeof carga.sessionId === 'string' ? carga.sessionId : '';
        const tipo = typeof carga.tipo === 'string' ? carga.tipo : '';
        const turnstileToken =
          typeof carga.turnstileToken === 'string' ? carga.turnstileToken : '';

        if (!esSessionIdValido(sessionId)) {
          throw new Error('La sesión de subida no es válida.');
        }

        // Solo Queja y Reclamo llevan soporte. Sin esta línea alguien podría
        // usar el store como alojamiento gratuito radicando "Felicitaciones".
        if (!requiereSoporte(tipo)) {
          throw new Error('Este tipo de solicitud no admite archivos de soporte.');
        }

        const antirrobots = await verificarTurnstile(turnstileToken, ip, env);
        if (!antirrobots.ok) {
          throw new Error(antirrobots.error ?? 'La comprobación antirrobots no pasó.');
        }

        // La ruta la impone el servidor. `pathname` viene del navegador y no se
        // usa para construirla: solo se comprueba que pidió su propia carpeta.
        if (!pathname.startsWith(prefijoSesion(sessionId))) {
          throw new Error('La ruta de subida no corresponde a esta sesión.');
        }

        return {
          allowedContentTypes: [...MIME_PERMITIDOS],
          maximumSizeInBytes: maxBytes(env),
          // El navegador ya pone un UUID en el nombre; un sufijo extra rompería
          // la correspondencia con lo que luego anuncia en /api/pqrs.
          addRandomSuffix: false,
          allowOverwrite: false,
          // Media hora es de sobra para subir 5 MB y corta la ventana en la que
          // un token robado sirve para algo.
          validUntil: Date.now() + 30 * 60 * 1000,
          tokenPayload: JSON.stringify({ sessionId }),
        };
      },

      onUploadCompleted: async () => {
        // No hace falta nada: /api/pqrs valida y mueve los blobs al radicar, y
        // el cron borra lo que se quede sin radicar. Vercel exige que la
        // callback exista aunque no haga trabajo.
      },
    });

    return json(200, respuesta);
  } catch (fallo) {
    // handleUpload lanza con el mensaje de onBeforeGenerateToken, que ya está
    // redactado en español y es apto para mostrar.
    return json(400, { ok: false, errores: [(fallo as Error).message] });
  }
};

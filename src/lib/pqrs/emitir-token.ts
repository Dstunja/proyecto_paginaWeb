/**
 * El trabajo de POST /api/pqrs/token, separado del endpoint para poder
 * probarlo. Mismo reparto que `radicar.ts`: aquí la lógica, allí el envoltorio.
 *
 * QUÉ FIRMA. Un permiso acotado para que el navegador suba UN archivo
 * directamente a Vercel Blob. El archivo no pasa por la función porque una
 * función de Vercel rechaza cuerpos de más de 4,5 MB y el tope por archivo es
 * 5 MB.
 *
 * POR QUÉ SE COMPRUEBA EL ENTORNO ANTES DE `handleUpload`. Porque `handleUpload`
 * resuelve `BLOB_READ_WRITE_TOKEN` en su PRIMERA línea, antes de llamar a
 * `onBeforeGenerateToken`. Si la variable falta, lanza ahí mismo y ninguna de
 * las comprobaciones de abajo llega a ejecutarse: el error que salía era un 400
 * con el texto en inglés del SDK, indistinguible de "no eres humano". Con el
 * chequeo delante, la falta de configuración se responde como lo que es, un 500.
 *
 * ORDEN DE LAS COMPROBACIONES. Primero la configuración (500), luego el límite
 * de tasa, después lo barato y local —forma del cuerpo, sesión, ruta, tipo de
 * PQRS, extensión— y Turnstile AL FINAL, que es la única que gasta una llamada
 * de red. Ese orden no es solo por coste: permite que el formulario repregunte
 * con un token de Turnstile vacío para leer el error real sin quemar un token
 * bueno, porque todo lo demás ya se ha decidido antes.
 */
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { EXTENSION_A_MIME, extensionDe, requiereSoporte } from '../adjuntos';
import {
  MIME_PERMITIDOS,
  esSessionIdValido,
  maxBytes,
  prefijoSesion,
  type Entorno,
} from './config';
import { fallo, type CodigoError, type Respuesta } from './errores';
import { limitar } from './limite-tasa';
import { ipDePeticion } from './solicitud';
import { verificarTurnstile } from './turnstile';

/** Datos que el navegador manda en `clientPayload`, como JSON. */
interface CargaCliente {
  sessionId?: unknown;
  tipo?: unknown;
  turnstileToken?: unknown;
}

const LIMITE = { maximo: 20, ventanaSegundos: 600, prefijo: 'pqrs:token' };

/**
 * Variables sin las que este endpoint no puede trabajar.
 *
 * `TURNSTILE_SECRET` está aquí a propósito, y no se deja pasar cuando falta:
 * publicar un formulario de subida sin antirrobots es la forma habitual de
 * acabar pagando un store lleno de basura sin enterarse.
 */
export const VARIABLES_REQUERIDAS = ['BLOB_READ_WRITE_TOKEN', 'TURNSTILE_SECRET'] as const;

/** Las que faltan, por nombre. Nunca se devuelven sus valores. */
export function variablesQueFaltan(env: Entorno): string[] {
  return VARIABLES_REQUERIDAS.filter((nombre) => {
    const valor = env[nombre];
    return typeof valor !== 'string' || valor.trim() === '';
  });
}

/**
 * Error que sabe con qué código HTTP debe salir.
 *
 * `handleUpload` solo deja comunicarse con el exterior lanzando, así que
 * `onBeforeGenerateToken` lanza esto y el `catch` de abajo lo traduce. Un error
 * que no sea de esta clase viene del SDK y se trata como cuerpo inválido.
 */
class ErrorConCodigo extends Error {
  constructor(readonly codigo: CodigoError) {
    super(codigo);
    this.name = 'ErrorConCodigo';
  }
}

export async function emitirToken(peticion: Request, env: Entorno): Promise<Respuesta> {
  // --- 1. Configuración del servidor ---------------------------------------
  const faltan = variablesQueFaltan(env);
  if (faltan.length > 0) {
    // Al registro de Vercel van los NOMBRES, que es lo que hace falta para
    // arreglarlo; los valores no se tocan ni para registrarlos.
    console.error(
      `[pqrs/token] configuración incompleta: faltan ${faltan.join(', ')}. ` +
        'Conecta el Blob store en Vercel (Storage > Blob) y define el secreto de Turnstile.',
    );
    return fallo('config-incompleta');
  }

  const ip = ipDePeticion(peticion.headers);

  // --- 2. Límite de tasa ----------------------------------------------------
  const veredicto = await limitar(ip, LIMITE, env);
  if (!veredicto.ok) return fallo('demasiadas-peticiones');

  // --- 3. Cuerpo ------------------------------------------------------------
  let cuerpo: HandleUploadBody;
  try {
    cuerpo = (await peticion.json()) as HandleUploadBody;
  } catch {
    return fallo('cuerpo-invalido');
  }

  try {
    const respuesta = await handleUpload({
      request: peticion,
      body: cuerpo,
      token: env.BLOB_READ_WRITE_TOKEN,

      onBeforeGenerateToken: async (pathname, cargaBruta) => {
        let carga: CargaCliente = {};
        try {
          carga = cargaBruta ? (JSON.parse(cargaBruta) as CargaCliente) : {};
        } catch {
          throw new ErrorConCodigo('cuerpo-invalido');
        }

        const sessionId = typeof carga.sessionId === 'string' ? carga.sessionId : '';
        const tipo = typeof carga.tipo === 'string' ? carga.tipo : '';
        const turnstileToken =
          typeof carga.turnstileToken === 'string' ? carga.turnstileToken : '';

        if (!esSessionIdValido(sessionId)) throw new ErrorConCodigo('sesion-invalida');

        // La ruta la impone el servidor. `pathname` viene del navegador y no se
        // usa para construirla: solo se comprueba que pidió su propia carpeta.
        if (!pathname.startsWith(prefijoSesion(sessionId))) {
          throw new ErrorConCodigo('ruta-ajena');
        }

        // Solo Queja y Reclamo llevan soporte. Sin esta línea alguien podría
        // usar el store como alojamiento gratuito radicando "Felicitaciones".
        if (!requiereSoporte(tipo)) throw new ErrorConCodigo('tipo-sin-soporte');

        // La extensión de la ruta tiene que ser una de las aceptadas. Filtra
        // pero no demuestra nada —el nombre lo pone quien sube—: la comprobación
        // seria (bytes mágicos) la hace /api/pqrs al descargar el blob.
        if (!EXTENSION_A_MIME[extensionDe(pathname)]) {
          throw new ErrorConCodigo('archivo-no-permitido');
        }

        // Lo último: es la única comprobación que sale a la red.
        const antirrobots = await verificarTurnstile(turnstileToken, ip, env);
        if (!antirrobots.ok) {
          console.warn(`[pqrs/token] Turnstile rechazó: ${(antirrobots.codigos ?? []).join(', ')}`);
          throw new ErrorConCodigo('antirrobots');
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

    return { estado: 200, cuerpo: respuesta };
  } catch (error) {
    if (error instanceof ErrorConCodigo) return fallo(error.codigo);

    // Cualquier otra cosa la lanzó el SDK (un evento que no reconoce, un token
    // con formato imposible). El detalle va al registro, no a la respuesta.
    console.error('[pqrs/token] fallo inesperado:', (error as Error).message);
    return fallo('cuerpo-invalido');
  }
}

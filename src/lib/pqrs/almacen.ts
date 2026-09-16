/**
 * Todo lo que este proyecto hace contra Vercel Blob, en un solo módulo.
 *
 * Los endpoints no importan `@vercel/blob` directamente: llaman aquí. Eso
 * mantiene el `access` y el token en un único sitio y, sobre todo, deja que las
 * pruebas simulen el almacenamiento sustituyendo este módulo entero en vez de
 * remedar la superficie completa del SDK.
 *
 * EL STORE ES PRIVADO (pqrs-adjuntos) y todo se crea y se lee con
 * `access: 'private'`: un blob privado no se puede abrir con su URL a secas.
 * La única forma de leerlo desde fuera es una URL firmada con caducidad
 * (`enlaceFirmado`), y el correo al área ni siquiera lleva esa: lleva un enlace a
 * /api/pqrs/descarga, que la genera en el momento (ver ./descarga.ts).
 */
import { copy, del, get, head, list, put } from '@vercel/blob';
import { issueSignedToken, presignUrl } from '@vercel/blob';
import { ACCESO_BLOB, type Entorno } from './config';

function opciones(env: Entorno) {
  return {
    access: ACCESO_BLOB,
    token: env.BLOB_READ_WRITE_TOKEN,
  } as const;
}

export interface DatosBlob {
  pathname: string;
  url: string;
  tamano: number;
  subidoEn: Date;
}

/** Metadatos sin descargar el contenido. Sirve para rechazar por peso antes. */
export async function metadatos(pathname: string, env: Entorno): Promise<DatosBlob | null> {
  try {
    const info = await head(pathname, { token: env.BLOB_READ_WRITE_TOKEN });
    return {
      pathname: info.pathname,
      url: info.url,
      tamano: info.size,
      subidoEn: info.uploadedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Baja el contenido completo a memoria.
 *
 * Se permite porque el tope por archivo son 5 MB y como mucho hay 3: unos 15 MB
 * en el peor caso, holgado para una función de Vercel. Quien suba el límite muy
 * por encima tendrá que pasar a validar por trozos.
 */
export async function descargar(pathname: string, env: Entorno): Promise<Uint8Array | null> {
  const resultado = await get(pathname, { ...opciones(env), useCache: false });
  if (!resultado || resultado.statusCode !== 200) return null;
  const buffer = await new Response(resultado.stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Mueve un blob: copiar y borrar.
 *
 * Vercel Blob tiene `rename`, pero se hace en dos pasos a propósito: si el
 * borrado falla, el archivo ya está en su sitio definitivo y lo único que queda
 * es un pendiente que el cron recogerá en 24 horas. Al revés se perdería.
 */
export async function mover(desde: string, hasta: string, env: Entorno): Promise<string> {
  const copiado = await copy(desde, hasta, opciones(env));
  try {
    await del(desde, { token: env.BLOB_READ_WRITE_TOKEN });
  } catch {
    // Se ignora: el cron de limpieza se encargará del pendiente huérfano.
  }
  return copiado.url;
}

/** Guarda el registro de la radicación. */
export async function guardarJson(
  pathname: string,
  contenido: unknown,
  env: Entorno,
): Promise<string> {
  const resultado = await put(pathname, JSON.stringify(contenido, null, 2), {
    ...opciones(env),
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false,
  });
  return resultado.url;
}

/** Borra rutas concretas. Nunca lanza: se usa en caminos de limpieza. */
export async function borrar(rutas: string[], env: Entorno): Promise<void> {
  if (rutas.length === 0) return;
  try {
    await del(rutas, { token: env.BLOB_READ_WRITE_TOKEN });
  } catch {
    // Sin efecto: si el borrado falla, el cron vuelve a intentarlo.
  }
}

/** Lista lo que hay bajo un prefijo. */
export async function listar(prefijo: string, env: Entorno): Promise<DatosBlob[]> {
  const salida: DatosBlob[] = [];
  let cursor: string | undefined;
  do {
    const pagina = await list({
      prefix: prefijo,
      cursor,
      limit: 1000,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    for (const blob of pagina.blobs) {
      salida.push({
        pathname: blob.pathname,
        url: blob.url,
        tamano: blob.size,
        subidoEn: blob.uploadedAt,
      });
    }
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  return salida;
}

/**
 * Borra todos los pendientes de una sesión.
 *
 * Nunca lanza: se usa en caminos de error (Turnstile rechazado, adjunto
 * inválido) y un fallo del almacén ahí no puede tapar el motivo real con un 500.
 */
export async function borrarSesion(prefijo: string, env: Entorno): Promise<number> {
  try {
    const blobs = await listar(prefijo, env);
    await borrar(
      blobs.map((b) => b.pathname),
      env,
    );
    return blobs.length;
  } catch {
    return 0;
  }
}

/**
 * URL firmada y con caducidad para LEER un blob privado.
 *
 * La usa /api/pqrs/descarga con una vida de pocos minutos, justo antes de
 * redirigir a quien pulsó el enlace del correo. No se mete directamente en el
 * correo: así la duración del enlace del correo no depende del máximo que
 * acepte Vercel para una URL firmada.
 */
export async function enlaceFirmado(
  pathname: string,
  minutos: number,
  env: Entorno,
): Promise<string> {
  const validUntil = Date.now() + minutos * 60 * 1000;
  const firmado = await issueSignedToken({
    pathname,
    operations: ['get'],
    validUntil,
    token: env.BLOB_READ_WRITE_TOKEN,
  });
  const { presignedUrl } = await presignUrl(firmado, {
    operation: 'get',
    pathname,
    validUntil,
    access: ACCESO_BLOB,
  });
  return presignedUrl;
}

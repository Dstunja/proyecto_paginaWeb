/**
 * Enlaces de descarga de los soportes de una PQRS, para el correo al área.
 *
 * EL PROBLEMA. El store es privado: un blob no se abre con su URL a secas. La
 * forma que da Vercel es una URL firmada con caducidad, pero el correo tiene
 * que servir durante días y la duración máxima de esas URLs la decide Vercel.
 * Si se metiera en el correo una firma de 7 días y Vercel admitiera menos, el
 * enlace dejaría de funcionar sin que nadie se enterase.
 *
 * LA SOLUCIÓN, en dos pasos:
 *   1. El correo lleva un enlace a NUESTRA función,
 *      /api/pqrs/descarga?ruta=…&vence=…&firma=…, firmado con HMAC-SHA256 y
 *      válido 7 días (`MINUTOS_ENLACE_DESCARGA`).
 *   2. Al pulsarlo, la función comprueba la firma, la caducidad y que la ruta
 *      sea un soporte radicado, y redirige (302) a una URL firmada de Blob que
 *      dura 5 minutos (`MINUTOS_ENLACE_BLOB`). El archivo no pasa por la
 *      función, así que su peso no choca con el límite de respuesta de Vercel.
 *
 * LA CLAVE DE LA FIRMA se deriva de `BLOB_READ_WRITE_TOKEN`: no hace falta
 * ninguna variable nueva, y quien no tiene el token del store no puede fabricar
 * un enlace. Si el token se rota, los enlaces ya enviados dejan de valer, que es
 * lo razonable: el token es justo lo que da acceso a los archivos.
 *
 * QUÉ SE PUEDE DESCARGAR. Solo soportes ya radicados: `pqrs/{radicado}/{uuid}.{ext}`.
 * Ni `solicitud.json` (el registro con todos los datos personales), ni los
 * pendientes, ni nada fuera de `pqrs/`. La forma se comprueba ANTES que la firma.
 */
import * as almacen from './almacen';
import {
  MINUTOS_ENLACE_BLOB,
  blobConfigurado,
  type Entorno,
} from './config';
import { ALFABETO } from './radicado';

/** Ruta pública de la función. En Vercel el sitio cuelga de la raíz. */
export const RUTA_DESCARGA = '/api/pqrs/descarga';

/** Un soporte radicado: pqrs/PQRS-20260907-A7K2M9/<uuid>.<ext>. Nada más. */
const FORMA_RUTA = new RegExp(
  `^pqrs/PQRS-\\d{8}-[${ALFABETO}]{6}/` +
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' +
    '\\.(pdf|doc|docx|jpg|jpeg|png)$',
);

export function esRutaDescargable(ruta: string): boolean {
  return FORMA_RUTA.test(ruta);
}

const codificador = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(clave: Uint8Array<ArrayBuffer> | ArrayBuffer, mensaje: string): Promise<ArrayBuffer> {
  const llave = await crypto.subtle.importKey(
    'raw',
    clave,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', llave, codificador.encode(mensaje));
}

/**
 * Firma de un enlace. Clave derivada: HMAC(token del store, "pqrs-descarga-v1").
 * Derivarla, en vez de usar el token tal cual, evita que una firma sirva para
 * cualquier otro uso que algún día se haga del mismo token.
 */
export async function firmar(ruta: string, vence: number, env: Entorno): Promise<string> {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() ?? '';
  const derivada = await hmac(codificador.encode(token), 'pqrs-descarga-v1');
  return hex(await hmac(derivada, `${ruta}\n${vence}`));
}

/** Compara dos cadenas sin cortar en la primera diferencia. */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

/**
 * Enlace absoluto para el correo.
 *
 * @param origen  origen del sitio que atendió la radicación (por ejemplo
 *                https://paginaweb-beta-coral.vercel.app). Sale de la petición:
 *                así el enlace apunta al mismo despliegue que radicó.
 * @param vence   milisegundos desde epoch.
 */
export async function enlaceDescarga(
  origen: string,
  ruta: string,
  vence: number,
  env: Entorno,
): Promise<string> {
  const firma = await firmar(ruta, vence, env);
  const parametros = new URLSearchParams({ ruta, vence: String(vence), firma });
  return `${origen}${RUTA_DESCARGA}?${parametros.toString()}`;
}

// --- La función ----------------------------------------------------------------

function pagina(estado: number, titulo: string, texto: string): Response {
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title></head>
<body style="font-family:Segoe UI,system-ui,sans-serif;color:#263238;max-width:36rem;margin:12vh auto;padding:0 1.25rem;line-height:1.6">
<h1 style="color:#0d2c84;font-size:1.4rem">${titulo}</h1><p>${texto}</p>
<p style="color:#5f6b73;font-size:.9rem">Distribuciones Santiago de Tunja S.A.S.</p>
</body></html>`;
  return new Response(html, {
    status: estado,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

/**
 * GET /api/pqrs/descarga. Devuelve siempre una `Response`: una redirección a
 * la URL firmada de Blob o una página corta que explica por qué no.
 */
export async function atenderDescarga(peticion: Request, env: Entorno): Promise<Response> {
  if (!blobConfigurado(env)) {
    console.error('[pqrs/descarga] falta BLOB_READ_WRITE_TOKEN.');
    return pagina(
      503,
      'Descarga no disponible',
      'El almacenamiento de los soportes no está configurado. Avisa al administrador del sitio.',
    );
  }

  const parametros = new URL(peticion.url).searchParams;
  const ruta = parametros.get('ruta') ?? '';
  const venceTexto = parametros.get('vence') ?? '';
  const firma = parametros.get('firma') ?? '';
  const vence = Number(venceTexto);

  if (!esRutaDescargable(ruta) || !/^\d{13}$/.test(venceTexto) || !/^[0-9a-f]{64}$/.test(firma)) {
    return pagina(400, 'Enlace no válido', 'El enlace de descarga está incompleto o mal copiado.');
  }

  const esperada = await firmar(ruta, vence, env);
  if (!igualesEnTiempoConstante(firma, esperada)) {
    return pagina(403, 'Enlace no válido', 'El enlace de descarga no es válido.');
  }

  if (Date.now() > vence) {
    return pagina(
      410,
      'Enlace caducado',
      'Este enlace de descarga ya caducó. El archivo sigue guardado en el almacenamiento del proyecto en Vercel (Storage › pqrs-adjuntos), en la carpeta del radicado.',
    );
  }

  const info = await almacen.metadatos(ruta, env);
  if (!info) {
    return pagina(404, 'Archivo no encontrado', 'No encontramos ese archivo en el almacenamiento.');
  }

  try {
    const minutos = Math.max(1, Math.min(MINUTOS_ENLACE_BLOB, Math.floor((vence - Date.now()) / 60_000)));
    const destino = await almacen.enlaceFirmado(ruta, minutos, env);
    return new Response(null, {
      status: 302,
      headers: {
        location: destino,
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      },
    });
  } catch (fallo) {
    console.error('[pqrs/descarga] no se pudo firmar la URL de Blob:', (fallo as Error).message);
    return pagina(
      502,
      'No pudimos preparar la descarga',
      'Inténtalo de nuevo en unos minutos. Si sigue fallando, el archivo está en el almacenamiento del proyecto en Vercel.',
    );
  }
}

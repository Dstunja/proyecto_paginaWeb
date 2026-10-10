/**
 * El webhook de Control360: "cambió algo en las vacantes, regenera ya".
 *
 * QUIÉN LO LLAMA. Control360, justo después de que Talento Humano publica,
 * cierra, edita, reordena o cambia el flyer de una vacante (ver
 * avisar-sitios.ts en Control360). Manda `POST /api/empleos/revalidar` con
 * `Authorization: Bearer <EMPLEOS_WEBHOOK_SECRET>` y `{ "slugs": [...] }`.
 *
 * QUÉ HACE. Pide de nuevo, a su propio dominio y con la cabecera
 * `x-prerender-revalidate: <ISR_BYPASS_TOKEN>`, cada ruta que muestra esas
 * vacantes. Vercel regenera la página en ese momento y deja la copia nueva en
 * la caché para todos (revalidación bajo demanda de ISR). Se regeneran:
 *   - /empleos/ (las tarjetas y el <select> del formulario),
 *   - /api/empleos/vacantes.json,
 *   - /sitemap-empleos.xml (lo que ven los buscadores),
 *   - /empleos/<slug>/ de cada slug recibido, TAMBIÉN de los cerrados: así el
 *     enlace viejo pasa a "Esta vacante ya se cerró" sin esperar 5 minutos.
 *
 * SEGURIDAD. El secreto se compara en tiempo constante (sobre sus resúmenes
 * SHA-256, para no filtrar ni el largo) y nunca se escribe en respuestas ni en
 * logs. El cuerpo tiene tope de tamaño y los slugs pasan por el mismo filtro de
 * forma que las URLs; un slug raro se descarta, no se pide.
 *
 * Todo lo de aquí es puro (sin red ni entorno) salvo `revalidarRutas`, que
 * recibe `fetch` como parámetro para poder probarse.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

/** Tope del cuerpo del webhook: sobra para 50 slugs. */
export const MAX_BYTES_CUERPO = 8 * 1024;

/** Cuántos slugs se aceptan en un aviso (los demás se ignoran). */
export const MAX_SLUGS = 50;

/** Cuánto se espera cada regeneración antes de darla por fallida. */
export const TIEMPO_REVALIDAR_MS = 8_000;

/** Mismo alfabeto que las URLs /empleos/<slug>/ y que exige Control360. */
const FORMA_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LARGO_MAXIMO_SLUG = 100;

/** Rutas que se regeneran siempre, cambie la vacante que cambie. */
export const RUTAS_SIEMPRE = ['/empleos/', '/api/empleos/vacantes.json', '/sitemap-empleos.xml'] as const;

const resumen = (texto: string): Buffer => createHash('sha256').update(texto, 'utf8').digest();

/**
 * ¿El encabezado `Authorization` trae `Bearer <secreto>`? Un secreto vacío o sin
 * configurar NUNCA abre la puerta.
 */
export function secretoValido(autorizacion: string | null | undefined, secreto: string | null | undefined): boolean {
  const esperado = String(secreto ?? '').trim();
  const cabecera = String(autorizacion ?? '');
  if (!esperado || !/^Bearer\s+/i.test(cabecera)) return false;
  const recibido = cabecera.replace(/^Bearer\s+/i, '').trim();
  if (!recibido) return false;
  return timingSafeEqual(resumen(recibido), resumen(esperado));
}

/**
 * Lee `{ slugs?: string[] }`. Cualquier otra forma es un error; los slugs que
 * no tienen forma de slug se descartan uno a uno (no tumban el aviso entero).
 */
export function leerAviso(json: unknown): { ok: true; slugs: string[] } | { ok: false; motivo: string } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { ok: false, motivo: 'El cuerpo debe ser un objeto JSON.' };
  const { slugs } = json as { slugs?: unknown };
  if (slugs === undefined) return { ok: true, slugs: [] };
  if (!Array.isArray(slugs)) return { ok: false, motivo: '"slugs" debe ser una lista.' };
  const limpios = new Set<string>();
  for (const s of slugs) {
    if (typeof s !== 'string') continue;
    const slug = s.trim().toLowerCase();
    if (slug.length <= LARGO_MAXIMO_SLUG && FORMA_SLUG.test(slug)) limpios.add(slug);
    if (limpios.size >= MAX_SLUGS) break;
  }
  return { ok: true, slugs: [...limpios] };
}

/** Las rutas a regenerar para esos slugs, sin repetir y en orden estable. */
export function rutasARevalidar(slugs: readonly string[]): string[] {
  return [...new Set([...RUTAS_SIEMPRE, ...slugs.map((s) => `/empleos/${s}/`)])];
}

/**
 * Lee el cuerpo con tope de tamaño, sin fiarse de `content-length` (puede
 * mentir o no venir). Devuelve null si se pasa del tope.
 */
export async function leerCuerpoAcotado(request: Request, maxBytes = MAX_BYTES_CUERPO): Promise<string | null> {
  const declarado = Number(request.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > maxBytes) return null;
  if (!request.body) return '';
  const lector = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  const todo = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    todo.set(p, i);
    i += p.byteLength;
  }
  return new TextDecoder().decode(todo);
}

export interface RutaRevalidada {
  ruta: string;
  /** Código HTTP de la regeneración, o 0 si no hubo respuesta. */
  estado: number;
}

/**
 * Pide cada ruta a `origen` con `x-prerender-revalidate`. Vercel la regenera y
 * guarda la copia nueva. En paralelo; una que falle no frena a las demás.
 * Un 404 de una vacante cerrada es lo esperado: la página "ya se cerró".
 */
export async function revalidarRutas(opciones: {
  origen: string;
  rutas: readonly string[];
  token: string;
  fetchFn?: typeof fetch;
}): Promise<RutaRevalidada[]> {
  const fetchFn = opciones.fetchFn ?? fetch;
  return Promise.all(
    opciones.rutas.map(async (ruta) => {
      try {
        const r = await fetchFn(new URL(ruta, opciones.origen), {
          method: 'GET',
          headers: { 'x-prerender-revalidate': opciones.token },
          redirect: 'manual',
          cache: 'no-store',
          signal: AbortSignal.timeout(TIEMPO_REVALIDAR_MS),
        });
        // El cuerpo no interesa; se descarta para liberar la conexión.
        await r.body?.cancel().catch(() => {});
        return { ruta, estado: r.status };
      } catch {
        return { ruta, estado: 0 };
      }
    }),
  );
}

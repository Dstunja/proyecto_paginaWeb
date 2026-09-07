/**
 * Límite de peticiones por IP.
 *
 * Hay dos implementaciones y se elige sola:
 *
 * 1. **Upstash Redis** si están `UPSTASH_REDIS_REST_URL` y
 *    `UPSTASH_REDIS_REST_TOKEN`. Es la buena: el contador es compartido por
 *    todas las instancias de la función. Se habla con su API REST por `fetch`,
 *    sin añadir dependencias.
 * 2. **Memoria del proceso** si no lo están. Es un apaño y hay que saberlo:
 *    Vercel arranca una instancia nueva por cada arranque en frío y varias en
 *    paralelo bajo carga, así que el contador se reinicia y se multiplica. Sirve
 *    para frenar un script torpe, NO para frenar un ataque. La cuenta debe
 *    aprovisionar Upstash desde el marketplace de Vercel antes de considerar
 *    esto resuelto (ver docs/PQRS-ADJUNTOS.md).
 */
import type { Entorno } from './config';

export interface Veredicto {
  ok: boolean;
  /** Peticiones que quedan en la ventana actual. */
  restantes: number;
  /** Segundos que faltan para que la ventana se reinicie. */
  segundosEspera: number;
  /** Qué implementación respondió. Se registra para saber si Upstash está activo. */
  motor: 'upstash' | 'memoria';
}

const contadores = new Map<string, { golpes: number; expira: number }>();

/** Evita que el Map crezca sin fin en una instancia de vida larga. */
function purgar(ahora: number) {
  if (contadores.size < 5000) return;
  for (const [clave, valor] of contadores) {
    if (valor.expira <= ahora) contadores.delete(clave);
  }
}

function limitarEnMemoria(clave: string, maximo: number, ventanaSegundos: number): Veredicto {
  const ahora = Date.now();
  purgar(ahora);

  const actual = contadores.get(clave);
  if (!actual || actual.expira <= ahora) {
    contadores.set(clave, { golpes: 1, expira: ahora + ventanaSegundos * 1000 });
    return { ok: true, restantes: maximo - 1, segundosEspera: ventanaSegundos, motor: 'memoria' };
  }

  actual.golpes += 1;
  const segundosEspera = Math.max(1, Math.ceil((actual.expira - ahora) / 1000));
  return {
    ok: actual.golpes <= maximo,
    restantes: Math.max(0, maximo - actual.golpes),
    segundosEspera,
    motor: 'memoria',
  };
}

/**
 * INCR más EXPIRE en una sola ida y vuelta con el endpoint de pipeline.
 *
 * El EXPIRE se manda siempre; en Redis reponer el TTL de una clave que ya lo
 * tiene lo reinicia, así que se pide el TTL de vuelta y se usa el que diga el
 * servidor en vez de suponerlo.
 */
async function limitarEnUpstash(
  clave: string,
  maximo: number,
  ventanaSegundos: number,
  env: Entorno,
  fetchImpl: typeof fetch,
): Promise<Veredicto | null> {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const respuesta = await fetchImpl(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', clave],
        ['EXPIRE', clave, String(ventanaSegundos), 'NX'],
        ['TTL', clave],
      ]),
    });
    if (!respuesta.ok) return null;

    const salida = (await respuesta.json()) as Array<{ result?: number; error?: string }>;
    const golpes = Number(salida[0]?.result ?? 0);
    const ttl = Number(salida[2]?.result ?? ventanaSegundos);
    if (!Number.isFinite(golpes) || golpes <= 0) return null;

    return {
      ok: golpes <= maximo,
      restantes: Math.max(0, maximo - golpes),
      segundosEspera: ttl > 0 ? ttl : ventanaSegundos,
      motor: 'upstash',
    };
  } catch {
    // Si Upstash no contesta se cae a memoria en vez de bloquear la radicación:
    // dejar a la gente sin poder radicar por un fallo del limitador es peor que
    // aceptar un límite flojo durante ese rato.
    return null;
  }
}

export async function limitar(
  identificador: string,
  opciones: { maximo: number; ventanaSegundos: number; prefijo: string },
  env: Entorno,
  fetchImpl: typeof fetch = fetch,
): Promise<Veredicto> {
  const clave = `${opciones.prefijo}:${identificador}`;
  const remoto = await limitarEnUpstash(
    clave,
    opciones.maximo,
    opciones.ventanaSegundos,
    env,
    fetchImpl,
  );
  return remoto ?? limitarEnMemoria(clave, opciones.maximo, opciones.ventanaSegundos);
}

/** Solo para las pruebas: vacía el contador en memoria. */
export function reiniciarMemoria(): void {
  contadores.clear();
}

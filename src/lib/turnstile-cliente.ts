/**
 * Turnstile en el navegador.
 *
 * Un token de Turnstile es de UN SOLO USO y el formulario necesita varios: uno
 * por cada archivo que sube (cada `upload()` llama a /api/pqrs/token) y otro
 * para la radicación en /api/pqrs. Por eso el widget se monta en modo
 * `execution: 'execute'`, que no resuelve nada hasta que se le pide, y
 * `tokenTurnstile()` hace reset y vuelve a ejecutarlo cada vez.
 *
 * Con `appearance: 'interaction-only'` el recuadro solo se ve si Cloudflare
 * decide que hace falta una interacción; en el caso normal la persona no ve
 * nada y el formulario no cambia de aspecto.
 *
 * CUANDO CLOUDFLARE PIDE INTERACCIÓN, EL RELOJ SE PARA. Hubo un tope único de
 * 30 segundos desde que se pedía el token. Si Cloudflare decidía que hacía
 * falta marcar la casilla, ese tope seguía corriendo mientras la persona la
 * buscaba, y al vencer el formulario de Empleos daba el fallo por "no hay
 * función" y abría el `mailto:` SIN llamar a la API: en producción ni Vercel ni
 * Resend registraban nada. Ahora `before-interactive-callback` cambia el tope
 * corto por uno largo y avisa a quien pidió el token (`alPedirInteraccion`),
 * para que la página diga qué hay que hacer.
 *
 * LOS FALLOS LLEVAN MOTIVO (`ErrorTurnstile.motivo`), porque no todos piden lo
 * mismo: si el script de Cloudflare no cargó (un adblock, una red corporativa)
 * no hay forma de pasar la comprobación y lo razonable es el respaldo por
 * correo; si la comprobación falló o caducó, basta con volver a intentarlo.
 */

interface ApiTurnstile {
  render: (
    contenedor: HTMLElement,
    opciones: Record<string, unknown>,
  ) => string | undefined;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: ApiTurnstile;
    /** La llama el script de Cloudflare al terminar de cargar. */
    alTurnstileListo?: () => void;
  }
}

/**
 * Por qué no se obtuvo el token.
 *
 * - `no-cargo`: el script de Cloudflare no cargó o el widget no se montó. No
 *   hay manera de pasar la comprobación desde esta página.
 * - `fallo`: Cloudflare respondió con un error (`codigo` trae el suyo, por
 *   ejemplo 110200 si el dominio no está autorizado en el widget).
 * - `caducado`: la verificación interactiva o el token caducaron.
 * - `tiempo`: no llegó respuesta dentro del tope.
 * - `reemplazado`: se pidió otro token antes de que llegara este.
 */
export type MotivoTurnstile = 'no-cargo' | 'fallo' | 'caducado' | 'tiempo' | 'reemplazado';

export class ErrorTurnstile extends Error {
  constructor(
    readonly motivo: MotivoTurnstile,
    mensaje: string,
    readonly codigo?: string,
  ) {
    super(mensaje);
    this.name = 'ErrorTurnstile';
  }
}

/** Cuánto se espera un token cuando Cloudflare lo resuelve sin interacción. */
const ESPERA_MAXIMA_MS = 30_000;

/**
 * Cuánto se espera, a partir de que aparece la casilla, a que la persona la
 * marque. Cloudflare avisa antes con `timeout-callback` si su propio plazo
 * vence; este tope solo evita un botón en "Enviando…" para siempre si nunca
 * llegara ninguna respuesta.
 */
const ESPERA_INTERACCION_MS = 5 * 60_000;

export interface OpcionesToken {
  /** Se llama cuando Cloudflare enseña la casilla y hay que marcarla. */
  alPedirInteraccion?: () => void;
}

interface Pendiente {
  resolver: (token: string) => void;
  rechazar: (fallo: ErrorTurnstile) => void;
  pedirInteraccion: () => void;
}

let idWidget: string | null = null;
let cargado: Promise<void> | null = null;
let pendiente: Pendiente | null = null;

function resolverPendiente(token: string) {
  const actual = pendiente;
  pendiente = null;
  actual?.resolver(token);
}

function rechazarPendiente(fallo: ErrorTurnstile) {
  const actual = pendiente;
  pendiente = null;
  actual?.rechazar(fallo);
}

/**
 * Monta el widget. Se resuelve cuando Cloudflare ha cargado y el widget existe.
 *
 * Si el script de Cloudflare está bloqueado (un adblock, una red corporativa)
 * la promesa se rechaza con motivo `no-cargo` y quien llama decide: los
 * formularios caen al respaldo por correo en vez de dejar a la persona sin
 * poder escribir.
 */
export function prepararTurnstile(contenedor: HTMLElement, sitekey: string): Promise<void> {
  if (cargado) return cargado;

  cargado = new Promise<void>((resolver, rechazar) => {
    const montar = () => {
      if (!window.turnstile) {
        rechazar(new ErrorTurnstile('no-cargo', 'Turnstile no cargó.'));
        return;
      }
      idWidget =
        window.turnstile.render(contenedor, {
          sitekey,
          execution: 'execute',
          appearance: 'interaction-only',
          language: 'es',
          retry: 'never',
          callback: (token: string) => resolverPendiente(token),
          'before-interactive-callback': () => pendiente?.pedirInteraccion(),
          'error-callback': (codigo?: unknown) => {
            // El código va a la consola: es lo único que dice, por ejemplo,
            // que el dominio no está autorizado en el widget de Cloudflare.
            console.warn('[turnstile] error', codigo);
            rechazarPendiente(
              new ErrorTurnstile('fallo', 'La comprobación antirrobots falló.', String(codigo ?? '')),
            );
            return true;
          },
          'timeout-callback': () =>
            rechazarPendiente(
              new ErrorTurnstile('caducado', 'La verificación de seguridad no se completó a tiempo.'),
            ),
          'expired-callback': () =>
            rechazarPendiente(new ErrorTurnstile('caducado', 'La comprobación antirrobots caducó.')),
        }) ?? null;

      if (idWidget === null) {
        rechazar(new ErrorTurnstile('no-cargo', 'Turnstile no pudo montarse.'));
        return;
      }
      resolver();
    };

    if (window.turnstile) {
      montar();
      return;
    }

    window.alTurnstileListo = montar;

    const script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=alTurnstileListo';
    script.async = true;
    script.defer = true;
    script.addEventListener('error', () =>
      rechazar(new ErrorTurnstile('no-cargo', 'No se pudo cargar Turnstile.')),
    );
    document.head.append(script);
  });

  return cargado;
}

/**
 * Pide un token nuevo. Cada llamada devuelve uno distinto, de un solo uso.
 *
 * Si Cloudflare pide interacción, se llama a `alPedirInteraccion` y la espera
 * pasa del tope corto al largo: el tiempo que tarda la persona en marcar la
 * casilla no cuenta como un fallo.
 */
export function tokenTurnstile(opciones: OpcionesToken = {}): Promise<string> {
  if (!window.turnstile || idWidget === null) {
    return Promise.reject(new ErrorTurnstile('no-cargo', 'Turnstile no está listo.'));
  }

  // Si quedaba una petición sin resolver se descarta: solo hay un widget y no
  // puede atender dos ejecuciones a la vez.
  rechazarPendiente(
    new ErrorTurnstile('reemplazado', 'Se pidió otro token antes de que llegara este.'),
  );

  return new Promise<string>((resolver, rechazar) => {
    const vencer = (mensaje: string) => () =>
      rechazarPendiente(new ErrorTurnstile('tiempo', mensaje));

    let temporizador = setTimeout(
      vencer('La comprobación antirrobots tardó demasiado.'),
      ESPERA_MAXIMA_MS,
    );

    pendiente = {
      resolver: (token) => {
        clearTimeout(temporizador);
        resolver(token);
      },
      rechazar: (fallo) => {
        clearTimeout(temporizador);
        rechazar(fallo);
      },
      pedirInteraccion: () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(
          vencer('La verificación de seguridad no se completó a tiempo.'),
          ESPERA_INTERACCION_MS,
        );
        opciones.alPedirInteraccion?.();
      },
    };

    window.turnstile!.reset(idWidget!);
    window.turnstile!.execute(idWidget!);
  });
}

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

/** Cuánto se espera un token antes de darlo por perdido. */
const ESPERA_MAXIMA_MS = 30_000;

let idWidget: string | null = null;
let cargado: Promise<void> | null = null;
let pendiente: { resolver: (t: string) => void; rechazar: (e: Error) => void } | null = null;

function resolverPendiente(token: string) {
  const actual = pendiente;
  pendiente = null;
  actual?.resolver(token);
}

function rechazarPendiente(mensaje: string) {
  const actual = pendiente;
  pendiente = null;
  actual?.rechazar(new Error(mensaje));
}

/**
 * Monta el widget. Se resuelve cuando Cloudflare ha cargado y el widget existe.
 *
 * Si el script de Cloudflare está bloqueado (un adblock, una red corporativa)
 * la promesa se rechaza y quien llama decide: el formulario cae al respaldo por
 * correo en vez de dejar a la persona sin poder radicar.
 */
export function prepararTurnstile(contenedor: HTMLElement, sitekey: string): Promise<void> {
  if (cargado) return cargado;

  cargado = new Promise<void>((resolver, rechazar) => {
    const montar = () => {
      if (!window.turnstile) {
        rechazar(new Error('Turnstile no cargó.'));
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
          'error-callback': () => {
            rechazarPendiente('La comprobación antirrobots falló.');
            return true;
          },
          'timeout-callback': () => rechazarPendiente('La comprobación antirrobots caducó.'),
          'expired-callback': () => rechazarPendiente('La comprobación antirrobots caducó.'),
        }) ?? null;

      if (idWidget === null) {
        rechazar(new Error('Turnstile no pudo montarse.'));
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
    script.addEventListener('error', () => rechazar(new Error('No se pudo cargar Turnstile.')));
    document.head.append(script);
  });

  return cargado;
}

/** Pide un token nuevo. Cada llamada devuelve uno distinto, de un solo uso. */
export function tokenTurnstile(): Promise<string> {
  if (!window.turnstile || idWidget === null) {
    return Promise.reject(new Error('Turnstile no está listo.'));
  }

  // Si quedaba una petición sin resolver se descarta: solo hay un widget y no
  // puede atender dos ejecuciones a la vez.
  rechazarPendiente('Se pidió otro token antes de que llegara este.');

  return new Promise<string>((resolver, rechazar) => {
    const temporizador = setTimeout(() => {
      rechazarPendiente('La comprobación antirrobots tardó demasiado.');
    }, ESPERA_MAXIMA_MS);

    pendiente = {
      resolver: (token) => {
        clearTimeout(temporizador);
        resolver(token);
      },
      rechazar: (fallo) => {
        clearTimeout(temporizador);
        rechazar(fallo);
      },
    };

    window.turnstile!.reset(idWidget!);
    window.turnstile!.execute(idWidget!);
  });
}

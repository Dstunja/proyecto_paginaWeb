/**
 * Configuración del envío de postulaciones en el servidor.
 *
 * Todo se lee de variables de entorno EN CADA LLAMADA, igual que en
 * src/lib/pqrs/config.ts: así la función recoge un cambio de variable sin
 * recompilar y las pruebas pueden inyectar un entorno distinto.
 *
 * Las dos variables de aquí son opcionales y tienen valor por defecto: el
 * destino sale de `contactoEmpleo` en src/data/vacantes.ts (la misma dirección
 * que se enseña en la página) y el remitente es el de PQRS, que por defecto es
 * `onboarding@resend.dev`.
 *
 * LA CLAVE DE RESEND ES RESEND_API_KEY, no la de PQRS. Son cuentas distintas:
 * con el remitente de pruebas cada cuenta solo entrega a su titular, así que
 * EMPLEOS_DESTINO tiene que ser el correo con el que está registrada la cuenta
 * de esa clave. PQRS usa PQRS_RESEND_API_KEY. El secreto de Turnstile y las
 * variables de Upstash sí son compartidos.
 */
import { contactoEmpleo } from '../../data/vacantes';
import { correoRemitente, type Entorno } from '../pqrs/config';

export type { Entorno };

/** En Astro las rutas de API corren en Node, así que `process.env` existe. */
function entornoActual(): Entorno {
  return typeof process === 'undefined' ? {} : (process.env as Entorno);
}

/**
 * Buzón de Talento Humano. Variable: EMPLEOS_DESTINO (opcional).
 *
 * Por defecto, el correo de selección que ya se publica en /empleos/. Se lee de
 * `contactoEmpleo` y no se escribe aquí a mano: una dirección repetida en dos
 * archivos es una dirección que algún día dejará de coincidir.
 */
export function correoDestinoEmpleos(env: Entorno = entornoActual()): string {
  const valor = env.EMPLEOS_DESTINO?.trim();
  return valor || contactoEmpleo.email;
}

/**
 * Remitente. Variable: EMPLEOS_REMITENTE (opcional).
 *
 * Sin ella se usa el mismo remitente que PQRS: `PQRS_REMITENTE` o, si tampoco
 * está, `onboarding@resend.dev`. Cuando haya un dominio verificado en la cuenta
 * de Resend de Empleos, definir EMPLEOS_REMITENTE con una dirección de ese
 * dominio.
 */
export function correoRemitenteEmpleos(env: Entorno = entornoActual()): string {
  const valor = env.EMPLEOS_REMITENTE?.trim();
  return valor || correoRemitente(env);
}

/** Cinco postulaciones por IP cada diez minutos, como la radicación de PQRS. */
export const LIMITE_POSTULACIONES = { maximo: 5, ventanaSegundos: 600, prefijo: 'empleos:postular' };

/**
 * Nombre del campo trampa (honeypot) del formulario.
 *
 * Está en el HTML pero fuera de la vista y del orden de tabulación: una persona
 * no lo ve y lo deja vacío; un robot que rellena todos los campos lo llena. Si
 * llega con algo, el servidor responde 200 sin enviar nada, para no enseñarle
 * al robot qué campo lo delató.
 */
export const CAMPO_HONEYPOT = 'sitio-web';

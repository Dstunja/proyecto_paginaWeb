/**
 * Configuración del envío de postulaciones en el servidor.
 *
 * Todo se lee de variables de entorno EN CADA LLAMADA, igual que en
 * src/lib/pqrs/config.ts: así la función recoge un cambio de variable sin
 * recompilar y las pruebas pueden inyectar un entorno distinto.
 *
 * NO HACE FALTA NINGUNA VARIABLE NUEVA. Las dos de aquí son opcionales y tienen
 * un valor por defecto que ya funciona: el destino sale de `contactoEmpleo` en
 * src/data/vacantes.ts (la misma dirección que se enseña en la página) y el
 * remitente es el de PQRS, que es el que ya está verificado en Resend. La clave
 * de Resend, el secreto de Turnstile y las de Upstash son las de PQRS.
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
 * Sin ella se usa el mismo remitente que PQRS (`PQRS_REMITENTE` o su valor por
 * defecto). Es a propósito: ese es el dominio que está verificado en Resend, y
 * si los correos de PQRS salen, estos también. Para que el remitente diga
 * «Empleos …», definir EMPLEOS_REMITENTE con una dirección del MISMO dominio.
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

/**
 * Configuración del envío de postulaciones en el servidor.
 *
 * Todo se lee de variables de entorno EN CADA LLAMADA, igual que en
 * src/lib/pqrs/config.ts: así la función recoge un cambio de variable sin
 * recompilar y las pruebas pueden inyectar un entorno distinto.
 *
 * Las dos variables de aquí son opcionales y tienen valor por defecto: el
 * destino sale de `contactoEmpleo` en src/data/vacantes.ts (la misma dirección
 * que se enseña en la página) y el remitente es `onboarding@resend.dev`.
 *
 * LA CLAVE DE RESEND ES RESEND_API_KEY, no la de PQRS. Son cuentas distintas:
 * con el remitente de pruebas cada cuenta solo entrega a su titular, así que
 * EMPLEOS_DESTINO tiene que ser el correo con el que está registrada la cuenta
 * de esa clave. PQRS usa PQRS_RESEND_API_KEY. El secreto de Turnstile y las
 * variables de Upstash sí son compartidos.
 */
import { contactoEmpleo } from '../../data/vacantes';
import {
  REMITENTE_POR_DEFECTO,
  esRemitenteDePrueba,
  type Entorno,
} from '../pqrs/config';

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
 * Por defecto `onboarding@resend.dev`, el remitente de pruebas de Resend.
 *
 * YA NO HEREDA `PQRS_REMITENTE`, y eso fue un arreglo, no un descuido: PQRS y
 * Empleos usan CUENTAS DE RESEND DISTINTAS, y un dominio verificado en la cuenta
 * de PQRS no está verificado en la de Empleos. Heredarlo significaba que el día
 * que PQRS estrenara dominio propio, Empleos empezaría a mandar desde una
 * dirección que su cuenta no puede firmar y TODAS las postulaciones fallarían a
 * la vez.
 *
 * Cuando dstunja.com esté verificado en la cuenta de Resend de Empleos, poner
 * aquí `empleos@dstunja.com`, y SOLO ENTONCES cambiar EMPLEOS_DESTINO al buzón
 * de Talento Humano (ver docs/EMPLEOS-POSTULACION.md).
 */
export function correoRemitenteEmpleos(env: Entorno = entornoActual()): string {
  const valor = env.EMPLEOS_REMITENTE?.trim();
  return valor || REMITENTE_POR_DEFECTO;
}

/**
 * ¿El remitente y el destino son compatibles con la cuenta de Resend?
 *
 * Con el remitente de pruebas (`@resend.dev`) Resend SOLO entrega al titular de
 * la cuenta. Si alguien cambia EMPLEOS_DESTINO al buzón de Talento Humano sin
 * haber cambiado antes EMPLEOS_REMITENTE a un dominio verificado, todas las
 * postulaciones empiezan a fallar. No se puede comprobar desde aquí quién es el
 * titular, pero sí se puede avisar en el registro de que la combinación es la
 * peligrosa.
 */
export function combinacionArriesgada(env: Entorno = entornoActual()): boolean {
  return (
    esRemitenteDePrueba(correoRemitenteEmpleos(env)) &&
    correoDestinoEmpleos(env) !== contactoEmpleo.email
  );
}

/**
 * Límite de postulaciones VERIFICADAS con Upstash puesto: cinco por IP cada diez
 * minutos, como la radicación de PQRS. El contador es compartido entre
 * instancias, así que el tope puede ser ajustado.
 */
export const LIMITE_POSTULACIONES = { maximo: 5, ventanaSegundos: 600, prefijo: 'empleos:postular' };

/**
 * El mismo límite SIN Upstash, que es la situación de hoy en producción.
 *
 * Dos cambios, y los dos por lo mismo: el contador en memoria no sirve para
 * frenar a nadie decidido (se reinicia en cada arranque en frío y se multiplica
 * por instancia), así que lo único que puede hacer es no estorbar a los
 * candidatos de verdad.
 *
 *  - EL TOPE SUBE A VEINTE. Claro, Tigo y Movistar sacan a muchos clientes por
 *    una misma IP pública; con cinco, un grupo de WhatsApp donde se comparte una
 *    vacante deja fuera al sexto que lo intente, y ese error («espera 10
 *    minutos») es indistinguible para él de que la página esté rota.
 *  - LA CLAVE LLEVA LA HUELLA DEL ARCHIVO, no solo la IP (ver ./huella.ts). Así
 *    lo que se cuenta es «esta hoja de vida desde esta IP», que es lo que hace
 *    una persona insistiendo, y no «alguien desde esta IP», que es lo que hacen
 *    veinte candidatos del mismo operador.
 */
export const LIMITE_POSTULACIONES_MEMORIA = {
  maximo: 20,
  ventanaSegundos: 600,
  prefijo: 'empleos:postular:huella',
};

/**
 * Límite de las postulaciones SIN VERIFICAR, mucho más estrecho.
 *
 * Una postulación sin token de Turnstile es la que entra cuando el reto no se
 * pudo resolver en ese navegador (un WebView de WhatsApp, un bloqueador, un
 * teléfono viejo). Se acepta porque perder a un candidato real es peor que
 * revisar un correo de más, pero es también la puerta que usaría un robot: le
 * basta con no mandar token. De ahí el tope de tres cada media hora, contando
 * por IP y huella del archivo, y de ahí que el correo salga marcado
 * «[SIN VERIFICAR]» para que Talento Humano lo lea con criterio.
 */
export const LIMITE_SIN_VERIFICAR = {
  maximo: 3,
  ventanaSegundos: 1800,
  prefijo: 'empleos:postular:sin-verificar',
};

/**
 * Nombre del campo trampa (honeypot) del formulario.
 *
 * Está en el HTML pero fuera de la vista y del orden de tabulación: una persona
 * no lo ve y lo deja vacío; un robot que rellena todos los campos lo llena. Si
 * llega con algo, el servidor responde 200 sin enviar nada, para no enseñarle
 * al robot qué campo lo delató.
 */
export const CAMPO_HONEYPOT = 'sitio-web';

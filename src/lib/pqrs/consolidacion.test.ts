/**
 * Pruebas de la consolidación de PQRS y Empleos en UNA sola cuenta de Resend.
 *
 * Lo que cuidan es el ORDEN, que es lo único peligroso de este cambio. Las dos
 * cuentas no pueden verificar dstunja.com a la vez (cada una publicaría su
 * propia clave DKIM en `resend._domainkey.dstunja.com`), así que hay que
 * quedarse con una; pero borrar `PQRS_RESEND_API_KEY` antes de que el dominio
 * esté verificado hace que PQRS mande con la cuenta de Empleos hacia un buzón
 * que esa cuenta no puede alcanzar, y todos los avisos al área fallan en
 * silencio.
 *
 * De ahí las dos mitades de lo que se prueba aquí:
 *
 *   1. `claveResend` NO cambia de comportamiento: sigue prefiriendo la clave de
 *      PQRS mientras exista. La consolidación se hace borrando la variable en
 *      Vercel, no tocando el código, y esta prueba es la que impide que alguien
 *      «adelante» el cambio invirtiendo la preferencia.
 *   2. `yaSePuedeBorrarLaClaveDePqrs` avisa exactamente cuando ya es seguro, y
 *      NO antes. Un recordatorio que aparece mientras obedecerlo rompe el envío
 *      es peor que no tener recordatorio.
 */
import { describe, expect, it } from 'vitest';
import { claveResend, yaSePuedeBorrarLaClaveDePqrs, type Entorno } from './config';

const CLAVE_PQRS = 're_clave_de_pqrs';
const CLAVE_UNICA = 're_clave_de_empleos';

describe('claveResend: la preferencia no cambia con la consolidación', () => {
  it('usa la clave de PQRS mientras esté definida', () => {
    const env = { PQRS_RESEND_API_KEY: CLAVE_PQRS, RESEND_API_KEY: CLAVE_UNICA } as Entorno;
    expect(claveResend(env)).toBe(CLAVE_PQRS);
  });

  it('cae a la cuenta única cuando se borra la de PQRS: así se consolida', () => {
    const env = { RESEND_API_KEY: CLAVE_UNICA } as Entorno;
    expect(claveResend(env)).toBe(CLAVE_UNICA);
  });

  it('devuelve cadena vacía si no hay ninguna, para que `faltaParaRadicar` lo vea', () => {
    expect(claveResend({} as Entorno)).toBe('');
  });

  it('ignora una variable que solo tiene espacios', () => {
    const env = { PQRS_RESEND_API_KEY: '   ', RESEND_API_KEY: CLAVE_UNICA } as Entorno;
    expect(claveResend(env)).toBe(CLAVE_UNICA);
  });
});

describe('yaSePuedeBorrarLaClaveDePqrs: avisa cuando es seguro, y no antes', () => {
  it('NO avisa con el remitente de pruebas: borrarla ahí rompe todos los avisos', () => {
    const env = {
      PQRS_RESEND_API_KEY: CLAVE_PQRS,
      RESEND_API_KEY: CLAVE_UNICA,
      PQRS_REMITENTE: 'onboarding@resend.dev',
    } as Entorno;
    expect(yaSePuedeBorrarLaClaveDePqrs(env)).toBe(false);
  });

  it('NO avisa cuando PQRS_REMITENTE no está: su valor por defecto es el de pruebas', () => {
    const env = { PQRS_RESEND_API_KEY: CLAVE_PQRS, RESEND_API_KEY: CLAVE_UNICA } as Entorno;
    expect(yaSePuedeBorrarLaClaveDePqrs(env)).toBe(false);
  });

  it('avisa cuando el remitente ya es del dominio verificado', () => {
    const env = {
      PQRS_RESEND_API_KEY: CLAVE_PQRS,
      RESEND_API_KEY: CLAVE_UNICA,
      PQRS_REMITENTE: 'pqrs@dstunja.com',
    } as Entorno;
    expect(yaSePuedeBorrarLaClaveDePqrs(env)).toBe(true);
  });

  it('reconoce el remitente con nombre delante: «PQRS DST <pqrs@dstunja.com>»', () => {
    const env = {
      PQRS_RESEND_API_KEY: CLAVE_PQRS,
      PQRS_REMITENTE: 'PQRS DST <pqrs@dstunja.com>',
    } as Entorno;
    expect(yaSePuedeBorrarLaClaveDePqrs(env)).toBe(true);
  });

  it('NO avisa con un remitente de pruebas escrito con nombre delante', () => {
    const env = {
      PQRS_RESEND_API_KEY: CLAVE_PQRS,
      PQRS_REMITENTE: 'Pruebas <onboarding@resend.dev>',
    } as Entorno;
    expect(yaSePuedeBorrarLaClaveDePqrs(env)).toBe(false);
  });

  it('NO avisa si la variable ya no existe: no hay nada que borrar', () => {
    const env = { RESEND_API_KEY: CLAVE_UNICA, PQRS_REMITENTE: 'pqrs@dstunja.com' } as Entorno;
    expect(yaSePuedeBorrarLaClaveDePqrs(env)).toBe(false);
  });
});

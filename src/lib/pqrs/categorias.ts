/**
 * Las dos categorías de PQRS: a quién va dirigida y por dónde sale.
 *
 * QUÉ DECIDE LA CATEGORÍA. No es una etiqueta decorativa: es lo que determina
 * el canal entero, y los dos caminos ya ni siquiera comparten pantalla.
 *
 *   ADMINISTRATIVA (`via: 'contacto'`) NO ES UN TRÁMITE EN LÍNEA. Al elegirla
 *   no aparece el paso 2 ni el formulario de PQRS: aparece un bloque con el
 *   teléfono, el WhatsApp y el correo de la empresa, porque estos asuntos
 *   —facturación, certificados, documentos— los atiende una persona del equipo
 *   y no un radicador automático. Debajo lleva un formulario corto y opcional
 *   para dejar los datos y que el equipo devuelva la llamada.
 *
 *   COMERCIAL (`via: 'radicacion'`) es la radicación de verdad: pide el tipo,
 *   sube los soportes a Vercel Blob, verifica Turnstile, guarda el registro y
 *   devuelve un número de radicado.
 *
 * POR QUÉ LA CATEGORÍA VA ANTES QUE EL TIPO, Y NO EN SU LUGAR. El tipo
 * ("Petición", "Queja"…) solo tiene sentido dentro de la comercial, que es la
 * única que radica. Sus `value` los comparan `TIPOS_CON_SOPORTE` en
 * src/lib/adjuntos.ts, el asunto del correo y el campo `tipo` del registro de la
 * radicación; sustituirlos por las categorías habría roto las tres cosas a la
 * vez.
 *
 * ESTE ARCHIVO NO LEE EL ENTORNO NI IMPORTA DATOS DEL SITIO, igual que
 * src/lib/adjuntos.ts, así que el mismo módulo sirve en el navegador y en una
 * función de Vercel sin bifurcarse. Importar aquí `src/data/site.ts` habría
 * arrastrado sus 18 KB de coordenadas al JavaScript del navegador solo por una
 * dirección de correo.
 *
 * DÓNDE ESTÁ EL CORREO DE DESTINO. En una sola variable, `PQRS_DESTINO`, que
 * lee `correoDestino()` en src/lib/pqrs/config.ts. La lee tanto la radicación
 * comercial como el formulario administrativo: los dos acaban en el mismo
 * buzón y se distinguen por el asunto. Antes había además una
 * `PUBLIC_PQRS_ADMIN_DESTINO` para armar un `mailto:` en el navegador; se
 * eliminó al pasar el envío administrativo al servidor, porque dos variables
 * apuntando al mismo buzón es la forma de que un día dejen de coincidir.
 */
import { requiereSoporte } from '../adjuntos';

export type ClaveCategoria = 'administrativa' | 'comercial';

/** Qué se le ofrece a quien elige la categoría. */
export type Via = 'contacto' | 'radicacion';

export interface Categoria {
  clave: ClaveCategoria;
  /** Lo que se lee en la tarjeta y lo que viaja en el correo. */
  nombre: string;
  /** Nombre del icono en src/components/Icono.astro. */
  icono: string;
  /** Descripción de la tarjeta. El texto vive aquí, no en la página. */
  texto: string;
  /** Lo que se le advierte a la persona antes de enviar. */
  nota: string;
  via: Via;
  /**
   * Si la categoría admite archivos de soporte. Es una condición NECESARIA pero
   * no suficiente: el tipo también tiene que pedirlos (ver `admiteSoporte`).
   */
  admiteSoporte: boolean;
}

export const CATEGORIAS: readonly Categoria[] = [
  {
    clave: 'administrativa',
    nombre: 'Administrativa',
    icono: 'file-text',
    texto:
      'Trámites, documentos, facturación, certificados o asuntos de administración. ' +
      'Se atienden directamente por nuestro equipo.',
    nota:
      'Te atendemos directamente por teléfono, WhatsApp o correo. No pasa por el ' +
      'formulario de PQRS y no genera número de radicado.',
    via: 'contacto',
    admiteSoporte: false,
  },
  {
    clave: 'comercial',
    nombre: 'Comercial',
    icono: 'message-square',
    texto:
      'Productos, pedidos, entregas, precios o la atención en un punto de venta. ' +
      'Queda radicada con número y fecha, y puedes adjuntar soportes.',
    nota:
      'Queda radicada con un número de seguimiento y una fecha, que también te llegan ' +
      'por correo. En quejas y reclamos puedes adjuntar evidencia.',
    via: 'radicacion',
    admiteSoporte: true,
  },
];

/** La categoría con la que se entra a la página: ninguna, hay que elegir. */
export const SIN_CATEGORIA = '';

export function categoriaDe(clave: string | null | undefined): Categoria | undefined {
  return CATEGORIAS.find((c) => c.clave === clave);
}

/**
 * ¿Este envío admite archivos de soporte?
 *
 * Hacen falta las dos condiciones: una categoría que los acepte (solo la
 * comercial) y un tipo que los pida (hoy Queja y Reclamo). Una queja
 * administrativa NO lleva adjuntos, aunque "Queja" esté en `TIPOS_CON_SOPORTE`.
 */
export function admiteSoporte(
  clave: string | null | undefined,
  tipo: string | null | undefined,
): boolean {
  return (categoriaDe(clave)?.admiteSoporte ?? false) && requiereSoporte(tipo);
}

/**
 * Asunto del correo.
 *
 * Nombra la categoría SIEMPRE y en primer lugar, que es lo que permite separar
 * los dos flujos en la bandeja de entrada aunque acaben en el mismo buzón, y
 * cierra con el municipio, que es lo que decide qué ruta y qué asesor atienden
 * la solicitud. Se puede clasificar sin abrir el correo.
 *
 * Los argumentos van en un objeto y no sueltos a propósito: con cuatro trozos,
 * tres de ellos cadenas, el orden posicional se equivoca solo.
 *
 * Hoy solo lo usa la categoría COMERCIAL, que es la única que radica; sigue
 * nombrando la categoría en primer lugar porque lo administrativo llega al
 * mismo buzón por otra vía («Solicitud administrativa · Nombre», ver
 * src/lib/pqrs/administrativa.ts) y en la bandeja hay que poder separarlos.
 *
 * @example asuntoDe({ categoria: 'comercial', tipo: 'Petición', municipio: 'Tunja' })
 *          -> 'PQRS Comercial · Petición · Tunja'
 * @example asuntoDe({ categoria: 'comercial', tipo: 'Queja', municipio: 'Samacá', radicado: 'PQRS-…' })
 *          -> '[PQRS-…] PQRS Comercial · Queja · Samacá'
 */
export function asuntoDe({
  categoria,
  tipo,
  municipio = '',
  radicado = '',
}: {
  categoria: string | null | undefined;
  tipo: string;
  municipio?: string;
  radicado?: string;
}): string {
  const nombre = categoriaDe(categoria)?.nombre ?? 'Comercial';
  const partes = [`PQRS ${nombre}`, tipo, municipio].filter((p) => p && p.trim() !== '');
  const cuerpo = partes.join(' · ');
  return radicado ? `[${radicado}] ${cuerpo}` : cuerpo;
}

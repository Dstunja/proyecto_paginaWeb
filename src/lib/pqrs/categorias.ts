/**
 * Las dos categorías de PQRS: a quién va dirigida y por dónde sale.
 *
 * QUÉ DECIDE LA CATEGORÍA. No es una etiqueta decorativa: es lo que determina
 * el canal entero. La administrativa se dirige a la empresa y sale por el
 * gestor de correo de quien escribe (`mailto:`), sin adjuntos, sin antirrobots
 * y sin número de radicado. La comercial es la radicación de verdad: sube los
 * soportes a Vercel Blob, verifica Turnstile, guarda el registro y devuelve un
 * radicado. Son dos trámites distintos que comparten los mismos campos.
 *
 * POR QUÉ LA CATEGORÍA VA ANTES QUE EL TIPO, Y NO EN SU LUGAR. Son ejes
 * independientes: existe la queja administrativa y la queja comercial. Además
 * los `value` de los tipos ("Petición", "Queja"…) los comparan `TIPOS_CON_SOPORTE`
 * en src/lib/adjuntos.ts, el asunto del correo y el campo `tipo` del registro de
 * la radicación; sustituirlos por las categorías habría roto las tres cosas a la
 * vez.
 *
 * ESTE ARCHIVO NO LEE EL ENTORNO NI IMPORTA DATOS DEL SITIO, igual que
 * src/lib/adjuntos.ts: quien llama le pasa el entorno y el correo de respaldo a
 * `destinatarioDe`. Así el mismo módulo sirve en el navegador (con
 * `import.meta.env`, en tiempo de build) y en una función de Vercel (con
 * `process.env`, en cada petición) sin bifurcarse. Importar aquí
 * `src/data/site.ts` habría arrastrado sus 18 KB de coordenadas al JavaScript
 * del navegador solo por una dirección de correo.
 */
import { requiereSoporte } from '../adjuntos';

export type ClaveCategoria = 'administrativa' | 'comercial';

/** Por dónde sale la solicitud una vez enviada. */
export type Via = 'correo' | 'radicacion';

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
  /**
   * Variable de entorno con el correo de destino. Las de la administrativa
   * llevan prefijo PUBLIC_ porque el `mailto:` se arma EN EL NAVEGADOR y el
   * valor tiene que estar dentro del JavaScript compilado. No es un secreto:
   * es una dirección de contacto que el sitio ya publica.
   */
  variableDestino: string;
}

export const CATEGORIAS: readonly Categoria[] = [
  {
    clave: 'administrativa',
    nombre: 'Administrativa',
    icono: 'file-text',
    texto:
      'Trámites, documentos, facturación, certificados o cualquier asunto de la ' +
      'administración de la empresa. Escribes directamente a nuestros contactos.',
    nota:
      'Se envía desde tu gestor de correo a la administración de la empresa. No lleva ' +
      'archivos adjuntos ni número de radicado.',
    via: 'correo',
    admiteSoporte: false,
    variableDestino: 'PUBLIC_PQRS_ADMIN_DESTINO',
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
    variableDestino: 'PQRS_DESTINO',
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

export type EntornoCategorias = Record<string, string | undefined>;

/**
 * Correo al que va una categoría.
 *
 * `respaldo` es lo que se usa si la variable no está definida, y quien llama le
 * pasa el correo de la empresa (`empresa.email`, en src/data/site.ts). Con eso
 * el formulario administrativo funciona desde el primer despliegue, aunque
 * nadie haya definido la variable todavía, en lugar de armar un `mailto:` sin
 * destinatario. La dirección sigue sin estar escrita a mano en ningún
 * componente: sale de una variable de entorno o de un archivo de configuración.
 */
export function destinatarioDe(
  clave: string | null | undefined,
  env: EntornoCategorias = {},
  respaldo = '',
): string {
  const categoria = categoriaDe(clave);
  if (!categoria) return respaldo;
  const valor = env[categoria.variableDestino];
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : respaldo;
}

/**
 * Asunto del correo. Nombra la categoría SIEMPRE y en primer lugar, que es lo
 * que permite separar los dos flujos en la bandeja de entrada aunque acaben en
 * el mismo buzón.
 *
 * @example asuntoDe('administrativa', 'Petición')  -> 'PQRS Administrativa · Petición'
 * @example asuntoDe('comercial', 'Queja', 'PQRS-…') -> '[PQRS-…] PQRS Comercial · Queja'
 */
export function asuntoDe(
  clave: string | null | undefined,
  tipo: string,
  radicado?: string,
): string {
  const nombre = categoriaDe(clave)?.nombre ?? 'Comercial';
  const cuerpo = `PQRS ${nombre}${tipo ? ` · ${tipo}` : ''}`;
  return radicado ? `[${radicado}] ${cuerpo}` : cuerpo;
}

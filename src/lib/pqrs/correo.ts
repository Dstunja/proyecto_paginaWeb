/**
 * Correos de una radicación de PQRS, con Resend.
 *
 * Salen, como mucho, dos:
 *
 * 1. Al área de PQRS (`PQRS_DESTINO`, por defecto informacioncomercialdst@gmail.com)
 *    con todos los datos y un enlace de descarga por adjunto. NO se adjuntan los
 *    archivos: el enlace caduca y el correo se reenvía, así que meter el soporte
 *    de una queja dentro del mensaje lo esparce sin control. El `replyTo` es el
 *    correo de quien radica, para que responder desde la bandeja funcione sin
 *    copiar direcciones.
 * 2. A quien radica, con el radicado y la fecha. Es su constancia. SOLO sale si
 *    el remitente es de un dominio verificado: con `onboarding@resend.dev`
 *    Resend rechaza a cualquier destinatario que no sea el titular de la cuenta,
 *    así que ni se intenta y la pantalla le pide a la persona que guarde el
 *    número (`constancia: 'omitida'`).
 *
 * La clave es la de la cuenta de Resend de PQRS: PQRS_RESEND_API_KEY y, si no
 * está, RESEND_API_KEY (ver `claveResend` en ./config.ts).
 *
 * Si falla el envío la radicación NO se deshace: el registro y los archivos ya
 * están guardados en el Blob, que es lo que da fe. El motivo técnico va al
 * registro del servidor; la respuesta solo dice QUÉ no salió.
 *
 * Al final del archivo hay un tercer correo, `enviarCorreoAdministrativo`, que
 * es de otro trámite: el formulario corto del bloque administrativo. Va al
 * MISMO buzón (`PQRS_DESTINO`) porque todo lo que escribe un cliente acaba en
 * la misma bandeja, y se separa por el asunto.
 */
import { Resend } from 'resend';
import { asuntoDe } from './categorias';
import {
  claveResend,
  correoDestino,
  correoRemitente,
  esRemitenteDePrueba,
  type Entorno,
} from './config';
import type { RegistroPqrs } from './solicitud';

export interface AdjuntoParaCorreo {
  nombreOriginal: string;
  tamano: number;
  enlace: string;
}

/**
 * Qué pasó con la constancia a quien radica.
 * - `enviada`: salió.
 * - `omitida`: no se intentó, porque el remitente es el de pruebas de Resend.
 * - `fallida`: se intentó y Resend la rechazó.
 */
export type EstadoConstancia = 'enviada' | 'omitida' | 'fallida';

export interface ResultadoCorreo {
  /** El correo al área salió. */
  destinoOk: boolean;
  constancia: EstadoConstancia;
  /** Motivos técnicos, para el registro del servidor. Nunca van al navegador. */
  errores: string[];
}

/** Escapa lo que escribió la persona antes de meterlo en el HTML del correo. */
function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

const ESTILO_CUERPO =
  'font-family:Segoe UI,system-ui,sans-serif;color:#263238;line-height:1.6;font-size:15px';
const ESTILO_ETIQUETA = 'color:#5f6b73;font-size:13px;text-transform:uppercase;letter-spacing:.06em';

function fila(etiqueta: string, valor: string): string {
  if (!valor) return '';
  return `<tr>
    <td style="padding:6px 16px 6px 0;vertical-align:top;${ESTILO_ETIQUETA}">${escapar(etiqueta)}</td>
    <td style="padding:6px 0;vertical-align:top">${escapar(valor)}</td>
  </tr>`;
}

function cuerpoDestinoHtml(registro: RegistroPqrs, adjuntos: AdjuntoParaCorreo[], caduca: string): string {
  const listaAdjuntos =
    adjuntos.length === 0
      ? '<p style="margin:0;color:#5f6b73">Sin archivos de soporte.</p>'
      : `<ul style="margin:0;padding-left:20px">${adjuntos
          .map(
            (a) =>
              `<li style="margin-bottom:6px"><a href="${escapar(a.enlace)}" style="color:#1565c0">${escapar(
                a.nombreOriginal,
              )}</a> <span style="color:#5f6b73">(${tamanoLegible(a.tamano)})</span></li>`,
          )
          .join('')}</ul>
        <p style="margin:12px 0 0;color:#5f6b73;font-size:13px">
          Los enlaces caducan el ${escapar(caduca)}. Descarga los archivos antes de esa fecha o
          entra al almacenamiento del proyecto en Vercel.
        </p>`;

  return `<div style="${ESTILO_CUERPO}">
    <h2 style="margin:0 0 4px;color:#0d2c84">${escapar(registro.tipo)} radicada</h2>
    <p style="margin:0 0 20px;font-size:20px;font-weight:600">${escapar(registro.radicado)}</p>
    <table style="border-collapse:collapse;width:100%">
      ${fila('Fecha', registro.fecha)}
      ${fila('Tipo', registro.tipo)}
      ${fila('Nombre', registro.nombre)}
      ${fila('Documento', registro.documento)}
      ${fila('Teléfono', registro.telefono)}
      ${fila('Correo', registro.correo)}
      ${fila('Municipio', registro.municipio)}
    </table>
    <h3 style="margin:24px 0 8px;color:#0d2c84;font-size:16px">Descripción</h3>
    <p style="margin:0;white-space:pre-wrap">${escapar(registro.descripcion)}</p>
    <h3 style="margin:24px 0 8px;color:#0d2c84;font-size:16px">Archivos de soporte</h3>
    ${listaAdjuntos}
    <p style="margin:24px 0 0;color:#5f6b73;font-size:13px">
      Autorización de tratamiento de datos: ${registro.autorizacion ? 'sí' : 'no'}.
      Registro completo en el almacenamiento, ruta <code>pqrs/${escapar(registro.radicado)}/</code>.
    </p>
  </div>`;
}

function cuerpoDestinoTexto(registro: RegistroPqrs, adjuntos: AdjuntoParaCorreo[]): string {
  const lineas = [
    `${registro.tipo} radicada: ${registro.radicado}`,
    `Fecha: ${registro.fecha}`,
    `Nombre: ${registro.nombre}`,
    registro.documento ? `Documento: ${registro.documento}` : '',
    `Teléfono: ${registro.telefono}`,
    `Correo: ${registro.correo}`,
    `Municipio: ${registro.municipio}`,
    '',
    'Descripción:',
    registro.descripcion,
    '',
    adjuntos.length === 0
      ? 'Sin archivos de soporte.'
      : `Archivos de soporte (${adjuntos.length}):\n` +
        adjuntos.map((a) => `  - ${a.nombreOriginal} (${tamanoLegible(a.tamano)}): ${a.enlace}`).join('\n'),
  ];
  return lineas.filter((l) => l !== '').join('\n');
}

function cuerpoCiudadanoHtml(registro: RegistroPqrs): string {
  return `<div style="${ESTILO_CUERPO}">
    <p style="margin:0 0 16px">Hola ${escapar(registro.nombre)},</p>
    <p style="margin:0 0 16px">
      Recibimos tu ${escapar(registro.tipo.toLowerCase())} y quedó radicada. Guarda este número:
      te sirve para hacer seguimiento.
    </p>
    <p style="margin:0 0 4px;${ESTILO_ETIQUETA}">Número de radicado</p>
    <p style="margin:0 0 20px;font-size:24px;font-weight:700;color:#0d2c84;letter-spacing:.04em">
      ${escapar(registro.radicado)}
    </p>
    <p style="margin:0 0 4px;${ESTILO_ETIQUETA}">Fecha de radicación</p>
    <p style="margin:0 0 24px">${escapar(registro.fecha)}</p>
    <p style="margin:0 0 16px">
      Respondemos en un plazo máximo de 15 días hábiles, como manda la ley. Si necesitas
      agregar algo, responde a este correo citando el radicado.
    </p>
    <p style="margin:0;color:#5f6b73;font-size:13px">
      Distribuciones Santiago de Tunja S.A.S.
    </p>
  </div>`;
}

function cuerpoCiudadanoTexto(registro: RegistroPqrs): string {
  return [
    `Hola ${registro.nombre},`,
    '',
    `Recibimos tu ${registro.tipo.toLowerCase()} y quedó radicada.`,
    '',
    `Número de radicado: ${registro.radicado}`,
    `Fecha de radicación: ${registro.fecha}`,
    '',
    'Respondemos en un plazo máximo de 15 días hábiles, como manda la ley.',
    'Si necesitas agregar algo, responde a este correo citando el radicado.',
    '',
    'Distribuciones Santiago de Tunja S.A.S.',
  ].join('\n');
}

export async function enviarCorreos(
  registro: RegistroPqrs,
  adjuntos: AdjuntoParaCorreo[],
  caducidadEnlaces: string,
  env: Entorno,
): Promise<ResultadoCorreo> {
  const errores: string[] = [];
  const clave = claveResend(env);
  const destino = correoDestino(env);

  // /api/pqrs ya comprueba la clave antes de radicar (`faltaParaRadicar`); esto
  // es la red por si alguien llama a esta función desde otro sitio.
  if (!clave) {
    return {
      destinoOk: false,
      constancia: 'fallida',
      errores: ['Falta PQRS_RESEND_API_KEY (o RESEND_API_KEY).'],
    };
  }

  const resend = new Resend(clave);
  const remitente = correoRemitente(env);

  let destinoOk = false;
  try {
    const { error } = await resend.emails.send({
      from: remitente,
      to: destino,
      replyTo: registro.correo,
      /*
       * El asunto dice categoría, tipo y municipio, que es lo que hace falta
       * para encaminar la PQRS sin abrirla. Todo lo que llega por aquí es
       * COMERCIAL por definición: la administrativa sale por el gestor de
       * correo de quien escribe y no pasa por ninguna función.
       */
      subject: asuntoDe({
        categoria: 'comercial',
        tipo: registro.tipo,
        municipio: registro.municipio,
        radicado: registro.radicado,
      }),
      html: cuerpoDestinoHtml(registro, adjuntos, caducidadEnlaces),
      text: cuerpoDestinoTexto(registro, adjuntos),
    });
    if (error) errores.push(`Correo al área de PQRS: ${error.message}`);
    else destinoOk = true;
  } catch (fallo) {
    errores.push(`Correo al área de PQRS: ${(fallo as Error).message}`);
  }

  // Con el remitente de pruebas Resend solo entrega al titular de la cuenta:
  // la constancia a quien radica fallaría siempre, así que no se intenta.
  if (esRemitenteDePrueba(remitente)) {
    return { destinoOk, constancia: 'omitida', errores };
  }

  let constancia: EstadoConstancia = 'fallida';
  try {
    const { error } = await resend.emails.send({
      from: remitente,
      to: registro.correo,
      replyTo: destino,
      subject: `Radicamos tu solicitud: ${registro.radicado}`,
      html: cuerpoCiudadanoHtml(registro),
      text: cuerpoCiudadanoTexto(registro),
    });
    if (error) errores.push(`Correo de confirmación: ${error.message}`);
    else constancia = 'enviada';
  } catch (fallo) {
    errores.push(`Correo de confirmación: ${(fallo as Error).message}`);
  }

  return { destinoOk, constancia, errores };
}

// --- Solicitud administrativa ----------------------------------------------

/**
 * Lo que deja escrito quien usa el formulario corto del bloque administrativo.
 * `correo` puede venir vacío: ahí el campo es opcional a propósito, porque a
 * mucha gente de tienda es más fácil devolverle la llamada que escribirle.
 */
export interface SolicitudAdministrativa {
  nombre: string;
  telefono: string;
  correo: string;
  mensaje: string;
}

/**
 * Avisa al equipo de una solicitud administrativa. UN SOLO correo, al mismo
 * buzón de `PQRS_DESTINO` que la radicación comercial.
 *
 * No hay correo de vuelta para quien escribe, y no es un olvido: esto no genera
 * radicado, así que no habría constancia que mandarle, y el campo del correo es
 * opcional —en la mitad de los casos no hay dirección a la que escribir—. Lo
 * que recibe es la confirmación en pantalla.
 *
 * El asunto es «Solicitud administrativa · Nombre», distinto a propósito del
 * «PQRS Comercial · …» de `asuntoDe`: los dos caen en la misma bandeja y hay
 * que poder separarlos con un filtro sin abrirlos.
 *
 * El `replyTo` solo se pone si hay correo. Ponerlo vacío haría que responder
 * desde la bandeja fuera a parar al propio remitente del sitio.
 */
export async function enviarCorreoAdministrativo(
  datos: SolicitudAdministrativa,
  env: Entorno,
): Promise<{ ok: boolean; error?: string }> {
  const clave = claveResend(env);
  const destino = correoDestino(env);
  if (!clave) return { ok: false, error: 'Falta PQRS_RESEND_API_KEY (o RESEND_API_KEY).' };

  const resend = new Resend(clave);

  const texto = [
    'Solicitud administrativa desde el formulario de PQRS de dstunja.com.',
    '',
    `Nombre: ${datos.nombre}`,
    `Teléfono: ${datos.telefono}`,
    datos.correo ? `Correo: ${datos.correo}` : 'Correo: (no lo dejó)',
    '',
    'Mensaje:',
    datos.mensaje,
    '',
    'Esta solicitud NO tiene número de radicado: es una petición de contacto.',
  ].join('\n');

  const html = `<div style="${ESTILO_CUERPO}">
    <h2 style="margin:0 0 4px;color:#0d2c84">Solicitud administrativa</h2>
    <p style="margin:0 0 20px;color:#5f6b73">
      Alguien pidió que lo contactaran desde el bloque administrativo de la página de PQRS.
    </p>
    <table style="border-collapse:collapse;width:100%">
      ${fila('Nombre', datos.nombre)}
      ${fila('Teléfono', datos.telefono)}
      ${fila('Correo', datos.correo || '(no lo dejó)')}
    </table>
    <p style="margin:20px 0 6px;${ESTILO_ETIQUETA}">Mensaje</p>
    <p style="margin:0;white-space:pre-wrap">${escapar(datos.mensaje)}</p>
    <p style="margin:24px 0 0;color:#5f6b73;font-size:13px">
      Esta solicitud no tiene número de radicado: es una petición de contacto, no una PQRS
      comercial.
    </p>
  </div>`;

  try {
    const { error } = await resend.emails.send({
      from: correoRemitente(env),
      to: destino,
      ...(datos.correo ? { replyTo: datos.correo } : {}),
      subject: `Solicitud administrativa · ${datos.nombre}`,
      html,
      text: texto,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (fallo) {
    return { ok: false, error: (fallo as Error).message };
  }
}

/**
 * Correos de una radicación de PQRS, con Resend.
 *
 * Salen dos:
 *
 * 1. Al área de PQRS (`PQRS_DESTINO`) con todos los datos y un enlace firmado
 *    por adjunto. NO se adjuntan los archivos: el enlace caduca y el correo se
 *    reenvía, así que meter el soporte de una queja dentro del mensaje lo
 *    esparce sin control. El `replyTo` es el correo de quien radica, para que
 *    responder desde la bandeja funcione sin copiar direcciones.
 * 2. A quien radica, con el radicado y la fecha. Es su constancia.
 *
 * Si falla el envío la radicación NO se deshace: el registro y los archivos ya
 * están guardados en el Blob, que es lo que da fe. El fallo se devuelve para
 * dejarlo en el registro del servidor y avisarlo en pantalla.
 */
import { Resend } from 'resend';
import { correoDestino, correoRemitente, type Entorno } from './config';
import type { RegistroPqrs } from './solicitud';

export interface AdjuntoParaCorreo {
  nombreOriginal: string;
  tamano: number;
  enlace: string;
}

export interface ResultadoCorreo {
  destinoOk: boolean;
  ciudadanoOk: boolean;
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
  const clave = env.RESEND_API_KEY;
  const destino = correoDestino(env);

  if (!clave) {
    return { destinoOk: false, ciudadanoOk: false, errores: ['Falta RESEND_API_KEY.'] };
  }
  if (!destino) {
    return { destinoOk: false, ciudadanoOk: false, errores: ['Falta PQRS_DESTINO.'] };
  }

  const resend = new Resend(clave);
  const remitente = correoRemitente(env);

  let destinoOk = false;
  try {
    const { error } = await resend.emails.send({
      from: remitente,
      to: destino,
      replyTo: registro.correo,
      subject: `[${registro.radicado}] ${registro.tipo} de ${registro.nombre}`,
      html: cuerpoDestinoHtml(registro, adjuntos, caducidadEnlaces),
      text: cuerpoDestinoTexto(registro, adjuntos),
    });
    if (error) errores.push(`Correo al área de PQRS: ${error.message}`);
    else destinoOk = true;
  } catch (fallo) {
    errores.push(`Correo al área de PQRS: ${(fallo as Error).message}`);
  }

  let ciudadanoOk = false;
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
    else ciudadanoOk = true;
  } catch (fallo) {
    errores.push(`Correo de confirmación: ${(fallo as Error).message}`);
  }

  return { destinoOk, ciudadanoOk, errores };
}

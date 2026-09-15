/**
 * Correo de una postulación, con Resend.
 *
 * Sale UNO, a Talento Humano (`EMPLEOS_DESTINO`), con los datos en el cuerpo y
 * la hoja de vida ADJUNTA. Aquí sí se adjunta, al contrario que en PQRS, donde
 * los soportes van enlazados: la hoja de vida es justo lo que Talento Humano
 * tiene que abrir, y no se guarda en ningún otro sitio, así que el correo es
 * la única copia.
 *
 * El `replyTo` es el correo del candidato, para responderle desde la bandeja
 * sin copiar direcciones. El teléfono va como enlace `tel:` y el correo como
 * `mailto:`, para contestar desde el celular con un toque.
 *
 * No hay correo de confirmación al candidato: la confirmación es la pantalla.
 * Sin número de radicado ni plazo legal, un segundo correo solo llenaría su
 * bandeja.
 */
import { Resend } from 'resend';
import { correoDestinoEmpleos, correoRemitenteEmpleos, type Entorno } from './config';
import type { PostulacionValidada } from './postulacion';

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

/**
 * Teléfono en formato E.164 para el enlace `tel:`.
 *
 * Los candidatos escriben celulares colombianos de diez dígitos, con o sin el
 * 57 delante y con espacios o guiones. Se dejan solo los dígitos y se antepone
 * el indicativo si no lo traía; si ya viene con 57 y el largo cuadra, se deja.
 */
export function telefonoParaEnlace(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.startsWith('57') && digitos.length >= 12) return `+${digitos}`;
  return `+57${digitos}`;
}

/** «Postulación: Vendedor TAT – Cristian Amaya». */
export function asuntoPostulacion(cargo: string, nombre: string): string {
  return `Postulación: ${cargo} – ${nombre}`;
}

const ESTILO_CUERPO =
  'font-family:Segoe UI,system-ui,sans-serif;color:#263238;line-height:1.6;font-size:15px';
const ESTILO_ETIQUETA = 'color:#5f6b73;font-size:13px;text-transform:uppercase;letter-spacing:.06em';
const ESTILO_ENLACE = 'color:#1565c0;text-decoration:underline';

/** Una fila de la tabla. `valorHtml` ya viene escapado por quien lo construye. */
function fila(etiqueta: string, valorHtml: string): string {
  if (!valorHtml) return '';
  return `<tr>
    <td style="padding:6px 16px 6px 0;vertical-align:top;white-space:nowrap;${ESTILO_ETIQUETA}">${escapar(etiqueta)}</td>
    <td style="padding:6px 0;vertical-align:top">${valorHtml}</td>
  </tr>`;
}

function cuerpoHtml(datos: PostulacionValidada, fecha: string): string {
  const { hojaDeVida } = datos;
  const telefonoHref = telefonoParaEnlace(datos.telefono);

  const experiencia = datos.experiencia
    ? `<h3 style="margin:24px 0 8px;color:#0d2c84;font-size:16px">Sobre su experiencia</h3>
    <p style="margin:0;white-space:pre-wrap">${escapar(datos.experiencia)}</p>`
    : `<p style="margin:24px 0 0;color:#5f6b73">No escribió nada sobre su experiencia: está todo en la hoja de vida.</p>`;

  return `<div style="${ESTILO_CUERPO}">
    <h2 style="margin:0 0 4px;color:#0d2c84">Nueva postulación</h2>
    <p style="margin:0 0 20px;font-size:20px;font-weight:600">${escapar(datos.cargo)}</p>
    <table style="border-collapse:collapse;width:100%">
      ${fila('Nombre', escapar(datos.nombre))}
      ${fila('Cargo', escapar(datos.cargo))}
      ${fila(
        'Teléfono',
        `<a href="tel:${escapar(telefonoHref)}" style="${ESTILO_ENLACE}">${escapar(datos.telefono)}</a>`,
      )}
      ${fila(
        'Correo',
        `<a href="mailto:${escapar(datos.correo)}" style="${ESTILO_ENLACE}">${escapar(datos.correo)}</a>`,
      )}
      ${fila('Fecha', escapar(fecha))}
    </table>
    ${experiencia}
    <h3 style="margin:24px 0 8px;color:#0d2c84;font-size:16px">Hoja de vida</h3>
    <p style="margin:0">
      Va adjunta a este correo: <strong>${escapar(hojaDeVida.nombreSeguro)}</strong>
      <span style="color:#5f6b73">(${tamanoLegible(hojaDeVida.tamano)})</span>.
    </p>
    <p style="margin:24px 0 0;color:#5f6b73;font-size:13px">
      Autorización de tratamiento de datos para selección de personal (Ley 1581 de 2012): sí.
      Responder a este correo le escribe directamente al candidato.
    </p>
  </div>`;
}

function cuerpoTexto(datos: PostulacionValidada, fecha: string): string {
  const { hojaDeVida } = datos;
  return [
    `Nueva postulación: ${datos.cargo}`,
    `Fecha: ${fecha}`,
    `Nombre: ${datos.nombre}`,
    `Cargo: ${datos.cargo}`,
    `Teléfono: ${datos.telefono}`,
    `Correo: ${datos.correo}`,
    '',
    'Sobre su experiencia:',
    datos.experiencia || '(no escribió nada: está todo en la hoja de vida)',
    '',
    `Hoja de vida adjunta: ${hojaDeVida.nombreSeguro} (${tamanoLegible(hojaDeVida.tamano)})`,
    '',
    'Autorización de tratamiento de datos para selección de personal (Ley 1581 de 2012): sí.',
    'Responder a este correo le escribe directamente al candidato.',
  ].join('\n');
}

/** Fecha en hora de Colombia, legible: «7 de septiembre de 2026, 9:15». */
function fechaLegible(fecha: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(fecha);
}

export async function enviarCorreoPostulacion(
  datos: PostulacionValidada,
  env: Entorno,
  ahora: Date = new Date(),
): Promise<{ ok: boolean; error?: string }> {
  const clave = env.RESEND_API_KEY;
  if (!clave) return { ok: false, error: 'Falta RESEND_API_KEY.' };

  const resend = new Resend(clave);
  const fecha = fechaLegible(ahora);

  try {
    const { error } = await resend.emails.send({
      from: correoRemitenteEmpleos(env),
      to: correoDestinoEmpleos(env),
      replyTo: datos.correo,
      subject: asuntoPostulacion(datos.cargo, datos.nombre),
      html: cuerpoHtml(datos, fecha),
      text: cuerpoTexto(datos, fecha),
      attachments: [
        {
          filename: datos.hojaDeVida.nombreSeguro,
          content: Buffer.from(datos.hojaDeVida.bytes),
          contentType: datos.hojaDeVida.mime,
        },
      ],
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (fallo) {
    return { ok: false, error: (fallo as Error).message };
  }
}

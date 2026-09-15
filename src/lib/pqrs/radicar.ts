/**
 * El trabajo de POST /api/pqrs, separado del endpoint para poder probarlo.
 *
 * Recibe una `Request` y devuelve el código HTTP y el cuerpo que hay que
 * responder. El endpoint de src/pages/api/pqrs/index.ts es solo el envoltorio.
 *
 * ORDEN DE LAS COMPROBACIONES. Primero lo barato y local (forma del JSON),
 * luego el límite de tasa, luego Turnstile (una llamada de red) y solo al final
 * la descarga de los blobs, que es lo caro. Así una avalancha de basura se
 * corta antes de gastar ancho de banda.
 */
import { validarArchivo } from '../adjuntos';
import * as almacen from './almacen';
import {
  MINUTOS_ENLACE_DESCARGA,
  faltaParaRadicar,
  maxArchivos,
  maxBytes,
  maxMb,
  prefijoSesion,
  rutaRadicada,
  rutaSolicitud,
  type Entorno,
} from './config';
import { enviarCorreos, type AdjuntoParaCorreo, type EstadoConstancia } from './correo';
import { enlaceDescarga } from './descarga';
import { limitar } from './limite-tasa';
import { fechaLegible, generarRadicado } from './radicado';
import {
  hashIp,
  ipDePeticion,
  validarSolicitud,
  type RegistroPqrs,
  type SolicitudValidada,
} from './solicitud';
import { verificarTurnstile } from './turnstile';

/**
 * Respuesta de POST /api/pqrs.
 *
 * En la radicación correcta NO viajan los motivos técnicos de un correo que no
 * salió (antes iban en `avisos` y el formulario los enseñaba tal cual: «Falta
 * RESEND_API_KEY.», o el inglés de Resend). Viaja solo QUÉ pasó:
 * - `correoArea`: si el correo al área salió.
 * - `constancia`: si a quien radica le llegó su número por correo.
 * El detalle queda en el registro de Vercel.
 */
export interface Respuesta {
  estado: number;
  cuerpo:
    | {
        ok: true;
        radicado: string;
        fecha: string;
        correoArea: boolean;
        constancia: EstadoConstancia;
      }
    | { ok: false; errores: string[]; codigo?: 'config-incompleta' };
}

const LIMITE = { maximo: 5, ventanaSegundos: 600, prefijo: 'pqrs:radicar' };

function error(estado: number, ...errores: string[]): Respuesta {
  return { estado, cuerpo: { ok: false, errores } };
}

export async function radicar(peticion: Request, env: Entorno): Promise<Respuesta> {
  // --- 0. Configuración -----------------------------------------------------
  // Sin Blob no hay dónde guardar la solicitud y sin Resend nadie se entera de
  // que existe. Se comprueba antes de todo y se responde 503 con un código que
  // el formulario reconoce: avisa y ofrece el correo, en vez de radicar a medias.
  const faltan = faltaParaRadicar(env);
  if (faltan.length > 0) {
    console.error(`[pqrs] configuración incompleta: faltan ${faltan.join(', ')}.`);
    return {
      estado: 503,
      cuerpo: {
        ok: false,
        codigo: 'config-incompleta',
        errores: ['La radicación en línea no está disponible en este momento.'],
      },
    };
  }

  // --- 1. Cuerpo ------------------------------------------------------------
  let bruto: unknown;
  try {
    bruto = await peticion.json();
  } catch {
    return error(400, 'El cuerpo de la petición no es JSON válido.');
  }

  const validacion = validarSolicitud(bruto);
  if (!validacion.ok) return error(400, ...validacion.errores);
  const datos = validacion.datos;

  const ip = ipDePeticion(peticion.headers);

  // --- 2. Límite de tasa ----------------------------------------------------
  const veredicto = await limitar(ip, LIMITE, env);
  if (!veredicto.ok) {
    const minutos = Math.ceil(veredicto.segundosEspera / 60);
    return error(
      429,
      `Has radicado varias solicitudes seguidas. Espera ${minutos} minuto${minutos === 1 ? '' : 's'} e inténtalo de nuevo.`,
    );
  }

  // --- 3. Turnstile ---------------------------------------------------------
  const antirrobots = await verificarTurnstile(datos.turnstileToken, ip, env);
  if (!antirrobots.ok) {
    await almacen.borrarSesion(prefijoSesion(datos.sessionId), env);
    return error(403, antirrobots.error ?? 'La comprobación antirrobots no pasó.');
  }

  // --- 4. Adjuntos ----------------------------------------------------------
  const revision = await revisarAdjuntos(datos, env);
  if (!revision.ok) {
    await almacen.borrarSesion(prefijoSesion(datos.sessionId), env);
    return error(400, ...revision.errores);
  }

  // --- 5. Radicado y traslado de los archivos -------------------------------
  const ahora = new Date();
  const radicado = generarRadicado(ahora);

  const guardados: RegistroPqrs['adjuntos'] = [];
  for (const archivo of revision.archivos) {
    // Nombre nuevo, con la extensión que confirmó la validación de bytes, no
    // la que traía el archivo al subirse.
    const uuid = crypto.randomUUID();
    const nombreAlmacenado = `${uuid}${archivo.extension}`;
    const destino = rutaRadicada(radicado, uuid, archivo.extension);
    await almacen.mover(archivo.pathname, destino, env);
    guardados.push({
      nombreOriginal: archivo.nombreOriginal,
      nombreAlmacenado,
      ruta: destino,
      mimeType: archivo.mime,
      tamano: archivo.tamano,
    });
  }

  // Lo que quede en la sesión (un blob que no se anunció, por ejemplo) se borra.
  await almacen.borrarSesion(prefijoSesion(datos.sessionId), env);

  // --- 6. Registro ----------------------------------------------------------
  const sal = env.PQRS_IP_SALT;
  const registro: RegistroPqrs = {
    radicado,
    fecha: ahora.toISOString(),
    tipo: datos.tipo,
    nombre: datos.nombre,
    documento: datos.documento,
    telefono: datos.telefono,
    correo: datos.correo,
    municipio: datos.municipio,
    descripcion: datos.descripcion,
    autorizacion: datos.autorizacion,
    ipHash: await hashIp(ip, sal),
    ipHashSalada: Boolean(sal),
    adjuntos: guardados,
  };

  try {
    await almacen.guardarJson(rutaSolicitud(radicado), registro, env);
  } catch (fallo) {
    // Sin registro no hay constancia: esto sí es un fallo del servidor. El
    // motivo técnico va al registro de Vercel, no a la respuesta.
    console.error('[pqrs] no se pudo guardar solicitud.json:', (fallo as Error).message);
    return error(
      500,
      'No pudimos guardar la solicitud. Vuelve a intentarlo o escríbenos por WhatsApp.',
    );
  }

  // --- 7. Correos -----------------------------------------------------------
  /*
   * Cada adjunto va con un enlace a /api/pqrs/descarga, firmado y válido 7
   * días. El store es privado: la URL del blob a secas no abre nada. El origen
   * sale de la propia petición, así el enlace apunta al despliegue que radicó.
   */
  const origen = new URL(peticion.url).origin;
  const vence = ahora.getTime() + MINUTOS_ENLACE_DESCARGA * 60 * 1000;
  const paraCorreo: AdjuntoParaCorreo[] = [];
  for (const adjunto of guardados) {
    paraCorreo.push({
      nombreOriginal: adjunto.nombreOriginal,
      tamano: adjunto.tamano,
      enlace: await enlaceDescarga(origen, adjunto.ruta, vence, env),
    });
  }

  const correo = await enviarCorreos(registro, paraCorreo, fechaLegible(new Date(vence)), env);
  if (correo.errores.length > 0) {
    console.error(`[pqrs] ${radicado}: ${correo.errores.join(' | ')}`);
  }

  return {
    estado: 201,
    cuerpo: {
      ok: true,
      radicado,
      fecha: fechaLegible(ahora),
      correoArea: correo.destinoOk,
      constancia: correo.constancia,
    },
  };
}

// --- Revisión de los adjuntos ------------------------------------------------

interface ArchivoRevisado {
  pathname: string;
  nombreOriginal: string;
  extension: string;
  mime: string;
  tamano: number;
}

type Revision = { ok: true; archivos: ArchivoRevisado[] } | { ok: false; errores: string[] };

async function revisarAdjuntos(datos: SolicitudValidada, env: Entorno): Promise<Revision> {
  /*
   * Aquí había un atajo: los tipos que no eran Queja ni Reclamo salían sin
   * revisar nada y sus adjuntos se descartaban. Ya no existe, porque los cinco
   * tipos de la categoría comercial admiten soporte. El `tipo` ya viene
   * validado contra `TIPOS_VALIDOS` por `validarSolicitud`, así que todo lo que
   * llega hasta aquí es una solicitud con derecho a adjuntar.
   */
  const tope = maxArchivos(env);
  if (datos.adjuntos.length > tope) {
    return { ok: false, errores: [`Solo puedes adjuntar ${tope} archivos.`] };
  }

  const prefijo = prefijoSesion(datos.sessionId);
  const errores: string[] = [];
  const archivos: ArchivoRevisado[] = [];
  const vistos = new Set<string>();

  for (const adjunto of datos.adjuntos) {
    // El pathname tiene que estar dentro de la carpeta de ESTA sesión. Sin esto
    // se podría anunciar el blob de la sesión de otra persona y quedárselo.
    if (!adjunto.pathname.startsWith(prefijo) || adjunto.pathname.includes('..')) {
      errores.push('Uno de los archivos no pertenece a esta sesión de subida.');
      continue;
    }
    if (vistos.has(adjunto.pathname)) {
      errores.push('Un archivo llegó repetido.');
      continue;
    }
    vistos.add(adjunto.pathname);

    // Peso según el almacenamiento, no según lo que dijo el navegador.
    const info = await almacen.metadatos(adjunto.pathname, env);
    if (!info) {
      errores.push(`No encontramos el archivo «${adjunto.nombreOriginal}» en el almacenamiento.`);
      continue;
    }
    if (info.tamano > maxBytes(env)) {
      errores.push(`«${adjunto.nombreOriginal}»: supera el máximo de ${maxMb(env)} MB.`);
      continue;
    }

    const bytes = await almacen.descargar(adjunto.pathname, env);
    if (!bytes) {
      errores.push(`No pudimos leer el archivo «${adjunto.nombreOriginal}».`);
      continue;
    }

    // Aquí es donde se comprueba de verdad qué es el archivo: los mismos bytes
    // mágicos que revisó el navegador, ahora sobre el contenido ya subido.
    const resultado = await validarArchivo(
      {
        nombre: adjunto.nombreOriginal,
        tamano: bytes.length,
        leer: async (inicio, fin) => bytes.subarray(inicio, Math.min(fin, bytes.length)),
      },
      { maxMb: maxMb(env) },
    );

    if (!resultado.ok) {
      errores.push(resultado.error);
      continue;
    }

    archivos.push({
      pathname: adjunto.pathname,
      nombreOriginal: resultado.nombreSeguro,
      extension: resultado.extension,
      mime: resultado.mime,
      tamano: bytes.length,
    });
  }

  if (errores.length > 0) return { ok: false, errores };
  return { ok: true, archivos };
}

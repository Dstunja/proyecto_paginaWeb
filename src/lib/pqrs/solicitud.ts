/**
 * Validación de los campos de texto de una PQRS y forma del registro que se
 * guarda en `pqrs/{radicado}/solicitud.json`.
 *
 * No toca red ni almacenamiento: entra un objeto sin tipar (lo que llegó por
 * JSON) y sale un objeto validado o una lista de errores en español. Eso lo
 * hace fácil de probar y deja los endpoints como pura fontanería.
 */
import { normalizar, requiereSoporte } from '../adjuntos';
import { esSessionIdValido } from './config';

/** Los cinco tipos que ofrece el formulario, normalizados. */
export const TIPOS_VALIDOS = [
  'peticion',
  'queja',
  'reclamo',
  'sugerencia',
  'felicitacion',
] as const;

export interface AdjuntoAnunciado {
  /** URL que devolvió `upload()` en el navegador. */
  url: string;
  /** Ruta dentro del store. Es lo que se valida contra el sessionId. */
  pathname: string;
  nombreOriginal: string;
  tamano: number;
}

export interface SolicitudValidada {
  tipo: string;
  tipoNormalizado: string;
  nombre: string;
  documento: string;
  telefono: string;
  correo: string;
  municipio: string;
  descripcion: string;
  autorizacion: true;
  sessionId: string;
  turnstileToken: string;
  adjuntos: AdjuntoAnunciado[];
  /** `false` para Petición, Sugerencia y Felicitación. */
  admiteSoporte: boolean;
}

export type ResultadoSolicitud =
  | { ok: true; datos: SolicitudValidada }
  | { ok: false; errores: string[] };

/** Registro que se guarda como solicitud.json. */
export interface RegistroPqrs {
  radicado: string;
  fecha: string;
  tipo: string;
  nombre: string;
  documento: string;
  telefono: string;
  correo: string;
  municipio: string;
  descripcion: string;
  autorizacion: boolean;
  /** SHA-256 de la IP con sal. Nunca la IP en claro. */
  ipHash: string;
  /** `false` avisa de que no había PQRS_IP_SALT configurada. */
  ipHashSalada: boolean;
  adjuntos: Array<{
    nombreOriginal: string;
    nombreAlmacenado: string;
    ruta: string;
    mimeType: string;
    tamano: number;
  }>;
}

const LIMITES = {
  nombre: 150,
  documento: 30,
  telefono: 30,
  correo: 150,
  municipio: 100,
  descripcion: 5000,
} as const;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Quita caracteres de control: no aportan nada y ensucian correo y JSON. */
function limpiar(valor: string): string {
  let salida = '';
  for (const caracter of valor) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo < 0x20 || codigo === 0x7f) continue;
    salida += caracter;
  }
  return salida;
}

const FORMA_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Comprueba el cuerpo JSON que manda el formulario.
 *
 * Devuelve TODOS los errores encontrados, no solo el primero: si a alguien le
 * faltan tres campos, prefiere enterarse de los tres de una vez.
 */
export function validarSolicitud(cuerpo: unknown): ResultadoSolicitud {
  const errores: string[] = [];
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return { ok: false, errores: ['El cuerpo de la petición no es un objeto JSON.'] };
  }
  const datos = cuerpo as Record<string, unknown>;

  const tipo = limpiar(texto(datos.tipo));
  const tipoNormalizado = normalizar(tipo);
  if (!TIPOS_VALIDOS.some((t) => t === tipoNormalizado)) {
    errores.push('El tipo de solicitud no es uno de los que admite el formulario.');
  }

  const nombre = limpiar(texto(datos.nombre));
  if (nombre.length < 3) errores.push('El nombre completo es obligatorio.');
  else if (nombre.length > LIMITES.nombre) errores.push('El nombre es demasiado largo.');

  const documento = limpiar(texto(datos.documento)).slice(0, LIMITES.documento);

  const telefono = limpiar(texto(datos.telefono));
  const digitos = telefono.replace(/\D/g, '').replace(/^57/, '');
  if (digitos.length < 7 || digitos.length > 15) {
    errores.push('El teléfono debe tener entre 7 y 15 dígitos.');
  } else if (telefono.length > LIMITES.telefono) {
    errores.push('El teléfono es demasiado largo.');
  }

  const correo = limpiar(texto(datos.correo));
  if (!FORMA_CORREO.test(correo)) errores.push('El correo no tiene un formato válido.');
  else if (correo.length > LIMITES.correo) errores.push('El correo es demasiado largo.');

  const municipio = limpiar(texto(datos.municipio));
  if (municipio.length < 2) errores.push('El municipio es obligatorio.');
  else if (municipio.length > LIMITES.municipio) errores.push('El municipio es demasiado largo.');

  const descripcion = limpiar(texto(datos.descripcion));
  if (descripcion.length < 10) {
    errores.push('La descripción es obligatoria: cuéntanos qué pasó con algo de detalle.');
  } else if (descripcion.length > LIMITES.descripcion) {
    errores.push(`La descripción no puede pasar de ${LIMITES.descripcion} caracteres.`);
  }

  // La autorización de tratamiento de datos (Ley 1581 de 2012) es la única
  // casilla sin la que no se puede radicar: sin ella no hay base legal para
  // guardar el nombre, el documento ni el teléfono.
  if (datos.autorizacion !== true) {
    errores.push('Falta la autorización de tratamiento de datos personales.');
  }

  const sessionId = texto(datos.sessionId);
  if (!esSessionIdValido(sessionId)) {
    errores.push('La sesión de subida no es válida. Recarga la página e inténtalo de nuevo.');
  }

  const turnstileToken = texto(datos.turnstileToken);
  if (turnstileToken === '') {
    errores.push('Falta la comprobación antirrobots. Recarga la página e inténtalo de nuevo.');
  }

  const adjuntos = normalizarAdjuntos(datos.adjuntos, errores);

  if (errores.length > 0) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      tipo,
      tipoNormalizado,
      nombre,
      documento,
      telefono,
      correo,
      municipio,
      descripcion,
      autorizacion: true,
      sessionId,
      turnstileToken,
      adjuntos,
      admiteSoporte: requiereSoporte(tipo),
    },
  };
}

function normalizarAdjuntos(valor: unknown, errores: string[]): AdjuntoAnunciado[] {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    errores.push('La lista de adjuntos no es válida.');
    return [];
  }

  const salida: AdjuntoAnunciado[] = [];
  for (const bruto of valor) {
    if (typeof bruto !== 'object' || bruto === null) {
      errores.push('Uno de los adjuntos no es válido.');
      continue;
    }
    const item = bruto as Record<string, unknown>;
    const url = texto(item.url);
    const pathname = texto(item.pathname);
    const nombreOriginal = limpiar(texto(item.nombreOriginal)).slice(0, 255);
    const tamano = Number(item.tamano);

    if (url === '' || pathname === '') {
      errores.push('Uno de los adjuntos llegó sin ruta.');
      continue;
    }
    salida.push({
      url,
      pathname,
      nombreOriginal: nombreOriginal || 'archivo',
      tamano: Number.isFinite(tamano) && tamano > 0 ? Math.round(tamano) : 0,
    });
  }
  return salida;
}

/**
 * SHA-256 de la IP con sal.
 *
 * La IP se guarda por si hay que demostrar de dónde salió una radicación, pero
 * en claro sería un dato personal más del que responder. Con sal, además, no se
 * puede recorrer el espacio de direcciones IPv4 para deshacer el hash.
 */
export async function hashIp(ip: string, sal: string | undefined): Promise<string> {
  const datos = new TextEncoder().encode(`${sal ?? ''}:${ip}`);
  const resumen = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(resumen))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** IP del visitante según las cabeceras que pone Vercel. */
export function ipDePeticion(headers: Headers): string {
  const reenviada = headers.get('x-forwarded-for');
  if (reenviada) return reenviada.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? 'desconocida';
}

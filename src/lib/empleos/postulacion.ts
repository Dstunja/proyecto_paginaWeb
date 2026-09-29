/**
 * Validación del multipart que manda el formulario de Empleos.
 *
 * No toca red ni almacenamiento: entra el `FormData` de la petición y sale un
 * objeto validado, con los bytes de la hoja de vida ya comprobados, o una lista
 * de errores en español. Devuelve TODOS los errores, no solo el primero.
 *
 * Las reglas de texto (`texto`, `limpiar`, `FORMA_CORREO`) son las de la PQRS,
 * importadas y no copiadas, para que las dos páginas tengan una sola idea de
 * qué es un correo válido o de qué caracteres se quitan.
 */
import { FORMA_CORREO, limpiar, texto } from '../pqrs/solicitud';
import { esCargoValido } from './cargos';
import { CAMPO_HONEYPOT } from './config';
import { validarHojaDeVida } from './hoja-de-vida';

/** Nombres de los campos del multipart. Son los `name` del formulario. */
export const CAMPOS = {
  nombre: 'nombre',
  correo: 'correo',
  telefono: 'telefono',
  cargo: 'cargo',
  experiencia: 'experiencia',
  autorizacion: 'autorizacion',
  hojaDeVida: 'hoja-de-vida',
  turnstileToken: 'turnstileToken',
  /*
   * Marca que el navegador NO pudo resolver el reto de Turnstile y manda la
   * postulación igual. La pone el formulario solo después de haber reintentado
   * (ver src/lib/turnstile-cliente.ts); el servidor la acepta, la cuenta con un
   * límite mucho más estrecho y marca el correo «[SIN VERIFICAR]».
   */
  sinVerificar: 'sin_verificar',
  /** Código de Cloudflare del fallo, para el registro. Nunca se muestra solo. */
  turnstileCodigo: 'turnstileCodigo',
} as const;

/** Lo que manda el formulario en `sin_verificar` cuando el reto no se pudo pasar. */
const VALORES_SIN_VERIFICAR = new Set(['si', 'on', 'true', '1']);

/** Forma admitida de un código de Cloudflare: corto y sin nada raro dentro. */
const FORMA_CODIGO = /^[A-Za-z0-9_-]{1,24}$/;

export interface HojaDeVidaValidada {
  /** Nombre con tildes y espacios, para mostrar en el correo. */
  nombreOriginal: string;
  /** Nombre saneado, con el que viaja el adjunto. */
  nombreSeguro: string;
  /** MIME deducido del contenido, no del que declaró el navegador. */
  mime: string;
  extension: string;
  tamano: number;
  bytes: Uint8Array;
}

export interface PostulacionValidada {
  nombre: string;
  correo: string;
  telefono: string;
  cargo: string;
  /** Vacío si no escribió nada: el campo es opcional. */
  experiencia: string;
  autorizacion: true;
  turnstileToken: string;
  /**
   * Llegó sin token porque el navegador no pudo resolver el reto.
   *
   * Solo vale si ADEMÁS el token viene vacío: con las dos cosas a la vez no se
   * sabría qué creer, y la marca no puede servir para saltarse una verificación
   * que sí se pudo hacer.
   */
  sinVerificar: boolean;
  /** Código de Cloudflare del fallo, o cadena vacía. Solo para el registro. */
  codigoTurnstile: string;
  hojaDeVida: HojaDeVidaValidada;
}

export type ResultadoPostulacion =
  | { ok: true; datos: PostulacionValidada }
  | { ok: false; errores: string[] };

const LIMITES = {
  nombre: 150,
  correo: 150,
  telefono: 30,
  cargo: 100,
  experiencia: 3000,
} as const;

/** Lo que manda la casilla de autorización cuando está marcada. */
const VALORES_AUTORIZACION = new Set(['si', 'on', 'true']);

/** ¿Rellenó el campo trampa? Solo un robot lo hace. */
export function esRobot(formulario: FormData): boolean {
  const valor = formulario.get(CAMPO_HONEYPOT);
  return typeof valor === 'string' && valor.trim() !== '';
}

/** Un archivo del multipart: en Node y en el navegador es un `File`. */
function esArchivo(valor: unknown): valor is File {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as File).arrayBuffer === 'function' &&
    typeof (valor as File).name === 'string' &&
    typeof (valor as File).size === 'number'
  );
}

export async function validarPostulacion(formulario: FormData): Promise<ResultadoPostulacion> {
  const errores: string[] = [];

  const nombre = limpiar(texto(formulario.get(CAMPOS.nombre)));
  if (nombre.length < 3) errores.push('El nombre completo es obligatorio.');
  else if (nombre.length > LIMITES.nombre) errores.push('El nombre es demasiado largo.');

  const correo = limpiar(texto(formulario.get(CAMPOS.correo)));
  if (!FORMA_CORREO.test(correo)) errores.push('El correo no tiene un formato válido.');
  else if (correo.length > LIMITES.correo) errores.push('El correo es demasiado largo.');

  const telefono = limpiar(texto(formulario.get(CAMPOS.telefono)));
  // El "57" inicial se descuenta para que un número escrito con indicativo no
  // parezca de más dígitos de los que tiene.
  const digitos = telefono.replace(/\D/g, '').replace(/^57/, '');
  if (digitos.length < 7 || digitos.length > 15) {
    errores.push('El teléfono debe tener entre 7 y 15 dígitos.');
  } else if (telefono.length > LIMITES.telefono) {
    errores.push('El teléfono es demasiado largo.');
  }

  const cargo = limpiar(texto(formulario.get(CAMPOS.cargo)));
  if (cargo.length === 0) errores.push('Elige el cargo al que te postulas.');
  else if (cargo.length > LIMITES.cargo || !esCargoValido(cargo)) {
    errores.push(
      'El cargo no es uno de los que ofrece el formulario. Recarga la página e inténtalo de nuevo.',
    );
  }

  // Opcional: con la hoja de vida adjunta, el relato es un complemento.
  const experiencia = limpiar(texto(formulario.get(CAMPOS.experiencia)));
  if (experiencia.length > LIMITES.experiencia) {
    errores.push(
      `El texto sobre tu experiencia no puede pasar de ${LIMITES.experiencia} caracteres.`,
    );
  }

  // La autorización de tratamiento de datos (Ley 1581 de 2012) es la única
  // casilla sin la que no se puede enviar: sin ella no hay base legal para
  // guardar el nombre, el teléfono ni la hoja de vida.
  const autorizacion = texto(formulario.get(CAMPOS.autorizacion)).toLowerCase();
  if (!VALORES_AUTORIZACION.has(autorizacion)) {
    errores.push('Falta la autorización de tratamiento de datos personales.');
  }

  const turnstileToken = texto(formulario.get(CAMPOS.turnstileToken));

  // La marca solo cuenta si NO vino token: si vino, se verifica y punto. Así
  // nadie puede mandar un token cualquiera y la marca a la vez para elegir por
  // qué puerta entra.
  const marca = texto(formulario.get(CAMPOS.sinVerificar)).toLowerCase();
  const sinVerificar = turnstileToken === '' && VALORES_SIN_VERIFICAR.has(marca);

  // El código viaja para el registro. Se filtra por forma porque acaba escrito
  // en el registro de Vercel y en el asunto de un correo: nada que no sea un
  // código corto entra.
  const codigoBruto = texto(formulario.get(CAMPOS.turnstileCodigo));
  const codigoTurnstile = FORMA_CODIGO.test(codigoBruto) ? codigoBruto : '';

  const hojaDeVida = await revisarHojaDeVida(formulario.get(CAMPOS.hojaDeVida), errores);

  if (errores.length > 0 || !hojaDeVida) {
    return { ok: false, errores };
  }

  return {
    ok: true,
    datos: {
      nombre,
      correo,
      telefono,
      cargo,
      experiencia,
      autorizacion: true,
      turnstileToken,
      sinVerificar,
      codigoTurnstile,
      hojaDeVida,
    },
  };
}

/**
 * Lee los bytes UNA vez y los valida con las mismas reglas que el navegador.
 *
 * El `type` que declara el navegador se ignora: lo pone quien sube el archivo.
 * Lo que decide es el contenido.
 */
async function revisarHojaDeVida(
  valor: FormDataEntryValue | null,
  errores: string[],
): Promise<HojaDeVidaValidada | null> {
  if (!esArchivo(valor) || valor.size === 0 || valor.name === '') {
    errores.push('La hoja de vida es obligatoria: adjúntala en PDF, DOC o DOCX.');
    return null;
  }

  const bytes = new Uint8Array(await valor.arrayBuffer());
  const resultado = await validarHojaDeVida({
    nombre: valor.name,
    tamano: bytes.length,
    leer: async (inicio, fin) => bytes.subarray(inicio, Math.min(fin, bytes.length)),
  });

  if (!resultado.ok) {
    errores.push(resultado.error);
    return null;
  }

  return {
    nombreOriginal: limpiar(valor.name).slice(0, 255) || resultado.nombreSeguro,
    nombreSeguro: resultado.nombreSeguro,
    mime: resultado.mime,
    extension: resultado.extension,
    tamano: bytes.length,
    bytes,
  };
}

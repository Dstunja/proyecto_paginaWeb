/**
 * El trabajo de POST /api/empleos/postular, separado del endpoint para poder
 * probarlo sin levantar un servidor.
 *
 * QUÉ HACE. Recibe el formulario de /empleos/ como multipart (los campos de
 * texto y la hoja de vida), lo valida, comprueba que no es un robot y manda UN
 * correo a Talento Humano con la hoja de vida adjunta.
 *
 * LA REGLA QUE MANDA SOBRE TODAS: una persona que llenó el formulario y adjuntó
 * su hoja de vida NO se puede quedar sin postular. De ahí salen las tres
 * decisiones raras de este archivo, y conviene leerlas juntas:
 *
 *  1. SE ACEPTAN POSTULACIONES SIN VERIFICAR. Si el navegador del candidato no
 *     pudo resolver el reto de Turnstile —un WebView de WhatsApp, un bloqueador,
 *     un teléfono viejo— el formulario la manda igual con la marca
 *     `sin_verificar` y sin token. Aquí se acepta, pero con un límite por IP
 *     mucho más estrecho (`LIMITE_SIN_VERIFICAR`) y marcando el asunto del
 *     correo «[SIN VERIFICAR]», para que Talento Humano la lea con criterio.
 *     Es un intercambio consciente: esa puerta también la puede usar un robot, y
 *     la defensa que queda es el campo trampa, la validación de los campos, la
 *     firma real del archivo y ese límite. Si un día entra basura, lo que hay
 *     que mirar es el contador de `aceptada:sin-verificar` en el registro.
 *
 *  2. EL CORREO SE REINTENTA. Un 429 de Resend (su plan gratuito los da cuando
 *     llegan varias postulaciones seguidas) es un fallo que se arregla esperando
 *     un segundo, no una postulación perdida.
 *
 *  3. SI EL CORREO NO SALE, LA HOJA DE VIDA SE GUARDA EN EL BLOB, y con ella un
 *     registro de los datos del formulario (./almacen.ts). Solo entonces se le
 *     dice al candidato que su postulación quedó. Antes se le abría el gestor de
 *     correo para que la adjuntara otra vez a mano, cosa que en el celular
 *     muchas veces ni siquiera abría nada. Guardada la hoja de vida, se intenta
 *     un último correo SIN adjunto y con el enlace firmado al archivo.
 *
 * ORDEN DE LAS COMPROBACIONES: primero lo barato y local (forma del cuerpo,
 * campo trampa, campos y bytes del archivo), luego el límite por IP, después
 * Turnstile y solo al final Resend, que son llamadas de red. Un 400 llega sin
 * gastar un token de Turnstile, que es de un solo uso.
 *
 * POR QUÉ EL ARCHIVO PASA POR LA FUNCIÓN y no por Vercel Blob como en PQRS: en
 * el camino normal no hay que conservarlo, así que subirlo para bajarlo,
 * adjuntarlo y borrarlo sería dar tres pasos para no guardar nada. El precio es
 * el tope de 4,5 MB de cuerpo de una función de Vercel, y por eso la hoja de
 * vida se limita a 4 MB (src/lib/empleos/hoja-de-vida.ts).
 */
import { MINUTOS_ENLACE_DESCARGA, blobConfigurado } from '../pqrs/config';
import { enlaceDescarga } from '../pqrs/descarga';
import { hayUpstash, limitar } from '../pqrs/limite-tasa';
import { ipDePeticion } from '../pqrs/solicitud';
import { verificarTurnstile } from '../pqrs/turnstile';
import { guardarPostulacion } from './almacen';
import {
  LIMITE_POSTULACIONES,
  LIMITE_POSTULACIONES_MEMORIA,
  LIMITE_SIN_VERIFICAR,
  combinacionArriesgada,
  type Entorno,
} from './config';
import { enviarConReintentos } from './correo';
import { huellaHojaDeVida } from './huella';
import { esRobot, validarPostulacion, type PostulacionValidada } from './postulacion';

/** Ruta pública de la función que abre una hoja de vida guardada. */
const RUTA_DESCARGA_EMPLEOS = '/api/empleos/descarga';

export interface RespuestaPostulacion {
  estado: number;
  cuerpo:
    | {
        ok: true;
        /**
         * Identificador de la postulación guardada en el Blob. SOLO va cuando el
         * correo no salió y la postulación se salvó por escrito: es lo que el
         * candidato puede citar si llama a preguntar. En el camino normal no
         * existe, porque no hay nada que citar: el correo ya está en la bandeja.
         */
        referencia?: string;
      }
    | { ok: false; errores: string[]; codigo?: string };
}

function error(estado: number, codigo: string, ...errores: string[]): RespuestaPostulacion {
  return { estado, cuerpo: { ok: false, errores, codigo } };
}

/**
 * Una línea por postulación en el registro de Vercel, SIN datos personales.
 *
 * El registro es el único rastro que queda de un envío que no llegó. Antes solo
 * se escribía una línea, la del fallo de Resend, así que en los registros no se
 * podía distinguir un rechazo de seguridad (403) de uno de campos (400), de un
 * límite por IP (429) o de un envío que salió bien; tampoco se veía cuántas
 * postulaciones morían en el campo trampa, que responde 200 y no manda nada.
 * Sin esos números no se puede decir si un fallo intermitente es del antirrobots,
 * del servidor o del correo, que es justo lo que hay que separar.
 *
 * NO SE ESCRIBE NADA QUE IDENTIFIQUE A LA PERSONA: ni nombre, ni correo, ni
 * teléfono, ni el nombre del archivo, ni la IP, ni la huella. Solo el desenlace,
 * el cargo (que es una lista cerrada y pública) y unos tamaños, que es lo que
 * hace falta para contar y para cruzar con los paneles de Cloudflare y de
 * Resend.
 */
function registrar(desenlace: string, detalle: Record<string, unknown> = {}): void {
  console.log(`[empleos/postular] ${desenlace}`, JSON.stringify(detalle));
}

/**
 * Qué límite se aplica y con qué clave.
 *
 * Tres políticas, y lo que las separa es cuánta confianza merece el contador que
 * hay debajo (ver los comentarios de ./config.ts):
 *
 *  - SIN VERIFICAR: el más estrecho, siempre, haya Upstash o no.
 *  - CON UPSTASH: el contador es compartido entre instancias y la clave puede
 *    ser la IP a secas, que es lo que de verdad limita a un robot.
 *  - SIN UPSTASH (hoy, en producción): el contador vive en la memoria de cada
 *    instancia y no frena a nadie decidido, así que lo único que puede hacer es
 *    no estorbar. Tope más alto y clave por IP MÁS huella del archivo, para no
 *    contar como uno solo a veinte candidatos del mismo operador móvil.
 */
function politicaDeLimite(
  datos: PostulacionValidada,
  ip: string,
  huella: string,
  env: Entorno,
): { limite: typeof LIMITE_POSTULACIONES; clave: string; politica: string } {
  if (datos.sinVerificar) {
    return { limite: LIMITE_SIN_VERIFICAR, clave: `${ip}:${huella}`, politica: 'sin-verificar' };
  }
  if (hayUpstash(env)) {
    return { limite: LIMITE_POSTULACIONES, clave: ip, politica: 'ip' };
  }
  return { limite: LIMITE_POSTULACIONES_MEMORIA, clave: `${ip}:${huella}`, politica: 'ip-huella' };
}

/**
 * @param dormir  cómo se esperan las pausas entre reintentos de correo.
 *                Inyectable solo para que las pruebas no tarden dos segundos de
 *                reloj en cada caso de fallo; el endpoint no lo pasa.
 */
export async function atenderPostulacion(
  peticion: Request,
  env: Entorno,
  dormir?: (ms: number) => Promise<void>,
): Promise<RespuestaPostulacion> {
  // --- 1. Cuerpo ------------------------------------------------------------
  const tipo = (peticion.headers.get('content-type') ?? '').toLowerCase();
  if (!tipo.startsWith('multipart/form-data')) {
    registrar('rechazo:cuerpo-no-multipart');
    return error(400, 'E-CUERPO', 'El formulario debe enviarse como multipart/form-data.');
  }

  let formulario: FormData;
  try {
    formulario = await peticion.formData();
  } catch {
    registrar('rechazo:multipart-ilegible');
    return error(
      400,
      'E-CUERPO',
      'No pudimos leer el formulario. Recarga la página e inténtalo de nuevo.',
    );
  }

  // --- 2. Campo trampa ------------------------------------------------------
  // Un robot que rellenó el campo oculto recibe un 200 vacío: no se le dice qué
  // lo delató y no se gasta ni una llamada de red en él.
  if (esRobot(formulario)) {
    // Se registra porque es el único desenlace que la persona ve como un envío
    // correcto sin que salga ningún correo: si alguna vez un gestor de
    // contraseñas rellenara el campo, esta línea sería la única forma de saberlo.
    registrar('rechazo:campo-trampa');
    return { estado: 200, cuerpo: { ok: true } };
  }

  // --- 3. Campos y hoja de vida ---------------------------------------------
  const validacion = await validarPostulacion(formulario);
  if (!validacion.ok) {
    registrar('rechazo:campos', { errores: validacion.errores.length });
    return error(400, 'E-DATOS', ...validacion.errores);
  }
  const datos = validacion.datos;

  const ip = ipDePeticion(peticion.headers);
  const huella = await huellaHojaDeVida(datos.hojaDeVida);

  // --- 4. Límite de tasa ----------------------------------------------------
  const { limite, clave, politica } = politicaDeLimite(datos, ip, huella, env);
  const veredicto = await limitar(clave, limite, env);
  if (!veredicto.ok) {
    registrar('rechazo:limite-por-ip', {
      politica,
      motor: veredicto.motor,
      segundosEspera: veredicto.segundosEspera,
      sinVerificar: datos.sinVerificar,
    });
    const minutos = Math.ceil(veredicto.segundosEspera / 60);
    return error(
      429,
      'E-LIMITE',
      `Has enviado varias postulaciones seguidas. Espera ${minutos} minuto${minutos === 1 ? '' : 's'} e inténtalo de nuevo.`,
    );
  }

  // --- 5. Turnstile ---------------------------------------------------------
  if (datos.sinVerificar) {
    // No hay token que verificar: el navegador no pudo conseguirlo y lo dijo.
    // Entra por la puerta estrecha y sale marcada en el correo.
    registrar('aceptada:sin-verificar', { codigo: datos.codigoTurnstile || 'sin-codigo' });
  } else {
    const antirrobots = await verificarTurnstile(datos.turnstileToken, ip, env);
    if (!antirrobots.ok) {
      // Los códigos son los de Cloudflare (`invalid-input-response`,
      // `timeout-or-duplicate`…): con ellos la línea se cruza con el panel del
      // widget sin guardar el token ni la IP.
      registrar('rechazo:turnstile', { codigos: antirrobots.codigos ?? [] });
      return error(
        403,
        `T-${(antirrobots.codigos?.[0] ?? 'rechazado').slice(0, 24)}`,
        antirrobots.error ?? 'La comprobación antirrobots no pasó.',
      );
    }
  }

  // Aviso de configuración: con el remitente de pruebas, Resend solo entrega al
  // titular de la cuenta, así que un EMPLEOS_DESTINO distinto falla siempre.
  if (combinacionArriesgada(env)) {
    console.warn(
      '[empleos/postular] EMPLEOS_DESTINO no es el buzón por defecto y el remitente sigue siendo el de pruebas de Resend: los envíos van a fallar hasta verificar el dominio.',
    );
  }

  // --- 6. Correo, con reintentos --------------------------------------------
  const envio = await enviarConReintentos(datos, env, {}, new Date(), dormir);
  if (envio.ok) {
    registrar('enviada', {
      cargo: datos.cargo,
      bytesHojaDeVida: datos.hojaDeVida.tamano,
      extension: datos.hojaDeVida.extension,
      sinVerificar: datos.sinVerificar,
      intentos: envio.intentos,
      motorLimite: veredicto.motor,
    });
    return { estado: 200, cuerpo: { ok: true } };
  }

  console.error('[empleos/postular] no se pudo enviar el correo:', envio.error);

  // --- 7. Red de seguridad: guardar la hoja de vida -------------------------
  return ponerASalvo(datos, peticion, env, envio.error ?? 'desconocido', dormir);
}

/**
 * El correo no salió: se guarda la postulación y se intenta avisar con enlace.
 *
 * Devuelve 200 si la postulación quedó guardada, aunque el aviso tampoco salga:
 * la hoja de vida ya no se puede perder, y decirle al candidato que lo intente
 * otra vez solo conseguiría una copia más del mismo archivo. Devuelve 500 solo
 * cuando no hay dónde guardarla, que es el único caso en que de verdad no queda
 * nada.
 */
async function ponerASalvo(
  datos: PostulacionValidada,
  peticion: Request,
  env: Entorno,
  motivoCorreo: string,
  dormir?: (ms: number) => Promise<void>,
): Promise<RespuestaPostulacion> {
  if (!blobConfigurado(env)) {
    // Sin Blob no hay red de seguridad: ni correo ni copia. Es el único camino
    // que todavía pierde una postulación, y por eso el token del store pasa a
    // ser obligatorio en docs/EMPLEOS-POSTULACION.md.
    registrar('fallo:correo-sin-respaldo', { motivo: motivoCorreo.slice(0, 120) });
    return error(
      500,
      'E-CORREO',
      'No pudimos enviar tu postulación en este momento. Inténtalo de nuevo en unos minutos o escríbenos por WhatsApp.',
    );
  }

  const guardado = await guardarPostulacion(datos, env);
  if (!guardado.ok) {
    registrar('fallo:correo-y-respaldo', {
      motivoCorreo: motivoCorreo.slice(0, 120),
      motivoRespaldo: guardado.error.slice(0, 120),
    });
    return error(
      500,
      'E-GUARDADO',
      'No pudimos enviar tu postulación en este momento. Inténtalo de nuevo en unos minutos o escríbenos por WhatsApp.',
    );
  }

  const { id, rutaHojaDeVida } = guardado.guardada;

  // Último intento: sin adjunto y con el enlace. Si lo que hacía fallar el envío
  // era el peso del archivo, este sí sale.
  let enlace: string | undefined;
  try {
    const origen = new URL(peticion.url).origin;
    const vence = Date.now() + MINUTOS_ENLACE_DESCARGA * 60 * 1000;
    enlace = await enlaceDescarga(origen, rutaHojaDeVida, vence, env, RUTA_DESCARGA_EMPLEOS);
  } catch (fallo) {
    console.error('[empleos/postular] no se pudo firmar el enlace:', (fallo as Error).message);
  }

  const aviso = await enviarConReintentos(
    datos,
    env,
    { sinAdjunto: true, enlace, id },
    new Date(),
    dormir,
  );

  if (aviso.ok) {
    registrar('enviada:con-enlace', {
      cargo: datos.cargo,
      bytesHojaDeVida: datos.hojaDeVida.tamano,
      sinVerificar: datos.sinVerificar,
      motivoAdjunto: motivoCorreo.slice(0, 120),
    });
    return { estado: 200, cuerpo: { ok: true } };
  }

  /*
   * Ni con adjunto ni con enlace. La postulación EXISTE —está en el Blob, con su
   * registro— pero nadie en Talento Humano se ha enterado todavía. Va como error
   * al registro, no como aviso: alguien tiene que entrar al store a buscarla.
   */
  console.error(
    `[empleos/postular] postulación ${id} guardada en el Blob pero SIN avisar por correo:`,
    aviso.error,
  );
  registrar('guardada:sin-correo', {
    id,
    cargo: datos.cargo,
    bytesHojaDeVida: datos.hojaDeVida.tamano,
    sinVerificar: datos.sinVerificar,
  });
  return { estado: 200, cuerpo: { ok: true, referencia: id } };
}

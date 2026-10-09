// AUTORIZACIÓN DE DATOS DE LA POSTULACIÓN — el texto exacto que acepta el candidato, con su versión.
//
// Por qué existe: Control360 guarda, con cada postulación, la versión y la huella (sha256) del
//   texto de autorización que la persona aceptó. Eso solo prueba algo si el texto que se le
//   ENSEÑA en el formulario es exactamente el que Control360 tiene registrado con esa versión.
// Dónde corre: navegador (FormularioEmpleo.astro lo muestra) y servidor (control360.ts envía la versión).
// Cuidados: es COPIA LITERAL de AUTORIZACION_TEXTOS["v2-2026-10"] en Control360
//   (src/features/talento/postulaciones/autorizacion-texto.ts). No se edita aquí: un cambio de una
//   sola coma es una versión nueva, y se agrega primero en Control360 y después aquí, con su número.
//   control360.test.ts compara la huella para que una edición accidental no pase en silencio.
//   Historial: v1-2026-09 (sept 2026) → v2-2026-10 (9·10, decisión de Samuel): nombre y NIT del
//   responsable, finalidad completa, proveedores tecnológicos fuera de Colombia (la sugerencia con
//   IA de Control360), correo para ejercer derechos, conservación y referencia a /privacidad/.
//   Pendiente de revisión de Tatiana (abogada); si cambia algo, nace la v3.

/** La versión que se envía a Control360 junto con la postulación. */
export const AUTORIZACION_VERSION = 'v2-2026-10';

/** El texto, tal cual lo tiene Control360. Los párrafos van separados por una línea en blanco. */
export const AUTORIZACION_TEXTO = [
  'Autorizo de manera previa, expresa e informada a DISTRIBUCIONES SANTIAGO DE TUNJA S.A.S, ',
  'NIT 900.417.808-1, como responsable del tratamiento, para recolectar, almacenar, usar y ',
  'suprimir mis datos personales y los documentos que adjunto (incluida mi hoja de vida), con la ',
  'finalidad de evaluar mi postulación, contactarme, gestionar el proceso de selección y, si soy ',
  'contratado, adelantar mi vinculación.\n\n',
  'Para evaluar mi perfil, la empresa puede apoyarse en herramientas de análisis automatizado ',
  'de proveedores tecnológicos ubicados fuera de Colombia (por ejemplo, en Estados Unidos), que ',
  'tratan mis datos solo para ese fin y no los usan para otros propósitos. La decisión final ',
  'siempre la toma una persona de Talento Humano.\n\n',
  'Declaro que los datos que entrego son veraces y que los entrego de forma voluntaria. ',
  'Conozco que no estoy obligado a autorizar el tratamiento de datos sensibles.\n\n',
  'Puedo conocer, actualizar, rectificar y suprimir mis datos, y revocar esta autorización, ',
  'escribiendo a ghsantiagodetunja@gmail.com. Mis datos se conservarán mientras dure el proceso ',
  'de selección y, si no soy contratado, hasta por dos (2) años más para considerarme en ',
  'vacantes futuras, salvo que solicite su supresión antes.\n\n',
  'Esta autorización se otorga conforme a la Ley 1581 de 2012, al Decreto 1074 de 2015 y a la ',
  'Política de Tratamiento de Datos Personales de DISTRIBUCIONES SANTIAGO DE TUNJA S.A.S, ',
  'publicada en dstunja.com/privacidad.',
].join('');

/** La huella que Control360 calcula de ese mismo texto (sha256 en hexadecimal, sobre UTF-8). */
export const AUTORIZACION_SHA256 = 'e1e950999901f0bb848f4594da01289f372f6985078fb9c5373f5dd7d79e62d8';

/**
 * La versión anterior, solo como registro: Control360 la sigue aceptando durante la transición,
 * pero esta página ya no la muestra ni la envía. Su huella era
 * 716e1393da91e1139631a60b809156ef4394d21db822eb70ef3492ba238d0a0b.
 */
export const AUTORIZACION_VERSION_ANTERIOR = 'v1-2026-09';

/** El texto en párrafos, para pintarlo en el formulario. */
export const AUTORIZACION_PARRAFOS: readonly string[] = AUTORIZACION_TEXTO.split('\n\n');

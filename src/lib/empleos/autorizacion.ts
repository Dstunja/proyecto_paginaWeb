// AUTORIZACIÓN DE DATOS DE LA POSTULACIÓN — el texto exacto que acepta el candidato, con su versión.
//
// Por qué existe: Control360 guarda, con cada postulación, la versión y la huella (sha256) del
//   texto de autorización que la persona aceptó. Eso solo prueba algo si el texto que se le
//   ENSEÑA en el formulario es exactamente el que Control360 tiene registrado con esa versión.
// Dónde corre: navegador (FormularioEmpleo.astro lo muestra) y servidor (control360.ts envía la versión).
// Cuidados: es COPIA LITERAL de AUTORIZACION_TEXTOS["v1-2026-09"] en Control360
//   (src/features/talento/postulaciones/autorizacion-texto.ts). No se edita aquí: un cambio de una
//   sola coma es una versión nueva, y se agrega primero en Control360 y después aquí, con su número.
//   autorizacion.test.ts compara la huella para que una edición accidental no pase en silencio.

/** La versión que se envía a Control360 junto con la postulación. */
export const AUTORIZACION_VERSION = 'v1-2026-09';

/** El texto, tal cual lo tiene Control360. Los párrafos van separados por una línea en blanco. */
export const AUTORIZACION_TEXTO = [
  'Autorizo de manera previa, expresa e informada a Distribuciones Santiago de Tunja S.A.S. ',
  'para recolectar, almacenar, usar y suprimir mis datos personales y los documentos que adjunto ',
  '(incluida mi hoja de vida), con la finalidad exclusiva de adelantar el proceso de selección al ',
  'que me postulo y considerarme en futuras vacantes.\n\n',
  'Declaro que los datos que entrego son veraces y que los entrego de forma voluntaria. ',
  'Conozco que no estoy obligado a autorizar el tratamiento de datos sensibles y que ninguna ',
  'decisión sobre mi postulación se tomará de forma automatizada sin intervención humana.\n\n',
  'Conozco que puedo conocer, actualizar, rectificar y suprimir mis datos, y revocar esta ',
  'autorización, escribiendo a la Distribuciones Santiago de Tunja S.A.S. como responsable del ',
  'tratamiento. Mis datos se conservarán mientras dure el proceso de selección y hasta por dos ',
  '(2) años más para considerarme en vacantes futuras, salvo que solicite su supresión antes.\n\n',
  'Esta autorización se otorga conforme a la Ley 1581 de 2012 y al Decreto 1074 de 2015.',
].join('');

/** La huella que Control360 calcula de ese mismo texto (sha256 en hexadecimal, sobre UTF-8). */
export const AUTORIZACION_SHA256 = '716e1393da91e1139631a60b809156ef4394d21db822eb70ef3492ba238d0a0b';

/** El texto en párrafos, para pintarlo en el formulario. */
export const AUTORIZACION_PARRAFOS: readonly string[] = AUTORIZACION_TEXTO.split('\n\n');

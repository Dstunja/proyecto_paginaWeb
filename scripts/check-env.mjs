/**
 * Comprueba las variables de entorno antes de arrancar en local.
 *
 * POR QUÉ EXISTE. La radicación de PQRS se apoya en cuatro servicios (Blob,
 * Resend, Turnstile y, si se quiere, Upstash) y cada uno tiene su variable.
 * Cuando falta una, el síntoma que llega al navegador es siempre el mismo
 * mensaje opaco del SDK de turno. Pasó en producción: `BLOB_READ_WRITE_TOKEN`
 * no estaba definida y lo único que se veía era "Vercel Blob: Failed to
 * retrieve the client token", sin ninguna pista de que faltaba una variable.
 *
 * NO IMPRIME NINGÚN VALOR, ni recortado. Solo dice si la variable está, si
 * tiene la forma esperada y dónde se consigue.
 *
 * Uso:
 *   npm run check:env
 *
 * Lee, en este orden y sin pisar lo ya definido: el entorno del proceso,
 * `.env.local` (que es donde escribe `vercel env pull`) y `.env`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();

// --- Lectura de los .env ----------------------------------------------------

/**
 * Analizador mínimo de .env: `CLAVE=valor`, con comillas opcionales. No
 * pretende cubrir todo el formato, solo lo que hay en `.env.example`; para lo
 * de verdad ya está Vite, que es quien los carga al arrancar Astro.
 */
function leerArchivoEnv(ruta) {
  if (!existsSync(ruta)) return {};
  const valores = {};
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia === '' || limpia.startsWith('#')) continue;
    const igual = limpia.indexOf('=');
    if (igual <= 0) continue;
    const clave = limpia.slice(0, igual).trim();
    let valor = limpia.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    valores[clave] = valor;
  }
  return valores;
}

const archivos = ['.env.local', '.env'].filter((n) => existsSync(join(RAIZ, n)));
const entorno = {
  ...leerArchivoEnv(join(RAIZ, '.env')),
  ...leerArchivoEnv(join(RAIZ, '.env.local')),
  ...process.env,
};

const definida = (clave) => {
  const valor = entorno[clave];
  return typeof valor === 'string' && valor.trim() !== '';
};

// --- Catálogo ---------------------------------------------------------------

/**
 * `nivel`:
 *   'radicacion'  sin ella la PQRS NO se radica (el formulario avisa y cae al correo)
 *   'adjuntos'    sin ella no se pueden subir archivos de soporte
 *   'envio'       sin ella no salen las postulaciones de Empleos
 *   'recomendada' funciona sin ella (tiene valor por defecto o es una mejora)
 *
 * `alternativa`: otra variable que la sustituye. Si está la alternativa, la
 * variable cuenta como definida.
 */
const VARIABLES = [
  {
    nombre: 'BLOB_READ_WRITE_TOKEN',
    nivel: 'radicacion',
    para:
      'Guardar los soportes y el registro de cada radicación en el store PRIVADO ' +
      'pqrs-adjuntos, y firmar los enlaces de descarga del correo.',
    donde:
      'Vercel > tu proyecto > Storage > pqrs-adjuntos > Connect. Al conectar el store, Vercel\n' +
      '      define la variable sola (con BLOB_STORE_ID y BLOB_WEBHOOK_PUBLIC_KEY, que el código\n' +
      '      no necesita); después hay que REDESPLEGAR. En local: `vercel env pull .env.local`.',
    forma: (v) => (v.startsWith('vercel_blob_rw_') ? null : 'debería empezar por "vercel_blob_rw_"'),
  },
  {
    nombre: 'TURNSTILE_SECRET',
    nivel: 'adjuntos',
    para: 'Verificar en el servidor que quien sube no es un robot.',
    donde:
      'Cloudflare > Turnstile > tu widget > Settings > Secret Key.\n' +
      '      Para desarrollo, la clave de prueba que siempre pasa: 1x0000000000000000000000000000000AA',
    forma: (v) => (/^[01]x/.test(v) ? null : 'las claves de Turnstile empiezan por "0x" o "1x"'),
    aviso: (v) =>
      v.startsWith('1x')
        ? 'es la clave de PRUEBA de Cloudflare: acepta cualquier token. Vale en local, NUNCA en producción.'
        : null,
  },
  {
    nombre: 'PUBLIC_TURNSTILE_SITE_KEY',
    nivel: 'adjuntos',
    para: 'Montar el widget antirrobots en el navegador.',
    donde:
      'Cloudflare > Turnstile > tu widget > Settings > Site Key.\n' +
      '      Para desarrollo: 1x00000000000000000000AA\n' +
      '      OJO: se lee EN TIEMPO DE BUILD. Si se añade en Vercel, hay que redesplegar.',
    forma: (v) => (/^[01]x/.test(v) ? null : 'las claves de Turnstile empiezan por "0x" o "1x"'),
  },
  {
    /*
     * PQRS tiene su propia cuenta de Resend. Con el remitente de pruebas
     * (onboarding@resend.dev) cada cuenta solo entrega a su titular, y el buzón
     * de PQRS y el de Talento Humano son de titulares distintos. Si no está,
     * PQRS usa RESEND_API_KEY.
     */
    nombre: 'PQRS_RESEND_API_KEY',
    alternativa: 'RESEND_API_KEY',
    nivel: 'radicacion',
    para:
      'Enviar los correos de PQRS con la cuenta de Resend registrada con ' +
      'informacioncomercialdst@gmail.com. Sin ella se usa RESEND_API_KEY.',
    donde: 'https://resend.com/api-keys, iniciando sesión con la cuenta de PQRS.',
    forma: (v) => (v.startsWith('re_') ? null : 'las claves de Resend empiezan por "re_"'),
  },
  {
    nombre: 'RESEND_API_KEY',
    nivel: 'envio',
    para:
      'Enviar las postulaciones de /empleos/ con la cuenta de Resend de Empleos. ' +
      'También es el respaldo de PQRS si no hay PQRS_RESEND_API_KEY.',
    donde: 'https://resend.com/api-keys, iniciando sesión con la cuenta de Empleos.',
    forma: (v) => (v.startsWith('re_') ? null : 'las claves de Resend empiezan por "re_"'),
  },
  {
    /*
     * Opcional desde que tiene valor por defecto. Hubo además una
     * PUBLIC_PQRS_ADMIN_DESTINO para el `mailto:` que armaba el navegador; si
     * sigue definida en Vercel hay que borrarla: ya no la lee nadie.
     */
    nombre: 'PQRS_DESTINO',
    nivel: 'recomendada',
    para:
      'Buzón que recibe TODO lo de la página de PQRS. Por defecto ' +
      'informacioncomercialdst@gmail.com, que es el titular de la cuenta de Resend de PQRS.',
    donde: 'Lo decide la empresa. Con onboarding@resend.dev tiene que ser el titular de la cuenta.',
    forma: (v) => (v.includes('@') ? null : 'no parece un correo'),
  },
  {
    nombre: 'PQRS_REMITENTE',
    nivel: 'recomendada',
    para: 'Remitente de los correos de PQRS. Por defecto onboarding@resend.dev.',
    donde: 'Una dirección de un dominio verificado en Resend, cuando lo haya.',
  },
  {
    nombre: 'PQRS_IP_SALT',
    nivel: 'recomendada',
    para: 'Salar el hash de la IP de quien radica. Sin sal, el hash se deshace probando IPs.',
    donde: 'Genérala tú: `node -e "console.log(crypto.randomUUID())"`',
  },
  {
    nombre: 'CRON_SECRET',
    nivel: 'recomendada',
    para: 'Proteger GET /api/pqrs/limpieza, el cron que borra las subidas abandonadas.',
    donde: 'Genérala tú: `node -e "console.log(crypto.randomUUID())"`',
  },
  {
    nombre: 'UPSTASH_REDIS_REST_URL',
    nivel: 'recomendada',
    para: 'Límite de peticiones compartido entre instancias. Sin él, el contador vive en la memoria de cada una.',
    donde: 'Vercel > Marketplace > Upstash (tiene plan gratuito).',
  },
  {
    nombre: 'UPSTASH_REDIS_REST_TOKEN',
    nivel: 'recomendada',
    para: 'Acompaña a UPSTASH_REDIS_REST_URL.',
    donde: 'Vercel > Marketplace > Upstash.',
  },
];

// --- Comprobación -----------------------------------------------------------

const ETIQUETA = {
  radicacion: 'sin ella NO se radica',
  adjuntos: 'sin ella NO se suben adjuntos',
  envio: 'sin ella NO salen las postulaciones de Empleos',
  recomendada: 'recomendada',
};

const faltan = [];
const malFormadas = [];
const avisos = [];

console.log('');
console.log('Variables de entorno — Distribuciones Santiago de Tunja');
console.log(
  archivos.length > 0
    ? `Leídas de: ${archivos.join(', ')} y del entorno del proceso.`
    : 'No hay ni .env ni .env.local: solo se mira el entorno del proceso.',
);
console.log('');

for (const variable of VARIABLES) {
  const { nombre, nivel, forma, aviso, alternativa } = variable;

  if (!definida(nombre) && alternativa && definida(alternativa)) {
    console.log(`  ~  ${nombre}  (no definida; se usa ${alternativa})`);
    continue;
  }

  if (!definida(nombre)) {
    if (nivel === 'recomendada') {
      console.log(`  ~  ${nombre}  (${ETIQUETA[nivel]}, no definida)`);
    } else {
      console.log(`  X  ${nombre}  (${ETIQUETA[nivel]})`);
      faltan.push(variable);
    }
    continue;
  }

  const valor = entorno[nombre].trim();
  const problema = forma?.(valor);
  const nota = aviso?.(valor);

  if (problema) {
    console.log(`  !  ${nombre}  definida, pero ${problema}`);
    malFormadas.push(variable);
  } else if (nota) {
    console.log(`  !  ${nombre}  definida — ${nota}`);
    avisos.push(variable);
  } else {
    console.log(`  OK ${nombre}`);
  }
}

// --- Cómo arreglarlo --------------------------------------------------------

const problemas = [...faltan, ...malFormadas];

if (problemas.length > 0) {
  console.log('');
  console.log('Qué falta y de dónde sale');
  console.log('');
  for (const { nombre, para, donde } of problemas) {
    console.log(`  ${nombre}`);
    console.log(`      Para: ${para}`);
    console.log(`      De dónde: ${donde}`);
    console.log('');
  }
  console.log('  La vía rápida, si el proyecto ya está enlazado con Vercel:');
  console.log('      npx vercel link      (una sola vez)');
  console.log('      npx vercel env pull .env.local');
  console.log('');
}

if (faltan.length > 0) {
  console.log(
    `Faltan ${faltan.length} variable${faltan.length === 1 ? '' : 's'} imprescindible${faltan.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

if (malFormadas.length > 0) {
  console.log('Todas están definidas, pero alguna no tiene la forma esperada. Revísala.');
  process.exit(1);
}

console.log(
  avisos.length > 0
    ? 'Listo para trabajar en local (con los avisos de arriba).'
    : 'Todo en orden.',
);
console.log('');

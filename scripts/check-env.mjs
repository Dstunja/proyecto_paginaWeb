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
 *   'radicacion'  sin ella la PQRS NO se radica (el formulario cae al correo)
 *   'adjuntos'    sin ella no se pueden subir archivos de soporte
 *   'recomendada' funciona sin ella, pero peor o menos seguro
 */
const VARIABLES = [
  {
    nombre: 'BLOB_READ_WRITE_TOKEN',
    nivel: 'adjuntos',
    para: 'Guardar los soportes y el registro de cada radicación.',
    donde:
      'Vercel > tu proyecto > Storage > Connect Store > Blob. Al conectar el store, Vercel\n' +
      '      define la variable sola; después hay que REDESPLEGAR para que la función la vea.\n' +
      '      En local: `vercel env pull .env.local`.',
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
    nombre: 'RESEND_API_KEY',
    nivel: 'radicacion',
    para: 'Enviar los dos correos de cada radicación.',
    donde: 'https://resend.com/api-keys',
    forma: (v) => (v.startsWith('re_') ? null : 'las claves de Resend empiezan por "re_"'),
  },
  {
    nombre: 'PQRS_DESTINO',
    nivel: 'radicacion',
    para: 'Correo del área que recibe cada PQRS COMERCIAL, la que se radica.',
    donde: 'Lo decide la empresa. Un correo que alguien lea de verdad.',
    forma: (v) => (v.includes('@') ? null : 'no parece un correo'),
  },
  {
    nombre: 'PUBLIC_PQRS_ADMIN_DESTINO',
    nivel: 'recomendada',
    para:
      'Correo de las PQRS ADMINISTRATIVAS, que salen por el gestor de correo de quien ' +
      'escribe. Sin ella se usa el de la empresa (src/data/site.ts) y el formulario ' +
      'funciona igual; definirla solo sirve para dirigirlas a otro buzón.',
    donde:
      'Lo decide la empresa. Admite varias direcciones separadas por coma.\n' +
      '      OJO: se lee EN TIEMPO DE BUILD, porque el mailto: se arma en el navegador.\n' +
      '      Si se añade en Vercel, hay que redesplegar.',
    forma: (v) =>
      v.split(',').every((c) => c.includes('@'))
        ? null
        : 'alguna de las direcciones no parece un correo',
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
  const { nombre, nivel, forma, aviso } = variable;

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

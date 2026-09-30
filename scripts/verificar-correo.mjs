/**
 * ¿Está ya autenticado el dominio para enviar correo? Se pregunta al DNS
 * público, sin credenciales de ningún tipo.
 *
 * PARA QUÉ SIRVE. Mientras los formularios de este sitio (PQRS y Empleos)
 * envíen desde `onboarding@resend.dev`, los correos salen sin SPF, sin DKIM y
 * sin DMARC del dominio, y Gmail tiene todos los motivos para mandarlos a la
 * carpeta de spam sin avisar a nadie. Arreglarlo es verificar `dstunja.com` en
 * Resend, y verificarlo consiste en publicar cuatro registros DNS. Este script
 * dice, en lenguaje claro, cuáles están ya publicados y cuáles faltan, para no
 * tener que interpretar la pestaña «Records» de Resend ni el panel de Hostinger.
 *
 * NO CONSULTA A RESEND, solo al DNS. Es a propósito: no necesita clave de API,
 * lo puede correr cualquiera, y responde a la pregunta que de verdad bloquea la
 * verificación («¿ya está el registro publicado y visible desde fuera?»). Que
 * Resend diga «Verified» es el paso siguiente, y lo dice su panel.
 *
 * PREGUNTA A RESOLVEDORES PÚBLICOS (Google y Cloudflare), no al del sistema
 * operativo ni al del proveedor de internet. Un registro recién puesto puede
 * verse en el panel de Hostinger y todavía no verse desde fuera, que es lo único
 * que le importa a Resend; y un registro recién borrado puede seguir en la caché
 * de la red local. Se consultan los dos resolvedores y basta que uno vea el
 * registro, porque durante la propagación es normal que no coincidan.
 *
 * QUÉ COMPRUEBA (la forma de los registros está en docs/PQRS-ADJUNTOS.md,
 * «Pendiente: verificar dstunja.com en Resend»):
 *
 *   1. MX  en `send.<dominio>`              -> camino de vuelta de rebotes y quejas
 *   2. TXT en `send.<dominio>`              -> SPF
 *   3. TXT en `resend._domainkey.<dominio>` -> DKIM, la firma
 *   4. TXT en `_dmarc.<dominio>`            -> DMARC (recomendado, no obligatorio)
 *
 * Los tres primeros son obligatorios: sin ellos Resend no verifica el dominio.
 * El cuarto se añade DESPUÉS de verificar, y se avisa si falta pero no se
 * considera un fallo.
 *
 * Además informa (sin juzgar) de dos cosas de la raíz del dominio, porque se
 * confunden mucho con lo anterior:
 *
 *   - Los MX de la raíz, que son los que deciden si `@dominio` puede RECIBIR
 *     correo. Verificar el dominio en Resend habilita enviar, no recibir: son
 *     dos cosas distintas y hacen falta las dos si Talento Humano va a tener un
 *     buzón `@dstunja.com`.
 *   - El TXT de la raíz, por si hay ya un SPF ahí que conviene mirar antes de
 *     añadir otro.
 *
 * Uso:
 *   npm run verificar:correo
 *   npm run verificar:correo -- --dominio otrodominio.com
 *
 * Si el panel de Resend enseña nombres distintos a `send` o `resend._domainkey`
 * (los cambia según la cuenta y la región), se le dicen:
 *   npm run verificar:correo -- --subdominio envios --selector otroselector
 *
 * Sale con código 0 cuando los tres obligatorios están, y 1 cuando falta alguno,
 * para poder encadenarlo en un script o en un flujo de trabajo.
 *
 * Sin dependencias nuevas: usa `node:dns` de la biblioteca estándar.
 */
import { Resolver } from 'node:dns/promises';

// ---------------------------------------------------------------------------
// Opciones de la línea de órdenes
// ---------------------------------------------------------------------------

/** Lee `--clave valor` de los argumentos; si no está, devuelve el valor dado. */
function opcion(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i === -1) return porDefecto;
  const valor = process.argv[i + 1];
  if (!valor || valor.startsWith('--')) {
    console.error(`La opción --${nombre} necesita un valor.`);
    process.exit(2);
  }
  return valor;
}

const DOMINIO = opcion('dominio', 'dstunja.com').toLowerCase().replace(/\.$/, '');
const SUBDOMINIO = opcion('subdominio', 'send');
const SELECTOR = opcion('selector', 'resend');

/**
 * Resolvedores públicos: Google y Cloudflare.
 *
 * Se preguntan los dos y vale que cualquiera vea el registro. Durante la
 * propagación es normal que uno lo tenga y el otro no, y en ese momento la
 * respuesta útil es «ya está publicado, espera a que se extienda», no «falta».
 */
const RESOLVEDORES = [
  { nombre: 'Google (8.8.8.8)', ip: '8.8.8.8' },
  { nombre: 'Cloudflare (1.1.1.1)', ip: '1.1.1.1' },
];

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/**
 * Pregunta un tipo de registro a los dos resolvedores.
 *
 * Un dominio sin ese registro NO es un error del script: el resolvedor contesta
 * `ENODATA` o `ENOTFOUND`, y aquí eso se traduce en una lista vacía. Solo un
 * fallo distinto (sin red, por ejemplo) se guarda como avería, porque no se
 * puede confundir «no hay registro» con «no pude preguntar».
 */
async function consultar(tipo, nombre) {
  const encontrados = [];
  const averias = [];

  for (const { nombre: quien, ip } of RESOLVEDORES) {
    const resolvedor = new Resolver({ timeout: 5000, tries: 2 });
    resolvedor.setServers([ip]);
    try {
      const respuesta =
        tipo === 'MX' ? await resolvedor.resolveMx(nombre) : await resolvedor.resolveTxt(nombre);
      for (const registro of respuesta) {
        // Un TXT llega partido en trozos de 255 caracteres: se vuelve a juntar.
        const texto = tipo === 'MX' ? `${registro.priority} ${registro.exchange}` : registro.join('');
        if (!encontrados.includes(texto)) encontrados.push(texto);
      }
    } catch (fallo) {
      if (fallo.code === 'ENODATA' || fallo.code === 'ENOTFOUND') continue;
      averias.push(`${quien}: ${fallo.code ?? fallo.message}`);
    }
  }

  return { encontrados, averias };
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------

const resultados = [];

/**
 * Escribe el resultado de una comprobación y lo guarda para el resumen final.
 *
 * @param estado  'ok' | 'falta' | 'revisar' | 'averia'
 */
function anotar({ titulo, estado, obligatorio, detalle, queHacer, valores = [] }) {
  const marca = { ok: '  OK  ', falta: ' FALTA', revisar: 'REVISA', averia: 'AVERÍA' }[estado];
  console.log(`\n[${marca}] ${titulo}`);
  if (detalle) console.log(`         ${detalle}`);
  for (const valor of valores) console.log(`         → ${valor}`);
  if (queHacer) console.log(`         QUÉ HACER: ${queHacer}`);
  resultados.push({ titulo, estado, obligatorio });
}

/**
 * Comprueba un registro que tiene que existir Y parecerse a algo.
 *
 * Se separan los dos fallos porque se arreglan de forma distinta: si no hay
 * nada, falta pegar el registro; si hay algo que no cuadra, está pegado mal o
 * pertenece a otro servicio, y sobrescribirlo a ciegas puede romper el correo
 * que ya funcione.
 */
async function comprobar({ titulo, tipo, nombre, esperado, comoEsperado, obligatorio, queHacer }) {
  const { encontrados, averias } = await consultar(tipo, nombre);

  if (averias.length > 0 && encontrados.length === 0) {
    anotar({
      titulo,
      estado: 'averia',
      obligatorio,
      detalle: `No se pudo consultar ${tipo} de ${nombre}. ¿Hay conexión a internet?`,
      valores: averias,
    });
    return;
  }

  if (encontrados.length === 0) {
    anotar({
      titulo,
      estado: 'falta',
      obligatorio,
      detalle: `No existe ningún registro ${tipo} en ${nombre}.`,
      queHacer,
    });
    return;
  }

  const buenos = encontrados.filter(comoEsperado);
  if (buenos.length === 0) {
    anotar({
      titulo,
      estado: 'revisar',
      obligatorio,
      detalle: `Hay ${tipo} en ${nombre}, pero ninguno tiene la forma esperada (${esperado}).`,
      valores: encontrados,
      queHacer:
        'Compara lo de arriba con lo que enseña Resend en Domains → dstunja.com → Records y corrige el valor. No borres nada sin mirar si pertenece a otro servicio.',
    });
    return;
  }

  anotar({
    titulo,
    estado: 'ok',
    obligatorio,
    detalle: `${tipo} en ${nombre}, con la forma esperada.`,
    valores: buenos,
  });
}

// ---------------------------------------------------------------------------
// Las comprobaciones
// ---------------------------------------------------------------------------

console.log(`\nAutenticación de correo de ${DOMINIO}`);
console.log(`Se consulta al DNS público; no se usa ninguna credencial.`);
console.log('='.repeat(72));

const DONDE =
  'Resend → Domains → ' +
  DOMINIO +
  ' → pestaña Records da el valor exacto. Se pega en Hostinger: hPanel → Dominios → ' +
  DOMINIO +
  ' → DNS / Nameservers → Administrar registros DNS.';

await comprobar({
  titulo: `1. MX de ${SUBDOMINIO} (rebotes y quejas)`,
  tipo: 'MX',
  nombre: `${SUBDOMINIO}.${DOMINIO}`,
  esperado: 'feedback-smtp.<región>.amazonses.com, prioridad 10',
  comoEsperado: (v) => /feedback-smtp\.[a-z0-9-]+\.amazonses\.com\.?$/i.test(v),
  obligatorio: true,
  queHacer: `Añade un MX con nombre "${SUBDOMINIO}", prioridad 10 y el valor que dé Resend. ${DONDE}`,
});

await comprobar({
  titulo: `2. SPF: TXT de ${SUBDOMINIO}`,
  tipo: 'TXT',
  nombre: `${SUBDOMINIO}.${DOMINIO}`,
  esperado: 'v=spf1 include:amazonses.com ~all',
  comoEsperado: (v) => /^v=spf1\b/i.test(v) && /amazonses\.com/i.test(v),
  obligatorio: true,
  queHacer: `Añade un TXT con nombre "${SUBDOMINIO}" y el valor SPF que dé Resend. ${DONDE}`,
});

await comprobar({
  titulo: `3. DKIM: TXT de ${SELECTOR}._domainkey (la firma)`,
  tipo: 'TXT',
  nombre: `${SELECTOR}._domainkey.${DOMINIO}`,
  esperado: 'p=<clave pública larga>',
  comoEsperado: (v) => /p=[A-Za-z0-9+/=]{40,}/.test(v),
  obligatorio: true,
  queHacer:
    `Añade un TXT con nombre "${SELECTOR}._domainkey" y la clave pública que dé Resend. ` +
    'Es el registro más largo y el que más se pega mal: cópialo completo, de una vez, sin espacios ni saltos de línea. ' +
    DONDE,
});

await comprobar({
  titulo: '4. DMARC: TXT de _dmarc (recomendado)',
  tipo: 'TXT',
  nombre: `_dmarc.${DOMINIO}`,
  esperado: 'v=DMARC1; p=none;',
  comoEsperado: (v) => /^v=DMARC1\b/i.test(v),
  obligatorio: false,
  queHacer:
    'Se añade DESPUÉS de que Resend diga Verified, no antes: un TXT en "_dmarc" con el valor ' +
    'v=DMARC1; p=none; rua=mailto:<un buzón que leas>. Con p=none no se rechaza nada, solo se ' +
    'informa, que es como se empieza. Sin DMARC el dominio verifica igual, pero Gmail confía menos.',
});

// --- Información de la raíz, que no es parte de la verificación -------------

console.log('\n' + '-'.repeat(72));
console.log('Información sobre la RAÍZ del dominio (no bloquea la verificación)');

const mxRaiz = await consultar('MX', DOMINIO);
if (mxRaiz.encontrados.length === 0) {
  console.log(`\n[ AVISO] ${DOMINIO} no tiene ningún MX en la raíz.`);
  console.log(`         Es decir: NADIE puede recibir correo en una dirección @${DOMINIO}.`);
  console.log('         Verificar el dominio en Resend habilita ENVIAR (empleos@' + DOMINIO + ' como');
  console.log('         remitente), no RECIBIR. Si Talento Humano va a tener un buzón del dominio,');
  console.log('         hace falta además un servicio de correo (Google Workspace, el correo de');
  console.log('         Hostinger...) y SUS MX en la raíz, que es una contratación aparte.');
  console.log('         Si el buzón va a seguir siendo un Gmail, no hay nada que hacer aquí.');
} else {
  console.log(`\n[  INFO] ${DOMINIO} sí tiene MX en la raíz, así que puede recibir correo:`);
  for (const v of mxRaiz.encontrados) console.log(`         → ${v}`);
  console.log('         Los registros de Resend van en subdominios y no tocan estos.');
}

const txtRaiz = await consultar('TXT', DOMINIO);
const spfRaiz = txtRaiz.encontrados.filter((v) => /^v=spf1\b/i.test(v));
if (spfRaiz.length === 0) {
  console.log(`\n[  INFO] ${DOMINIO} no tiene SPF en la raíz. No hace falta para Resend, que lo`);
  console.log(`         pide en "${SUBDOMINIO}", pero significa que hoy nada autoriza a enviar en`);
  console.log('         nombre de la raíz del dominio.');
} else {
  console.log(`\n[REVISA] Ya hay un SPF en la raíz de ${DOMINIO}:`);
  for (const v of spfRaiz) console.log(`         → ${v}`);
  console.log('         Míralo antes de añadir otro: un dominio NO puede tener dos registros SPF,');
  console.log(`         y el de Resend va en "${SUBDOMINIO}", así que no deberían chocar.`);
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

const obligatorios = resultados.filter((r) => r.obligatorio);
const pendientes = obligatorios.filter((r) => r.estado !== 'ok');
const averias = resultados.filter((r) => r.estado === 'averia');
const dmarc = resultados.find((r) => !r.obligatorio);

console.log('\n' + '='.repeat(72));

if (averias.length > 0) {
  console.log('NO SE PUDO COMPROBAR. Alguna consulta al DNS falló, así que este resultado no');
  console.log('vale. Revisa la conexión a internet y vuelve a correrlo.');
  process.exit(1);
}

if (pendientes.length === 0) {
  console.log(`LOS TRES REGISTROS OBLIGATORIOS ESTÁN PUBLICADOS Y VISIBLES DESDE FUERA.`);
  console.log('');
  console.log('Siguiente paso: entra a Resend → Domains → ' + DOMINIO + ' y pulsa "Verify".');
  console.log('Suele tardar unos minutos en pasar a "Verified" aunque el DNS ya se vea.');
  console.log('');
  console.log('CUANDO DIGA Verified, y solo entonces, se cambian las variables de Vercel, y en');
  console.log('este orden: PRIMERO el remitente (EMPLEOS_REMITENTE, PQRS_REMITENTE), se comprueba');
  console.log('que los correos siguen llegando, y DESPUÉS el destino. Al revés se rompen todos los');
  console.log('envíos en silencio. El paso a paso está en docs/EMPLEOS-POSTULACION.md.');
  if (dmarc && dmarc.estado !== 'ok') {
    console.log('');
    console.log('Queda pendiente el DMARC, que es recomendable pero no bloquea nada.');
  }
  process.exit(0);
}

console.log(`FALTAN ${pendientes.length} DE LOS 3 REGISTROS OBLIGATORIOS:`);
for (const r of pendientes) console.log(`  - ${r.titulo}`);
console.log('');
console.log(`Mientras falte alguno, Resend NO verificará ${DOMINIO} y los correos seguirán`);
console.log('saliendo desde onboarding@resend.dev, sin firma del dominio y con muchas papeletas');
console.log('de acabar en la carpeta de spam de quien los reciba.');
console.log('');
console.log('Si acabas de pegarlos en Hostinger, no es un fallo todavía: el DNS tarda en');
console.log('extenderse (normalmente minutos, hasta 72 horas en el peor caso). Espera un rato y');
console.log('vuelve a correr `npm run verificar:correo`.');
process.exit(1);

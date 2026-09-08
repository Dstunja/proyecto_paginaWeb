/**
 * Descarga las fotos oficiales que le faltan al catálogo desde la tienda en
 * línea de Nutresa (tiendanutresaencasa.com), cruzando por CÓDIGO SAP.
 *
 * POR QUÉ POR CÓDIGO SAP Y NO POR NOMBRE
 * --------------------------------------
 * La tienda corre sobre VTEX, y VTEX guarda el código SAP de Nutresa en el
 * campo `alternateIds_RefId` de cada SKU. Es el mismo identificador que trae
 * el deck "MASIVO 1.0" y el que ya usa `imagen` en src/data/productos.ts. Dos
 * referencias de la misma marca pueden llamarse casi igual y cambiar solo en
 * el gramaje ("Bénet Kids" vs. "Bénet", plegadiza x 4 vs. x 8), así que
 * buscar por nombre pegaría la foto equivocada sin que nadie lo note. El
 * código es lo único que amarra foto y producto.
 *
 * QUÉ HACE
 * --------
 * Solo pide las referencias que HOY no tienen foto resuelta: sin archivo en
 * src/assets/productos/ y sin ruta propia en public/. Las que ya la tienen no
 * se vuelven a bajar, así que el script se puede correr las veces que haga
 * falta sin gastar ancho de banda ni pisar archivos buenos.
 *
 * Las referencias con `codigoParcial` (el deck solo traía los últimos dígitos)
 * y las que no tienen código quedan fuera: su código no identifica un SKU
 * único y una consulta con él podría traer la foto de otro producto.
 *
 * El archivo se guarda como <CÓDIGO SAP>.<ext> en src/assets/productos/, que
 * es el nombre que `fotoDe` de CatalogoPedido.astro sabe resolver. Después de
 * correrlo hay que llenar el campo `imagen` de las referencias nuevas; de eso
 * se encarga scripts/conectar-fotos.mjs.
 *
 *     node scripts/descargar-fotos.mjs            # descarga
 *     node scripts/descargar-fotos.mjs --dry-run  # solo consulta y reporta
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { productos } from '../src/data/productos.ts';

const RAIZ = process.cwd();
const DESTINO = join(RAIZ, 'src/assets/productos');
const PUBLICO = join(RAIZ, 'public');
const API = 'https://www.tiendanutresaencasa.com/api/catalog_system/pub/products/search';

/** Cuánto se espera entre consultas, para no atropellar la tienda. */
const PAUSA_MS = 250;
const REINTENTOS = 3;

const soloConsultar = process.argv.includes('--dry-run');

const archivos = new Set(readdirSync(DESTINO));

/** ¿Esta referencia ya tiene foto que el sitio pueda resolver? */
function tieneFoto(p) {
  if (!p.imagen) return false;
  // Ruta absoluta: archivo suelto en public/ (las fotos de innovación).
  if (p.imagen.startsWith('/')) return existsSync(join(PUBLICO, p.imagen.slice(1)));
  return archivos.has(p.imagen);
}

/** Un SKU de la tienda solo se puede pedir con el código SAP completo. */
function consultable(p) {
  return Boolean(p.codigo?.trim()) && !p.codigoParcial;
}

const pendientes = productos.filter((p) => !tieneFoto(p) && consultable(p));
const sinCodigo = productos.filter((p) => !tieneFoto(p) && !consultable(p));

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedirJson(url) {
  for (let intento = 1; intento <= REINTENTOS; intento += 1) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return res.json();
      // 429 y 5xx sí valen un reintento; un 404 es una respuesta, no un fallo.
      if (res.status < 500 && res.status !== 429) return null;
    } catch {
      /* tiempo agotado o red caída: se reintenta */
    }
    await espera(PAUSA_MS * intento * 2);
  }
  return null;
}

/**
 * La foto principal del SKU, pedida a 1000x1000.
 *
 * VTEX sirve la imagen al tamaño que se le pida metiéndolo en la ruta
 * (`/ids/160880-1000-1000/`). Se pide ese tamaño porque es el de las 595
 * fotos que ya están en el repositorio: así el marco cuadrado de la tarjeta
 * sigue cuadrando y el optimizador de Astro tiene de dónde sacar la copia @2x.
 */
function urlDeFoto(producto) {
  const imagenes = producto?.items?.[0]?.images ?? [];
  const url = imagenes[0]?.imageUrl;
  if (!url) return null;
  return url.replace(/\/ids\/(\d+)(?=\/)/, '/ids/$1-1000-1000');
}

const conseguidas = [];
const sinResultado = [];

console.log(
  `Catálogo: ${productos.length} referencias. Sin foto: ${pendientes.length + sinCodigo.length}.`,
);
console.log(
  `Consultables por SAP: ${pendientes.length}. Sin código o con código parcial: ${sinCodigo.length}.\n`,
);

for (const [i, p] of pendientes.entries()) {
  const codigo = p.codigo.trim();
  const etiqueta = `[${String(i + 1).padStart(3)}/${pendientes.length}] ${codigo} ${p.marca} — ${p.nombre}`;

  const datos = await pedirJson(`${API}?fq=alternateIds_RefId:${encodeURIComponent(codigo)}`);
  await espera(PAUSA_MS);

  if (!Array.isArray(datos) || datos.length === 0) {
    sinResultado.push(p);
    console.log(`${etiqueta} — sin resultado en la tienda`);
    continue;
  }

  const url = urlDeFoto(datos[0]);
  if (!url) {
    sinResultado.push(p);
    console.log(`${etiqueta} — el SKU existe pero no publica foto`);
    continue;
  }

  if (soloConsultar) {
    conseguidas.push({ codigo, url, nombre: p.nombre });
    console.log(`${etiqueta} — hay foto: ${url}`);
    continue;
  }

  let binario;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    binario = Buffer.from(await res.arrayBuffer());
  } catch (error) {
    sinResultado.push(p);
    console.log(`${etiqueta} — falló la descarga (${error.message})`);
    continue;
  }

  // La extensión sale del contenido, no de la URL: VTEX sirve .jpg con nombres
  // que a veces terminan en .png y al revés.
  const ext = binario.subarray(0, 8).toString('hex').startsWith('89504e47') ? '.png' : '.jpg';
  const archivo = codigo + ext;
  writeFileSync(join(DESTINO, archivo), binario);
  archivos.add(archivo);
  conseguidas.push({ codigo, archivo, nombre: p.nombre });
  console.log(`${etiqueta} — guardada como ${archivo} (${(binario.length / 1024).toFixed(0)} kB)`);
  await espera(PAUSA_MS);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Fotos nuevas: ${conseguidas.length}`);
console.log(`Sin resultado en la tienda: ${sinResultado.length}`);
console.log(`Sin código SAP consultable: ${sinCodigo.length}`);
console.log(
  `Quedarían sin foto real: ${sinResultado.length + sinCodigo.length} de ${productos.length}`,
);
if (sinResultado.length) {
  console.log('\nSin resultado:');
  for (const p of sinResultado) console.log(`  ${p.codigo}  ${p.marca} — ${p.nombre}`);
}
if (sinCodigo.length) {
  console.log('\nSin código SAP consultable:');
  for (const p of sinCodigo) console.log(`  ${p.codigo || '(vacío)'}  ${p.marca} — ${p.nombre}`);
}

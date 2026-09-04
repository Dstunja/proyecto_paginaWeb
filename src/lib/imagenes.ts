import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ruta } from './rutas';

/**
 * Imágenes del sitio, con reemplazo automático mientras no exista el archivo
 * real.
 *
 * La idea es que el diseño nunca se vea roto por una imagen que todavía no se
 * ha subido: si el archivo no está en `public/`, se usa un marcador de
 * posición de placehold.co con los colores de la marca. Al dejar el archivo
 * real en su carpeta, la próxima compilación lo toma sin tocar el código.
 *
 * IMPORTANTE: estas funciones leen el disco, así que solo pueden usarse en el
 * frontmatter de un `.astro` (se ejecuta en Node al compilar), nunca dentro de
 * un `<script>` del navegador.
 */

/** Carpeta public/ del proyecto. */
const PUBLICO = join(process.cwd(), 'public');

/** Colores de marca para los marcadores de posición (sin el #). */
const FONDO_MARCADOR = '0d2c84';
const TEXTO_MARCADOR = 'ffffff';

/** Extensiones que se buscan cuando solo se conoce el nombre del archivo. */
const EXTENSIONES = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif'];

/**
 * Convierte un nombre en un identificador apto para archivos y URL:
 * 'Saltín Noel' -> 'saltin-noel'.
 */
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita las tildes que deja NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** ¿Existe este archivo dentro de public/? Recibe la ruta desde la raíz. */
export function existeEnPublico(rutaPublica: string): boolean {
  if (!rutaPublica) return false;
  return existsSync(join(PUBLICO, rutaPublica.replace(/^\/+/, '')));
}

/**
 * URL de un marcador de posición con los colores de la marca.
 * Se ve como un rectángulo azul con el texto centrado.
 */
export function marcador(texto: string, ancho = 800, alto = 600): string {
  const t = encodeURIComponent(texto);
  return `https://placehold.co/${ancho}x${alto}/${FONDO_MARCADOR}/${TEXTO_MARCADOR}/png?text=${t}&font=montserrat`;
}

/**
 * Devuelve la imagen real si ya está subida, o un marcador de posición.
 *
 * @param rutaPublica ruta dentro de public/, por ejemplo '/img/empleos/conductor.jpg'
 * @param textoAlterno texto que se dibuja en el marcador mientras falte la imagen
 */
export function imagenOMarcador(
  rutaPublica: string | undefined,
  textoAlterno: string,
  ancho = 800,
  alto = 600,
): { src: string; esMarcador: boolean } {
  const encontrada = rutaPublica ? buscarConCualquierExtension(rutaPublica) : null;
  if (encontrada) return { src: ruta(encontrada), esMarcador: false };
  return { src: marcador(textoAlterno, ancho, alto), esMarcador: true };
}

/**
 * La imagen si el archivo ya está en public/, o `null` si todavía no.
 *
 * Es la hermana de `imagenOMarcador` para los sitios donde ya hay un respaldo
 * propio mejor que un rectángulo azul: en el armador de pedidos, un producto
 * sin foto muestra el logotipo de su marca. Devolver `null` deja que quien
 * llama elija ese respaldo, en vez de imponerle un marcador.
 *
 * Sirve además de red de seguridad al ir conectando las fotos del catálogo:
 * si una ruta queda mal escrita, el producto vuelve al logotipo en lugar de
 * enseñar una imagen rota.
 */
export function imagenSiExiste(rutaPublica: string | undefined): string | null {
  const encontrada = rutaPublica ? buscarConCualquierExtension(rutaPublica) : null;
  return encontrada ? ruta(encontrada) : null;
}

/**
 * Busca el archivo tal cual y, si no está, con las demás extensiones de imagen.
 *
 * Así da igual que en los datos diga `.jpg` y el archivo subido sea `.png`:
 * mientras el nombre coincida, la imagen se usa igual.
 */
function buscarConCualquierExtension(rutaPublica: string): string | null {
  if (existeEnPublico(rutaPublica)) return rutaPublica;

  const sinExtension = rutaPublica.replace(/\.[a-z0-9]+$/i, '');
  return EXTENSIONES.map((ext) => sinExtension + ext).find(existeEnPublico) ?? null;
}

/**
 * Logotipos de marca, importados desde src/assets/marcas/.
 *
 * Viven en src/ y no en public/ a propósito: solo las imágenes de src/ pasan
 * por el optimizador de Astro (astro:assets), que es lo que permite servir
 * cada logo en el tamaño justo y con versión @2x para pantallas de alta
 * densidad. Astro las copia a la salida con un nombre con hash, así que la
 * URL final ya lleva el `base` del sitio y no hace falta pasarla por `ruta`.
 *
 * EDITAR AQUÍ: para agregar el logotipo de una marca, deja el archivo en
 * src/assets/marcas/ con el nombre de la marca en minúsculas y con guiones:
 * 'Saltín Noel' -> saltin-noel.png (también sirven .svg, .webp, .jpg o .avif).
 * Entre mejor sea la resolución original, mejor se ve en pantallas retina:
 * como mínimo el doble del tamaño al que se muestra.
 */
const LOGOS_MARCA = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/marcas/*.{png,jpg,jpeg,webp,avif,svg}',
  { eager: true },
);

/** { 'saltin-noel': ImageMetadata, ... }, indexado por el nombre del archivo. */
const LOGOS_POR_SLUG: Record<string, ImageMetadata> = Object.fromEntries(
  Object.entries(LOGOS_MARCA).map(([archivo, modulo]) => [
    archivo.replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, ''),
    modulo.default,
  ]),
);

/**
 * El mismo índice, con las claves sin guiones ('chocolisto', 'saltinnoel'...).
 *
 * Sirve para que una marca escrita de dos maneras en el sitio encuentre igual
 * su archivo: el catálogo extraído del PDF dice 'Chocolisto' en una palabra
 * mientras el resto del sitio escribe 'Choco Listo', y ambas deben llegar a
 * choco-listo.jpg. Solo se consulta si falla la búsqueda exacta, así que no
 * cambia el resultado de ninguna marca que ya cruzaba.
 */
const LOGOS_SIN_GUIONES: Record<string, ImageMetadata> = Object.fromEntries(
  Object.entries(LOGOS_POR_SLUG).map(([clave, imagen]) => [clave.replace(/-/g, ''), imagen]),
);

/**
 * Imagen del logotipo de una marca, lista para el <Image> de astro:assets.
 *
 * Devuelve el `ImageMetadata` completo (con el ancho y el alto reales del
 * archivo), que es lo que necesita <Image> para generar los tamaños y el
 * srcset. Devuelve null cuando la marca todavía no tiene archivo, para que
 * quien la use decida el respaldo: mostrar el nombre en texto u omitirla.
 */
export function logoMarcaImagen(nombre: string): ImageMetadata | null {
  const clave = slug(nombre);
  return LOGOS_POR_SLUG[clave] ?? LOGOS_SIN_GUIONES[clave.replace(/-/g, '')] ?? null;
}

/**
 * Alto al que se puede mostrar un logotipo sin agrandarlo, dentro de una caja.
 *
 * Devuelve el mayor alto que cumple tres condiciones a la vez: cabe en la
 * caja, no supera la mitad del alto real del archivo —para que la copia @2x
 * del srcset siga cabiendo dentro de la resolución original— y no desborda el
 * ancho de la caja cuando el logotipo es muy alargado.
 *
 * El píxel que se descuenta antes de partir a la mitad absorbe el redondeo
 * del ancho: sin él, un logotipo de alto impar como Corona (62 px) pediría
 * una copia @2x un píxel más ancha que su propio archivo.
 *
 * Es la regla que mantiene parejos los logotipos de la franja del inicio y
 * las fichas del catálogo, que vienen de fuentes y resoluciones muy
 * distintas: ninguno se estira por encima de lo que da su archivo.
 */
export function altoSeguroLogo(
  imagen: ImageMetadata,
  altoMaximo: number,
  anchoMaximo: number,
): number {
  return Math.min(
    altoMaximo,
    Math.floor((imagen.height - 1) / 2),
    Math.floor((anchoMaximo * imagen.height) / imagen.width),
  );
}


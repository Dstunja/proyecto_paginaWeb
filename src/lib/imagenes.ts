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
  if (rutaPublica && existeEnPublico(rutaPublica)) {
    return { src: ruta(rutaPublica), esMarcador: false };
  }
  return { src: marcador(textoAlterno, ancho, alto), esMarcador: true };
}

/**
 * Logo de una marca comercial, si ya está subido a public/img/marcas/.
 *
 * Busca por el nombre convertido a slug y prueba las extensiones habituales:
 * 'Choco Listo' -> public/img/marcas/choco-listo.png (o .svg, .webp...).
 * Devuelve null cuando todavía no existe, para que quien llame muestre el
 * nombre en texto y no una imagen rota.
 */
export function logoMarca(nombre: string): string | null {
  const base = `/img/marcas/${slug(nombre)}`;
  const encontrada = EXTENSIONES.map((ext) => base + ext).find(existeEnPublico);
  return encontrada ? ruta(encontrada) : null;
}

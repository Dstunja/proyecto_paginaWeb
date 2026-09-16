/**
 * Utilidades de texto para comparar lo que escribe la gente en la hoja.
 *
 * Todo lo que se coteja contra la pestaña Listas o contra un título de columna
 * pasa por `normalizar`: así "Bénet", "benet " y "BENET" son la misma marca, y
 * la hoja no falla por una tilde o un espacio de más. Lo que se PUBLICA sale
 * siempre con la grafía canónica de Listas, no con la de la celda.
 */

/** Convierte cualquier celda en texto recortado ('' si está vacía o es null). */
export function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

/** Minúsculas, sin tildes, sin espacios repetidos ni en los extremos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identificador apto para archivos y URL: 'Saltín Noel' -> 'saltin-noel'. */
export function slug(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** ¿El texto, normalizado, empieza por el prefijo (también normalizado)? */
export function empiezaPor(texto: string, prefijo: string): boolean {
  return normalizar(texto).startsWith(normalizar(prefijo));
}

/** ¿El texto, normalizado, contiene la frase (también normalizada)? */
export function contiene(texto: string, frase: string): boolean {
  return normalizar(texto).includes(normalizar(frase));
}

/**
 * Busca `valor` dentro de una lista de valores canónicos comparando
 * normalizado, y devuelve la grafía canónica o null si no está.
 */
export function buscarEnLista(valor: string, lista: readonly string[]): string | null {
  const clave = normalizar(valor);
  if (!clave) return null;
  return lista.find((v) => normalizar(v) === clave) ?? null;
}

/** Parte una celda de varias líneas en líneas no vacías, sin viñetas iniciales. */
export function lineas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*·]\s*/, '').trim())
    .filter((l) => l !== '');
}

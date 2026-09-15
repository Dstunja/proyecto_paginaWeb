/**
 * Middleware de Astro: quita los comentarios HTML de las páginas publicadas.
 *
 * POR QUÉ. Las plantillas llevan comentarios `<!-- … -->` pensados para quien
 * mantiene el código («Turnstile en modo interaction-only», «Solo en la
 * categoría comercial…») y los iconos de lucide traen su comentario de
 * licencia. Astro los copia tal cual al HTML y cualquiera los lee con «ver
 * código fuente»; un escaneo de seguridad (OWASP ZAP) los marca como
 * información filtrada. Astro no tiene una opción para quitarlos, así que se
 * quitan aquí.
 *
 * CUÁNDO CORRE. Para las páginas estáticas, al compilar: el HTML ya sale limpio
 * de `astro build`, tanto para Vercel como para GitHub Pages. Para las rutas bajo
 * demanda (src/pages/api/) corre en la función, pero solo toca respuestas
 * `text/html`; el JSON, las redirecciones y los archivos pasan sin leerse.
 *
 * QUÉ NO TOCA. Lo que hay dentro de `<script>`, `<style>`, `<textarea>` y
 * `<pre>`: ahí un `<!--` puede ser parte del contenido y no un comentario.
 */
import { defineMiddleware } from 'astro:middleware';

/**
 * O un bloque que se respeta entero, o un comentario que se quita. Los bloques
 * van primero en la alternativa para que un `<!--` dentro de ellos nunca se
 * tome por comentario.
 */
const BLOQUES_O_COMENTARIOS =
  /(<(script|style|textarea|pre)\b[\s\S]*?<\/\2\s*>)|<!--[\s\S]*?-->/gi;

export function quitarComentariosHtml(html: string): string {
  return html.replace(BLOQUES_O_COMENTARIOS, (_coincidencia, bloque: string | undefined) => bloque ?? '');
}

export const onRequest = defineMiddleware(async (_contexto, siguiente) => {
  const respuesta = await siguiente();
  const tipo = respuesta.headers.get('content-type') ?? '';
  if (!tipo.includes('text/html') || !respuesta.body) return respuesta;

  const html = await respuesta.text();
  return new Response(quitarComentariosHtml(html), {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: respuesta.headers,
  });
});

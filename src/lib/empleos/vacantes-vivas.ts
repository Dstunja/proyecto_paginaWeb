/**
 * Respaldo en el navegador para /empleos/: esconde las tarjetas de vacantes que
 * Control360 ya no tiene abiertas.
 *
 * POR QUÉ, SI YA HAY ISR. La página se regenera en segundos cuando Control360
 * avisa, y a los 5 minutos si el aviso se pierde (src/lib/empleos/isr.mjs).
 * Esto cubre lo que queda: una copia vieja en la caché del navegador, en el
 * espejo de GitHub Pages (que solo cambia con un despliegue) o en esos 5
 * minutos. Es defensa en profundidad y por eso es mínima:
 *   - solo ESCONDE tarjetas (y su opción del <select>); nunca pinta vacantes
 *     nuevas ni vuelve a dibujar la página;
 *   - lee la ruta PÚBLICA de Control360 (la misma que ve cualquiera, con su
 *     caché de CDN; sin secretos), que llega en `data-vacantes-vivas`;
 *   - si algo falla (red, CORS, JSON raro, otra versión), no hace NADA.
 *
 * La Content-Security-Policy de vercel.json permite `connect-src` a
 * https://control360app.com para esto.
 */

/** Cuánto se espera a Control360 antes de rendirse (y no tocar nada). */
const TIEMPO_MAXIMO_MS = 6_000;

/**
 * Los slugs abiertos según el JSON de Control360, o null si la respuesta no es
 * de fiar (en ese caso no se esconde nada). Pura, para poder probarla.
 */
export function slugsAbiertos(json: unknown): Set<string> | null {
  if (!json || typeof json !== 'object') return null;
  const { version, vacantes } = json as { version?: unknown; vacantes?: unknown };
  if (version !== 1 || !Array.isArray(vacantes)) return null;
  const slugs = new Set<string>();
  for (const v of vacantes) {
    const slug = v && typeof v === 'object' ? (v as { slug?: unknown }).slug : undefined;
    if (typeof slug === 'string' && slug.trim()) slugs.add(slug.trim());
  }
  // Entradas que existen pero ninguna con slug: forma rara, mejor no tocar.
  if (vacantes.length > 0 && slugs.size === 0) return null;
  return slugs;
}

/** Busca la rejilla, pregunta a Control360 y esconde las tarjetas cerradas. */
export async function esconderVacantesCerradas(doc: Document = document): Promise<void> {
  try {
    const rejilla = doc.querySelector<HTMLElement>('[data-vacantes-vivas]');
    const url = rejilla?.dataset.vacantesVivas;
    if (!rejilla || !url || !/^https:\/\//.test(url)) return;

    const respuesta = await fetch(url, {
      headers: { accept: 'application/json' },
      credentials: 'omit',
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (!respuesta.ok) return;
    const abiertos = slugsAbiertos(await respuesta.json());
    if (!abiertos) return;

    const select = doc.getElementById('cargo-empleo') as HTMLSelectElement | null;
    const tarjetas = rejilla.querySelectorAll<HTMLElement>('[data-vacante-slug]');
    let visibles = 0;
    tarjetas.forEach((tarjeta) => {
      if (abiertos.has(tarjeta.dataset.vacanteSlug ?? '')) {
        visibles += 1;
        return;
      }
      // `hidden` + display por si una clase de utilidades (flex) le gana al atributo.
      tarjeta.hidden = true;
      tarjeta.style.display = 'none';
      const cargo = tarjeta.querySelector<HTMLElement>('[data-postular]')?.dataset.postular;
      if (select && cargo) {
        Array.from(select.options)
          .filter((o) => o.value === cargo && !o.selected)
          .forEach((o) => o.remove());
      }
    });

    if (tarjetas.length > 0 && visibles === 0) {
      const aviso = doc.createElement('p');
      aviso.className = 'glass-card p-8 text-muted';
      aviso.textContent =
        'En este momento no tenemos vacantes abiertas. Puedes dejarnos tu hoja de vida en el formulario de abajo y te contactamos cuando se abra un proceso.';
      rejilla.before(aviso);
    }
  } catch {
    // Respaldo silencioso: si no se pudo comprobar, la página queda como llegó.
  }
}

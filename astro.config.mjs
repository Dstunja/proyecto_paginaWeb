// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// ---------------------------------------------------------------------------
// DOS DESTINOS DE PUBLICACION, DOS `site`/`base` DISTINTOS
// ---------------------------------------------------------------------------
//
// 1. VERCEL (publicacion principal, plan Hobby)
//    https://paginaweb-beta-coral.vercel.app
//    El sitio cuelga de la RAIZ del dominio, asi que NO lleva `base`: los
//    enlaces y los assets salen como "/pqrs/" y "/_astro/...". Vercel define
//    la variable de entorno VERCEL='1' durante el build, y eso es lo unico
//    que hace falta para distinguir este caso (no hay que configurar nada a
//    mano en el panel).
//
// 2. GITHUB PAGES (espejo de revision interna, .github/workflows/deploy.yml)
//    https://dstunja.github.io/proyecto_paginaWeb
//    Es un "project site": cuelga de /proyecto_paginaWeb, no de la raiz. Sin
//    `base` los archivos de /_astro/ dan 404 y el sitio se ve sin estilos.
//
// El sitio sigue siendo ESTATICO en los dos casos: `output: 'static'` compila
// todas las paginas a HTML en el build. Lo unico que corre como funcion son
// las rutas que se marcan a mano con `export const prerender = false`, que hoy
// son las de src/pages/api/pqrs/ (radicacion de PQRS, tokens de subida y
// limpieza). Esas funciones solo existen en Vercel; en GitHub Pages no hay
// backend y el formulario de PQRS no radica.
//
// Ninguna ruta interna se escribe a mano: todas pasan por ruta() de
// src/lib/rutas.ts o por import.meta.env.BASE_URL, que Astro recalcula a
// partir del `base` de aqui abajo. Por eso el mismo codigo sirve para los dos
// destinos sin tocar ni un componente.
//
// CUANDO dstunja.com APUNTE A VERCEL: basta con cambiar SITIO_VERCEL por
// 'https://dstunja.com'. No hay que tocar nada mas (canonical, Open Graph y
// sitemap se generan a partir de `site`). Ojo: hoy ese dominio sirve OTRO
// sitio (una instalacion de WordPress), asi que apuntarlo antes de tiempo
// haria que el canonical senale a una pagina que no es esta.

/** URL publica del despliegue en Vercel. */
const SITIO_VERCEL = 'https://paginaweb-beta-coral.vercel.app';
/** URL y prefijo del espejo en GitHub Pages. */
const SITIO_GITHUB_PAGES = 'https://dstunja.github.io';
const BASE_GITHUB_PAGES = '/proyecto_paginaWeb';

/** Vercel define VERCEL='1' en todos sus builds (produccion y preview). */
const enVercel = Boolean(process.env.VERCEL);

export default defineConfig({
  site: enVercel ? SITIO_VERCEL : SITIO_GITHUB_PAGES,
  base: enVercel ? undefined : BASE_GITHUB_PAGES,
  output: 'static',
  adapter: vercel(),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});

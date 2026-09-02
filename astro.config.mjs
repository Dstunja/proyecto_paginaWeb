// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Publicacion actual: GitHub Pages, solo para revision interna. El sitio vive
// en https://dstunja.github.io/proyecto_paginaWeb, asi que `base` debe llevar
// el nombre del repositorio y todas las rutas a imagenes, estilos y enlaces
// internos tienen que respetarlo (ver src/lib/rutas.ts e import.meta.env.BASE_URL).
//
// AL PASAR A HOSTINGER (dominio propio dstunja.com):
//   1. Cambiar site a 'https://dstunja.com'
//   2. Eliminar la linea `base` (el sitio quedara en la raiz del dominio)
// No hace falta tocar nada mas: las rutas se recalculan solas a partir de BASE_URL.
export default defineConfig({
  site: 'https://dstunja.github.io',
  base: '/proyecto_paginaWeb',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});

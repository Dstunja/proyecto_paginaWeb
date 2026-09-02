// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Dominio real del sitio. Se usa para el canonical, las tarjetas Open Graph
// y el sitemap. Si el sitio se publica en otro dominio, cambiarlo aqui.
export default defineConfig({
  site: 'https://dstunja.com',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});

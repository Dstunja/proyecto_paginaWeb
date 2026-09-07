// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// Publicacion actual: Vercel (plan Hobby), con el dominio propio dstunja.com.
//
// El sitio sigue siendo ESTATICO: `output: 'static'` compila todas las paginas
// a HTML en el build. Lo unico que corre como funcion son las rutas que se
// marcan a mano con `export const prerender = false`, que hoy son las de
// src/pages/api/pqrs/ (radicacion de PQRS, tokens de subida y limpieza).
// Con el adaptador puesto, Astro genera una funcion solo para esas rutas.
//
// Ya no hay `base`: el sitio vive en la raiz del dominio. Las rutas internas
// siguen pasando por src/lib/rutas.ts e import.meta.env.BASE_URL, asi que no
// hubo que tocarlas una a una; BASE_URL vale '/' y todo se recalcula solo.
//
// OJO CON GITHUB PAGES: .github/workflows/deploy.yml sigue publicando en
// https://dstunja.github.io/proyecto_paginaWeb, y sin `base` esa copia queda
// rota (los archivos de /_astro/ dan 404). Si se quiere conservar ese espejo
// hay que devolver el `base` detras de una variable de entorno o retirar el
// workflow. Ver docs/PQRS-ADJUNTOS.md, apartado de despliegue.
export default defineConfig({
  site: 'https://dstunja.com',
  output: 'static',
  adapter: vercel(),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});

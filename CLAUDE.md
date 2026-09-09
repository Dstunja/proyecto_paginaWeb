# Proyecto: sitio web Distribuciones Santiago de Tunja (dominio futuro: dstunja.com)

Stack: Astro + Tailwind 4 + TypeScript.

## Reglas de trabajo

- **Commitear siempre con rutas explícitas**, nunca con `git add .` ni
  `git commit -a`. En este repositorio suele haber **varias sesiones de Claude
  trabajando a la vez sobre el mismo directorio**, así que `git add .` arrastra
  al commit el trabajo a medio hacer de otra sesión. Después de cada cambio
  significativo:
  `git add <rutas del cambio propio> && git commit -m "mensaje descriptivo" && git push`.
- **Revisar `git status` y `git diff --stat` antes de commitear.** Nombrar la
  ruta en el `git add` no basta: git commitea el archivo ENTERO tal como está en
  disco, no solo las líneas propias. Si un archivo aparece en el `--stat` con
  muchas más líneas de las que se tocaron, dentro hay trabajo ajeno; hay que
  sacarlo antes de commitear. Conviene mirar también `git branch -vv`, porque
  otra sesión puede haber movido la rama por debajo.
- **Hacer `push` inmediatamente**, en cuanto el commit esté bien. Mientras el
  commit siga solo en local, un `git reset` de otra sesión puede sacarlo de la
  rama; una vez publicado, ya no.
- **Si otra sesión tiene cambios sin commitear en un archivo, ese archivo no se
  toca**: ni para editarlo, ni para leerlo y reescribirlo entero. Reescribirlo
  borra del árbol de trabajo lo que la otra sesión no haya guardado todavía, y
  eso no se puede recuperar. Lo correcto es parar, avisar de qué archivos están
  compartidos y reanudar sobre la base ya commiteada.
- **Dos destinos de publicación**, y cada uno necesita un `site`/`base` distinto:
  - **Vercel** (plan Hobby), la publicación principal: <https://paginaweb-beta-coral.vercel.app>.
    Cuelga de la raíz del dominio, así que va **sin `base`**. Despliega solo, con
    cada push a `main`.
  - **GitHub Pages** (espejo de revisión interna, `.github/workflows/deploy.yml`):
    <https://dstunja.github.io/proyecto_paginaWeb>. Es un *project site*: cuelga de
    `/proyecto_paginaWeb`, así que necesita `base: '/proyecto_paginaWeb'`. Sin él,
    los archivos de `/_astro/` dan 404 y el sitio se ve sin estilos.
- En `astro.config.mjs`, `site` y `base` son **condicionales**: se eligen según la
  variable de entorno `VERCEL`, que Vercel define con valor `'1'` en todos sus
  builds (producción y preview). Las URLs están en constantes al principio del
  archivo: `SITIO_VERCEL`, `SITIO_GITHUB_PAGES` y `BASE_GITHUB_PAGES`. No dejar
  ninguno de los dos fijo: romperías uno de los dos despliegues.
- **`dstunja.com` NO se usa como `site` todavía.** Hoy ese dominio sirve otra
  página, una instalación de WordPress ajena a este proyecto. Ponerlo haría que el
  canonical, el Open Graph y el sitemap del sitio entero apuntaran a una web que no
  es esta. Se usará cuando el dominio apunte a Vercel, no antes.
- **Cómo migrar a dstunja.com** el día que el dominio ya apunte a Vercel:
  1. En `astro.config.mjs`, cambiar `SITIO_VERCEL` a `'https://dstunja.com'`.
  2. En `public/robots.txt`, cambiar la línea `Sitemap:` a
     `https://dstunja.com/sitemap-index.xml`. Ese archivo es estático (se copia tal
     cual desde `public/`), así que no se entera del `site` y hay que tocarlo a mano.
  No hace falta nada más: canonical, Open Graph y sitemap salen de `site`.
- `output: 'static'` y `adapter: vercel()` en los dos builds. Las páginas siguen
  siendo estáticas. Solo `src/pages/api/**` corre como función, y cada ruta lo pide
  a mano con `export const prerender = false`. Esas funciones **solo existen en
  Vercel**: en GitHub Pages no hay backend y el formulario de PQRS cae al correo en
  vez de radicar.
- Con el adaptador puesto, el build deja el sitio en **`dist/client/`**, no en
  `dist/` (`dist/server/` es la función). Por eso el workflow de Pages usa
  `withastro/action@v5` con `out-dir: dist/client`: la v3 no acepta ese parámetro y
  publicaba el sitio colgando de `/client/`.
- Las rutas internas (enlaces, imágenes, estilos) nunca se escriben a mano: pasan
  por `ruta()` de `src/lib/rutas.ts` o por `import.meta.env.BASE_URL`. Así el mismo
  código sirve con `base` y sin él, sin tocar los componentes uno a uno.
- La radicación de PQRS necesita variables de entorno (Blob, Resend, Turnstile).
  Están documentadas en `.env.example` y en `docs/PQRS-ADJUNTOS.md`.

## Marca

- Colores: azul oscuro #0D2C84, azul #1E88E5, naranja #F5A623, gris claro #F5F7FA, gris oscuro #263238
- Tipografía: Montserrat (Bold títulos, SemiBold subtítulos), Poppins Regular cuerpo
- Logos en public/: "logo-distribuciones.png" (completo) y "LOGO-removebg-preview.png" (ícono)

# Proyecto: sitio web Distribuciones Santiago de Tunja (dominio: dstunja.com)

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
  - **Vercel** (plan Hobby), la publicación principal: <https://dstunja.com> (también
    responde en <https://paginaweb-beta-coral.vercel.app>). Cuelga de la raíz del
    dominio, así que va **sin `base`**. Despliega solo, con cada push a `main`.
  - **GitHub Pages** (espejo de revisión interna, `.github/workflows/deploy.yml`):
    <https://dstunja.github.io/proyecto_paginaWeb>. Es un *project site*: cuelga de
    `/proyecto_paginaWeb`, así que necesita `base: '/proyecto_paginaWeb'`. Sin él,
    los archivos de `/_astro/` dan 404 y el sitio se ve sin estilos.
- En `astro.config.mjs`, `site` y `base` son **condicionales**: se eligen según la
  variable de entorno `VERCEL`, que Vercel define con valor `'1'` en todos sus
  builds (producción y preview). Las URLs están en constantes al principio del
  archivo: `SITIO_VERCEL`, `SITIO_GITHUB_PAGES` y `BASE_GITHUB_PAGES`. No dejar
  ninguno de los dos fijo: romperías uno de los dos despliegues.
- **`dstunja.com` es el `site` de Vercel** (`SITIO_VERCEL`): el dominio ya apunta a
  Vercel y el WordPress anterior dejó de servirse. Canonical, Open Graph y sitemap
  salen de `site`. La línea `Sitemap:` de `public/robots.txt` es estática (se copia
  tal cual desde `public/`) y no se entera del `site`: si el dominio cambia, hay que
  tocar los dos sitios a mano.
- **Las URLs del WordPress viejo redirigen con 301** desde `redirects` de
  `vercel.json` (`/shop`, `/carrito`, `/producto/…` → `/pedido/`; categorías →
  `/catalogo/`; `about-us…` → `/nosotros/`; `contact-us` → `/contactanos/`; el resto
  sin equivalente → `/`). Dos detalles de Vercel: `permanent: true` responde **308**,
  así que se usa `"statusCode": 301`; y un `source` no casa con la barra final si no
  termina en `{/}?`, y WordPress publicaba todo con barra (`/shop/`). No se redirige
  cualquier 404 al inicio: Google lo trata como *soft 404*.
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
- `vercel.json` aplica una **Content-Security-Policy sin `'unsafe-inline'` en
  `script-src`**. Nada de `<script is:inline>` con código: va a un archivo de
  `public/js/` (los de datos `type="application/json"` sí valen). Un servicio
  externo nuevo hay que añadirlo a la CSP. Tras tocarla, `npm run
  verificar:navegacion` (y `--url https://dstunja.com` después de desplegar).

## Marca

- Colores: azul oscuro #0D2C84, azul #1E88E5, naranja #F5A623, gris claro #F5F7FA, gris oscuro #263238
- Tipografía: Montserrat (Bold títulos, SemiBold subtítulos), Poppins Regular cuerpo
- Logos en public/: "logo-distribuciones.png" (completo) y "LOGO-removebg-preview.png" (ícono)

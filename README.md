# Distribuciones Santiago de Tunja — sitio web

Sitio estático hecho en **Astro + Tailwind CSS 4 (TypeScript estricto)**, pensado para
alojarse en **Cloudflare** y desplegarse solo con cada `git push`.

Es la evolución del prototipo HTML que está guardado en [`legacy-html/`](legacy-html/):
mismo diseño y mismos textos, pero ahora el encabezado, el pie y el botón de WhatsApp
viven en un solo sitio en vez de estar copiados en seis archivos.

---

## Requisitos

- **Node.js 22.12 o superior** (Astro 7 no arranca con versiones menores).
  En este equipo hay Node 22.9, así que hay que actualizarlo:
  `winget install OpenJS.NodeJS.LTS` y reabrir la terminal.

## Cómo trabajar

```bash
npm install          # una sola vez
npm run dev          # servidor local en http://localhost:4321
npm run build        # genera el sitio estático en dist/
npm run preview      # ver dist/ como quedará en producción
npm run check        # revisa tipos y errores de Astro
npm run og           # regenera la tarjeta de link (public/og.png)
npm run favicon      # regenera favicon.ico y apple-touch-icon desde el isotipo
npm run iconos       # las dos anteriores
```

## Estructura

```
src/
  data/site.ts             Datos de la empresa: teléfono, correo, marcas,
                           municipios, cifras, menú. EDITAR AQUÍ primero.
  data/vacantes.ts         Vacantes y convocatorias (listado y detalle).
  data/municipios.ts       Municipios cubiertos y sus coordenadas (mapa).
  data/innovaciones.ts     Novedades mes a mes de la página de innovación.
  lib/rutas.ts             ruta(): antepone el `base` a los enlaces internos y
                           a los archivos de public/. OBLIGATORIO usarlo.
  lib/imagenes.ts          Imágenes con reemplazo automático: si el archivo aún
                           no existe se muestra un marcador de posición (o el
                           nombre en texto, para los logos de marca).
  layouts/BaseLayout.astro Estructura común: <head>, SEO, Open Graph, JSON-LD,
                           encabezado, pie y botón flotante de WhatsApp.
  components/
    Header.astro           Menú (con versión móvil funcional).
    Footer.astro           Pie con contacto, canales y redes.
    Logo.astro             Logo oficial: completo, claro (fondo oscuro) e iso.
    Icono.astro            Todos los íconos (lucide + logos de marca).
    Testimonio.astro       Testimonio de cliente con estrellas.
    MisionVision.astro     Pestañas accesibles de Misión / Visión.
    BuscadorCobertura.astro Buscador de municipios (ignora tildes y mayúsculas).
    MapaCobertura.astro    Mapa de la sede (OpenStreetMap o Google Maps).
    MapaRed.astro          Mapa interactivo de cobertura: un punto por
                           municipio, filtros por departamento y buscador
                           (Leaflet + teselas de Esri).
    BotonPideky.astro      Botón de Pideky.
    FormularioMailto.astro Formularios de contacto, empleos y PQRS.
    PageHero.astro         Encabezado de las páginas internas.
  pages/                   Una página por archivo: index, nosotros, catalogo,
                           innovacion, empleos, contactanos, pqrs y 404.
  pages/empleos/[slug].astro  Detalle de cada vacante, con el flyer completo.
  styles/global.css        Paleta, tipografías y clases base (Tailwind 4).
public/
  logo-distribuciones.png  Logotipo horizontal (encabezado).
  LOGO-removebg-preview.png  Isotipo (pie, móvil, favicon, tarjeta OG).
  favicon.ico / apple-touch-icon.png / icon-192.png / icon-512.png
  icons/whatsapp.svg       Ícono oficial de WhatsApp, también disponible suelto.
  img/empleos/             Fotos y flyers de las vacantes.
  img/marcas/              Logotipos de las marcas que se distribuyen.
  img/innovacion/          Imágenes de las novedades.
  og.png, robots.txt
scripts/build-og.mjs       Genera la tarjeta Open Graph con Playwright.
scripts/build-favicon.mjs  Genera los íconos a partir del isotipo.
legacy-html/               El prototipo HTML original, como referencia.
```

## Qué editar y dónde

| Quiero cambiar… | Archivo |
| --- | --- |
| Teléfono, correo, dirección, redes | `src/data/site.ts` |
| Lista real de los 87 municipios | `src/data/site.ts` → `MUNICIPIOS` |
| Enlace real de Pideky | `src/data/site.ts` → `PIDEKY_URL` |
| Textos de Misión y Visión | `src/components/MisionVision.astro` |
| Colores y tipografía | `src/styles/global.css` (bloque `@theme`) |
| Foto del hero (camión / bodega) | `src/data/site.ts` → `HERO_IMAGEN` |
| Testimonio de cliente | `src/data/site.ts` → `testimonio` |
| Íconos disponibles | `src/components/Icono.astro` |
| Categorías del catálogo | `src/pages/catalogo.astro` |
| Vacantes y convocatorias | `src/data/vacantes.ts` |
| Novedades de innovación | `src/data/innovaciones.ts` |
| Municipios del mapa de cobertura | `src/data/municipios.ts` |
| Vacantes de empleo | `src/pages/empleos.astro` |
| Horario de atención | `src/pages/contactanos.astro` |

Busca `EDITAR AQUÍ` en el código: marca los textos de ejemplo que faltan por
reemplazar con la información oficial.

## Imágenes

Las fotos van en `public/img/`, en tres carpetas. **Nada se rompe si una imagen
todavía no existe**: el sitio la reemplaza solo.

| Carpeta | Para qué | Nombre del archivo | Si falta |
| --- | --- | --- | --- |
| `img/empleos/` | Foto o flyer de cada vacante | El que diga `imagen` en `src/data/vacantes.ts` | Marcador azul con el nombre del cargo |
| `img/innovacion/` | Imagen de cada novedad | El que diga `imagen` en `src/data/innovaciones.ts` | Marcador azul con el título |
| `img/marcas/` | Logotipo de cada marca | El nombre de la marca en minúsculas y con guiones | La marca se muestra como píldora de texto |

**Logos de marca**: el archivo se busca por el nombre de la marca en minúsculas
y sin tildes. `Saltín Noel` → `saltin-noel.png`, `Choco Listo` →
`choco-listo.png`. Sirven `.png`, `.svg`, `.webp`, `.jpg` y `.avif`. Se muestran
a una altura fija de 36 px para que queden parejos aunque cada logo tenga
proporciones distintas, y aparecen tanto en el catálogo como en la franja de
marcas del inicio.

**Tamaños recomendados**: 1200×900 (4:3) para las tarjetas de vacantes y
1200×675 (16:9) para innovación. El flyer vertical de una convocatoria también
sirve: en la página de detalle se muestra completo, sin recortar.

Los marcadores de posición se piden a [placehold.co](https://placehold.co) con
los colores de la marca, así que **solo se ven con conexión a internet**. En
cuanto dejes el archivo real en su carpeta y vuelvas a compilar, el marcador
desaparece sin tocar el código. Todos los puntos donde falta una imagen real
están marcados en el código con `EDITAR AQUÍ`.

## Mapa de cobertura

La sección "Cobertura nacional" del inicio dibuja un punto por municipio con
[Leaflet](https://leafletjs.com) (paquete del proyecto, no CDN) sobre el fondo
claro de Esri. Los datos están en `src/data/municipios.ts`: nombre,
departamento y coordenadas de la cabecera municipal.

**Pendiente**: buscamos el listado oficial en `ListadoAutomatizacionDST.xlsx`
(Escritorio), pero ese archivo contiene las funciones a automatizar por área,
no los municipios. Por ahora están cargados los 22 municipios que ya traía el
prototipo, con coordenadas aproximadas; los contadores siguen mostrando las
cifras oficiales (67 / 18 / 2) y la leyenda del mapa dice cuántos van
cargados. Al recibir el listado real basta con agregar una línea por municipio
en ese archivo — está marcado con `EDITAR AQUÍ`.

Los colores de cada departamento se definen una sola vez (`departamentos` en
`municipios.ts`) y se usan tanto en los contadores como en los puntos del mapa.

## Identidad visual

**Paleta** (definida en `@theme`, en `src/styles/global.css`):

| Token | Color | Uso |
| --- | --- | --- |
| `primary` | `#0D2C84` | Azul oscuro: títulos, botón principal, barra de cifras |
| `secondary` | `#1E88E5` | Azul: íconos, acentos, bordes activos |
| `secondary-dark` | `#1565C0` | Azul para texto y enlaces (contraste AA) |
| `accent` | `#F5A623` | Naranja: botón destacado, subrayados, estrellas |
| `accent-text` | `#A65F00` | Naranja legible sobre fondo claro (antetítulos, textos) |
| `base` | `#F5F7FA` | Gris muy claro: franjas alternas |
| `ink` | `#263238` | Gris oscuro: texto y pie de página |

Los botones naranja llevan texto oscuro (`ink`) porque el blanco sobre `#F5A623`
no alcanza el contraste mínimo AA. Por lo mismo, el naranja de los textos es
`accent-text` y no el naranja puro.

**Tipografía**, self-hosted con Fontsource (nada de Google Fonts por CDN):

- **Montserrat** — Bold en `h1`, SemiBold en `h2`/`h3`/`h4`, botones y menú.
- **Poppins** — Regular para todo el texto de cuerpo.

Poppins no existe como fuente variable, así que se cargan los pesos 400, 500 y
600 desde `@fontsource/poppins`; Montserrat sí es variable
(`@fontsource-variable/montserrat`).

**Logo**: `public/logo-distribuciones.png` (horizontal) en el encabezado y
`public/LOGO-removebg-preview.png` (isotipo) en el pie, en pantallas muy
pequeñas y como base de los favicons.

**Íconos**: `src/components/Icono.astro` inserta SVG en línea —
[lucide](https://lucide.dev) para la interfaz y
[simple-icons](https://simpleicons.org) para los logotipos de WhatsApp,
Facebook, Instagram y X. Todos comparten la misma micro-interacción
(`icono-int` / `icono-chip` en `global.css`): escala 1.05 y cambio de color en
200 ms, tanto con el mouse como con el foco de teclado, y desactivada si el
sistema pide menos movimiento.

## Mapa y API key

Por defecto el mapa usa **OpenStreetMap**, que no necesita API key: no hay ninguna
clave en el HTML.

Para usar Google Maps Embed API, copia `.env.example` como `.env` (está en
`.gitignore`) o define las variables en Cloudflare:

```
PUBLIC_MAPS_PROVIDER=google
PUBLIC_GOOGLE_MAPS_EMBED_KEY=la-key
```

Cualquier key de Google Maps Embed API viaja en la petición del navegador, así que
nunca es 100 % secreta: la protección real es restringirla en Google Cloud Console
por referente HTTP (solo `dstunja.com`) y limitarla a la Maps Embed API.

## Formularios

El sitio es estático y no tiene servidor, así que los formularios de contacto,
empleos y PQRS **arman un correo** con los datos y lo abren en el gestor de correo
de quien escribe. Funciona sin depender de ningún servicio externo.

Para producción conviene conectar un endpoint real (una Cloudflare Function,
Formspree, Web3Forms…) y cambiar `action`/`method` del `<form>` en
`src/components/FormularioMailto.astro`. Para PQRS es especialmente importante:
la empresa debe poder demostrar la fecha de radicación y la respuesta.

## Despliegue en Cloudflare

El sitio se compila a HTML estático en `dist/`.

- **Cloudflare Pages / Workers (recomendado):** conectar el repositorio de GitHub y
  configurar `npm run build` como comando de build y `dist` como carpeta de salida.
  Cada `git push` a `main` reconstruye y publica.
- **Manual:** `npm run deploy` (usa `wrangler.jsonc`, requiere `wrangler login`).

El dominio y los registros DNS del correo (Zoho) no se tocan al desplegar.

## SEO

- `sitemap-index.xml` generado con `@astrojs/sitemap`.
- `robots.txt` apuntando al sitemap.
- Canonical, Open Graph y Twitter Card en cada página.
- Datos estructurados `LocalBusiness` (dirección, teléfono, redes) en el layout.
- La URL del sitio se define en `astro.config.mjs` (`site`). Si el dominio cambia,
  hay que actualizarla ahí y en `public/robots.txt`.

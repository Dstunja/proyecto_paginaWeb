# Proyecto: sitio web Distribuciones Santiago de Tunja (dstunja.com)

Stack: Astro + Tailwind 4 + TypeScript.

## Reglas de trabajo

- Después de cada cambio significativo: `git add . && git commit -m "mensaje descriptivo" && git push`.
- La página se publica en **Vercel** (plan Hobby) con el dominio dstunja.com.
- En `astro.config.mjs` debe estar SIEMPRE:
  site: 'https://dstunja.com'
  sin `base` (el sitio vive en la raíz del dominio)
  adapter: vercel(), output: 'static'
  Las páginas siguen siendo estáticas. Solo `src/pages/api/**` corre como función,
  y cada ruta lo pide a mano con `export const prerender = false`.
  Las rutas a imágenes/estilos siguen pasando por `import.meta.env.BASE_URL` o por
  `src/lib/rutas.ts`: así el `base` se puede volver a poner sin tocarlas una a una.
- El workflow `.github/workflows/deploy.yml` sigue publicando en GitHub Pages, pero
  esa copia quedó rota al quitar el `base` y allí no hay funciones. Ver el apartado
  de despliegue de `docs/PQRS-ADJUNTOS.md`.
- La radicación de PQRS necesita variables de entorno (Blob, Resend, Turnstile).
  Están documentadas en `.env.example` y en `docs/PQRS-ADJUNTOS.md`.

## Marca

- Colores: azul oscuro #0D2C84, azul #1E88E5, naranja #F5A623, gris claro #F5F7FA, gris oscuro #263238
- Tipografía: Montserrat (Bold títulos, SemiBold subtítulos), Poppins Regular cuerpo
- Logos en public/: "logo-distribuciones.png" (completo) y "LOGO-removebg-preview.png" (ícono)

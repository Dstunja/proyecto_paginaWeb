# Proyecto: sitio web Distribuciones Santiago de Tunja (dstunja.com)

Stack: Astro + Tailwind 4 + TypeScript.

## Reglas de trabajo

- Después de cada cambio significativo: `git add . && git commit -m "mensaje descriptivo" && git push`.
- La página se publica en GitHub Pages (solo para revisión interna). El deploy final será en Hostinger con el dominio dstunja.com; no configurar nada de Hostinger todavía.
- En `astro.config.mjs` debe estar SIEMPRE:
  site: 'https://dstunja.github.io'
  base: '/proyecto_paginaWeb'
  No cambiar estos valores. Todas las rutas a imágenes/estilos deben respetar el `base` (usar `import.meta.env.BASE_URL` o rutas relativas).

## Marca

- Colores: azul oscuro #0D2C84, azul #1E88E5, naranja #F5A623, gris claro #F5F7FA, gris oscuro #263238
- Tipografía: Montserrat (Bold títulos, SemiBold subtítulos), Poppins Regular cuerpo
- Logos en public/: "logo distribuciones-13.png" (completo) y "LOGO-removebg-preview.png" (ícono)

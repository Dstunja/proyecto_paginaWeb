# Estadísticas de la página — guía para la empresa

Las visitas de dstunja.com se cuentan con **Vercel Web Analytics**, la
analítica del mismo servicio donde está publicada la página.

## Qué se decidió y por qué (10/10/2026)

- Antes el sitio tenía preparado Google Analytics 4 a través de Google Tag
  Manager, detrás de una franja de cookies. En producción **nunca tuvo un ID de
  contenedor** (el HTML de dstunja.com no cargaba ningún script de Google), así
  que no medía nada y la franja de cookies pedía permiso para algo que no
  pasaba.
- Se cambió por Vercel Web Analytics porque **no usa cookies ni identifica a la
  persona entre visitas o entre sitios**: no hace falta pedir consentimiento, y
  la franja de cookies se quitó.
- El script se sirve desde el propio dominio (`/_vercel/insights/script.js`) y
  envía las visitas al mismo dominio, así que la Content-Security-Policy de
  `vercel.json` no necesita ningún servicio externo nuevo.

## Cómo se activa (una sola vez)

1. Entrar a <https://vercel.com>, abrir el proyecto **paginaweb**.
2. Pestaña **Analytics** → **Enable**.
3. Volver a desplegar (o esperar al siguiente push a `main`).

Hasta que no se active en el panel, el script responde 404 y no se cuenta
nada; la página funciona igual.

## Quién ve las estadísticas

Quien tenga acceso al proyecto en Vercel, en la pestaña **Analytics**: visitas,
páginas más vistas, de dónde llegan (buscador, redes, enlace directo), país,
dispositivo y navegador.

## Eventos propios (clics en WhatsApp, secciones vistas, envíos)

El código sigue llamando a `registrarEvento()` (src/lib/analitica.ts) en los
mismos sitios que antes, pero **no manda nada** mientras
`EVENTOS_PERSONALIZADOS` sea `false`: los eventos propios de Vercel solo
existen en los planes Pro y Enterprise, y el proyecto está en Hobby. Si algún
día se cambia de plan, basta con poner esa constante en `true`.

Los términos de búsqueda que parezcan datos personales (una arroba o siete o
más dígitos seguidos) se reemplazan por `[omitido]` antes de salir del
navegador (`limpiarTermino`).

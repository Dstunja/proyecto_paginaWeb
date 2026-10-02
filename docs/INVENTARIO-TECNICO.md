# Inventario técnico — sitio web de Distribuciones Santiago de Tunja

Documento de entrega para quien vaya a administrar la infraestructura del sitio
**dstunja.com**. Describe dónde está alojado cada pedazo, qué servicios externos
hace falta pagar o renovar, qué variables de configuración existen y qué está
pendiente.

**Fecha del levantamiento: 2 de octubre de 2026.**

Cómo leer este documento:

- Lo marcado **(comprobado)** se verificó contra el sistema real ese día, con el
  comando o la consulta que se indica al lado. Cualquiera puede repetirlo.
- Lo marcado **(deducción)** sale de leer el código junto con un hecho
  comprobado. Es razonamiento, no observación, y conviene confirmarlo antes de
  apoyar una decisión grande en él.
- **Aquí no hay ni una sola credencial.** Las variables de entorno se nombran y
  se explica para qué sirven, nunca su valor. Los valores se consultan en el
  panel de Vercel, que es el único sitio donde viven.

---

## 1. Resumen en diez líneas

| | |
| --- | --- |
| Dominio | `dstunja.com` |
| Alojamiento | **Vercel**, plan Hobby. Proyecto `paginaweb`, equipo `practicaspasantiasdst-6024` |
| DNS | **Hostinger** (el dominio no usa los nameservers de Vercel) |
| Framework | **Astro 7** (sitio estático) + Tailwind CSS 4 + TypeScript, Node ≥ 22.12 |
| Repositorio | GitHub, `dstunja/proyecto_paginaWeb`. Rama de producción: `main` |
| Despliegue | Automático: cada push a `main` publica en Vercel |
| Espejo | GitHub Pages, `https://dstunja.github.io/proyecto_paginaWeb` (revisión interna, sin backend) |
| Backend | Solo 8 funciones serverless bajo `/api/`. El resto del sitio es HTML estático |
| Servicios externos | Resend (correo), Cloudflare Turnstile (antirrobots), Vercel Blob (archivos), Google Tag Manager (analítica) |
| Base de datos | **Ninguna.** No hay base de datos en todo el proyecto |

---

## 2. Alojamiento y despliegue

### 2.1 Dónde está el sitio

El sitio lo sirve **Vercel**. Comprobado el 02/10/2026 con
`curl -sI https://dstunja.com/`: responde `HTTP/1.1 200 OK` con la cabecera
`Server: Vercel`, y la IP del dominio es `216.198.79.1`, que es una dirección de
la red anycast de Vercel.

Datos del proyecto, tomados de `.vercel/project.json` del repositorio:

- Nombre del proyecto en Vercel: **`paginaweb`**
- Equipo / organización: **`practicaspasantiasdst-6024`**
- Plan: **Hobby** (gratuito). Esto importa para cuatro cosas concretas: los
  registros de ejecución duran **una hora**; los crons admiten **como máximo una
  ejecución al día** y se disparan con una precisión de ±59 minutos (el *número*
  de crons no es el problema: el plan permite 100 por proyecto); **no hay
  direcciones IP de salida fijas**, lo que importa si algún sistema externo
  filtra por IP de origen; y no hay soporte comercial.

Existe además un `wrangler.jsonc` en la raíz, que es configuración de Cloudflare
Workers. **No está en uso:** no hay despliegue en Cloudflare y el sitio no se
sirve desde allí (comprobado: la IP del dominio es de Vercel y la cabecera
`Server` dice `Vercel`). Es un resto de una evaluación anterior.

### 2.2 Cómo se despliega

Hay **dos destinos**, y los dos se disparan con el mismo push:

**a) Vercel — la publicación real.**
La integración de GitHub con Vercel está activa sobre la rama `main`. Un push a
`main` lanza el build y, si compila, publica en `dstunja.com` sin intervención de
nadie. No hay aprobación manual, no hay entorno de *staging* intermedio. Los
pushes a otras ramas generan **despliegues de vista previa** con una URL propia,
que sirven para revisar antes de fusionar.

> **Consecuencia operativa:** fusionar una rama en `main` **es publicar en
> producción**. Conviene tratarlo como tal.

**b) GitHub Pages — espejo de revisión interna.**
Lo publica el workflow `.github/workflows/deploy.yml` (acción
`withastro/action@v5`), también con cada push a `main`. Queda en
`https://dstunja.github.io/proyecto_paginaWeb`.

Este espejo **no tiene backend**: en GitHub Pages no existen las funciones de
`/api/`, así que el formulario de empleos y el de PQRS no pueden enviar nada allí.
El formulario lo detecta (la respuesta no es JSON) y muestra un aviso pidiendo
entrar a `dstunja.com` o escribir por WhatsApp. **No es un sitio de respaldo:**
es una copia para mirar diseño y contenido.

### 2.3 El detalle que rompe los despliegues si se toca mal

`astro.config.mjs` elige `site` y `base` **según la variable de entorno
`VERCEL`**, que Vercel define con valor `'1'` en todos sus builds:

- En Vercel: `site = https://dstunja.com`, **sin `base`** (el sitio cuelga de la
  raíz del dominio).
- Fuera de Vercel (GitHub Actions): `site = https://dstunja.github.io` y
  `base = '/proyecto_paginaWeb'`, porque es un *project site* y cuelga de un
  subdirectorio.

Si se fija uno de los dos a mano, el otro despliegue se rompe: sin `base`, los
archivos de `/_astro/` dan 404 en GitHub Pages y el sitio se ve sin estilos.
Ninguna ruta interna del código se escribe a mano por eso mismo: todas pasan por
`ruta()` de `src/lib/rutas.ts` o por `import.meta.env.BASE_URL`.

Con el adaptador de Vercel puesto, el build deja el sitio en **`dist/client/`**
(no en `dist/`) y la función en `dist/server/`. Por eso el workflow de Pages
necesita `out-dir: dist/client`.

### 2.4 Cabeceras de seguridad y redirecciones

Las define `vercel.json` y **solo aplican en Vercel** (GitHub Pages no sirve
cabeceras personalizadas):

- **Content-Security-Policy sin `'unsafe-inline'` en `script-src`.** Es la
  restricción que más condiciona el desarrollo: ningún script puede ir en línea
  en el HTML, todos salen como archivos de `/_astro/` o de `/public/js/`. Los
  únicos orígenes externos permitidos para scripts son
  `challenges.cloudflare.com` (Turnstile) y `www.googletagmanager.com`.
  **Añadir cualquier servicio externo nuevo exige tocar esta política**, o el
  navegador lo bloquea sin mostrar error visible.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- `Access-Control-Allow-Origin: https://dstunja.com`.
- **Redirecciones 301 del WordPress anterior**: `/shop`, `/carrito`,
  `/producto/…` → `/pedido/`; categorías y marcas → `/catalogo/`;
  `about-us…` → `/nosotros/`; `contact-us` → `/contactanos/`; el resto sin
  equivalente → `/`. Se usa `"statusCode": 301` y no `permanent: true`, porque
  en Vercel `permanent` responde 308.

Tras tocar la CSP: `npm run verificar:navegacion` (y
`npm run verificar:navegacion -- --url https://dstunja.com` después de desplegar).

---

## 3. DNS y dominio

**Todo lo de esta sección se comprobó el 02/10/2026** consultando al DNS público
de Google (`nslookup … 8.8.8.8`) y con `npm run verificar:correo`, que no necesita
ninguna credencial.

| Qué | Valor comprobado |
| --- | --- |
| Nameservers de `dstunja.com` | `nova.dns-parking.com`, `cosmos.dns-parking.com` → **Hostinger** |
| `dstunja.com` (A) | `216.198.79.1` → Vercel |
| `www.dstunja.com` | CNAME → `dstunja.com` |
| MX en la raíz | **No existe ninguno** |
| SPF, DKIM, DMARC | **No existe ninguno** |
| Contacto SOA | `dns.hostinger.com` |

Tres lecturas de esa tabla:

1. **El DNS se administra en Hostinger, no en Vercel.** Para cambiar o añadir
   registros: hPanel → Dominios → dstunja.com → DNS / Nameservers → Administrar
   registros DNS. Vercel solo recibe el tráfico; no puede crear registros.
2. **El dominio no puede recibir correo.** Sin MX en la raíz, no existe ni puede
   existir un buzón `@dstunja.com`. Hoy todos los buzones del sitio son cuentas
   de Gmail. Un buzón del dominio es una contratación aparte (Google Workspace,
   el correo de Hostinger) con sus propios MX.
3. **El dominio no está autenticado para enviar.** Falta SPF, DKIM y DMARC, y
   por eso Resend no ha podido verificar `dstunja.com`. Ver el pendiente 7.1.

### `www` no funciona hoy

**Comprobado el 02/10/2026.** El certificado TLS que sirve Vercel tiene
`subject=CN=dstunja.com` y un único nombre alternativo, `DNS:dstunja.com`. Un
navegador que entre por `https://www.dstunja.com` recibe un error de certificado
antes de ver nada del sitio (`curl` devuelve
`SEC_E_WRONG_PRINCIPAL`, código 60). El DNS de `www` sí está bien: es un CNAME al
apex. Lo que falta es declarar `www.dstunja.com` como dominio en Vercel, para que
emita el certificado. Ver el pendiente 7.2.

---

## 4. Servicios externos

Cuatro servicios, y ninguno es opcional en producción. Lo que hace falta de cada
uno para la entrega es: quién es el titular de la cuenta, y qué deja de funcionar
si se cae o se pierde el acceso.

### 4.1 Resend — envío de correo transaccional

Es **lo único que mueve correo** en el sitio: las postulaciones de empleo y los
avisos de PQRS salen por aquí. No hay servidor SMTP propio.

**Hay DOS cuentas de Resend, y eso es un problema conocido, no un diseño.**

| Cuenta | Registrada con | Variable con su clave | Qué manda |
| --- | --- | --- | --- |
| Empleos | `ghsantiagodetunja@gmail.com` | `RESEND_API_KEY` | Postulaciones a Talento Humano |
| PQRS | `informacioncomercialdst@gmail.com` | `PQRS_RESEND_API_KEY` | Aviso de radicación al área y recados administrativos |

El remitente de hoy es **`onboarding@resend.dev`**, el remitente de pruebas de
Resend, en las dos cuentas. Tiene una consecuencia que explica casi todas las
rarezas de la configuración: **con ese remitente, Resend solo entrega al correo
del titular de la cuenta.** De ahí que:

- El buzón de destino de cada formulario tenga que ser el titular de su cuenta.
- La **constancia al ciudadano que radica una PQRS no se envíe nunca** (el código
  lo sabe y ni lo intenta: devuelve `constancia: 'omitida'`). Viene así desde el
  07/09/2026, el día que la radicación entró en producción.
- **Cambiar un buzón de destino sin cambiar antes el remitente rompe el
  formulario entero, y en silencio.** El orden correcto es: primero remitente de
  dominio verificado, comprobar que llega, y solo después cambiar el destino.

Las dos cuentas **no pueden verificar `dstunja.com` a la vez**: cada una genera su
propia clave DKIM y las dos la publicarían en el mismo nombre,
`resend._domainkey.dstunja.com`, con valores distintos. La decisión ya tomada es
consolidar en la cuenta de `RESEND_API_KEY` y borrar `PQRS_RESEND_API_KEY`; el
orden de los pasos está en `docs/PLAN-CORREO-DOMINIO.md` y **no se puede alterar**.

El plan gratuito de Resend responde **429** cuando llegan varios envíos seguidos.
Por eso el envío de postulaciones reintenta tres veces (ver 6.6).

### 4.2 Cloudflare Turnstile — antirrobots

Protege tres formularios: postulación de empleo, radicación de PQRS y contacto
administrativo. Es la alternativa a un reCAPTCHA; en modo `interaction-only` el
candidato normalmente no ve nada.

- En el navegador: widget de `challenges.cloudflare.com`, con la clave pública
  `PUBLIC_TURNSTILE_SITE_KEY`.
- En el servidor: cada endpoint valida el token contra
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` con
  `TURNSTILE_SECRET`.
- **Falla cerrado:** si `TURNSTILE_SECRET` no está configurada, el servidor
  **rechaza** en vez de dejar pasar. Es deliberado: dejar pasar cuando falta
  configuración es la forma habitual de publicar un formulario sin protección sin
  enterarse.
- Un token es **de un solo uso**. El formulario de PQRS pide uno por archivo que
  sube más uno para radicar.

El dominio tiene que estar autorizado en la configuración del widget en el panel
de Cloudflare. Si no lo está, el código de error es `110200`.

### 4.3 Vercel Blob — almacenamiento de archivos

Un *object store* de Vercel. Store llamado **`pqrs-adjuntos`**, con todos los
blobs en `access: 'private'` (fijo en el código, no configurable): un blob privado
no se abre con su URL a secas.

Dos usos, con prefijos distintos dentro del mismo store:

| Prefijo | Qué guarda | Borrado |
| --- | --- | --- |
| `pqrs/pendientes/` | Soportes que alguien subió y nunca radicó | Cron diario, 24 h. **Hoy no funciona**, ver 7.3 |
| `pqrs/<radicado>/` | Soportes de una PQRS radicada | Ninguno automático |
| `empleos/EMP-…/` | Hoja de vida + `registro.json` de las postulaciones **cuyo correo falló** | Programado pero apagado, ver 7.8 |

Como los blobs son privados, los correos no llevan la URL del archivo: llevan un
enlace firmado a `/api/pqrs/descarga` o `/api/empleos/descarga`, con **caducidad
de 7 días**, que redirige a una URL de Blob de vida corta.

Las variables `BLOB_*` **las pone Vercel solo** al conectar el store al proyecto
(Storage → pqrs-adjuntos → Connect). No se copian a mano.

### 4.4 Google Tag Manager — analítica

La medición entra por **un contenedor de Google Tag Manager**, y la etiqueta de
GA4 vive dentro del contenedor, creada a mano en la interfaz de Tag Manager. En
el código no hay `gtag.js` directo y **no debe haberlo**: tenerlo además del
contenedor haría que GA4 contara cada página vista dos veces.

El ID del contenedor va en `PUBLIC_GTM_CONTAINER_ID`. Es una variable pública (el
ID viaja en el HTML de todas las páginas, no hay nada que esconder) y se lee **en
tiempo de build**: cambiarla exige recompilar y redesplegar.

> ⚠️ **Hoy no se está midiendo nada. (comprobado el 02/10/2026)** La variable
> `PUBLIC_GTM_CONTAINER_ID` **no está definida en Vercel** en ningún entorno, y el
> HTML de `https://dstunja.com/` no contiene ninguna referencia a
> `googletagmanager` ni a `dataLayer`. El código está puesto y funciona; lo que
> falta es la variable. Ver el pendiente 7.6.

Detalle completo en `docs/ANALITICA.md`.

---

## 5. Variables de entorno

**Solo nombres.** Los valores se consultan en Vercel → Settings → Environment
Variables, o con `npx vercel env ls production`, que lista nombres sin revelar
valores.

La columna «Dónde está» se **comprobó el 02/10/2026** con
`npx vercel env ls production`, `… preview` y `… development`.

Dos cosas que conviene saber antes de leer la tabla:

- Las que empiezan por **`PUBLIC_`** se leen **en tiempo de build** y acaban
  dentro del JavaScript que descarga el navegador. **Ahí no puede ir ningún
  secreto**, y cambiarlas exige redesplegar.
- Las demás las leen las funciones **en cada petición**: cambiarlas en el panel
  surte efecto en el siguiente despliegue, sin recompilar el sitio.

### 5.1 Las que están configuradas

| Variable | Para qué sirve | Dónde está | Secreta |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Clave de la cuenta de Resend de **Empleos**. Sin ella, ninguna postulación se envía por correo | Production | Sí |
| `EMPLEOS_DESTINO` | Buzón de Talento Humano que recibe las postulaciones. Opcional: por defecto el correo publicado en `/empleos/` | Production | No |
| `EMPLEOS_REMITENTE` | Dirección desde la que sale el correo de postulación. Opcional: por defecto `onboarding@resend.dev` | Production | No |
| `PQRS_RESEND_API_KEY` | Clave de la cuenta de Resend de **PQRS**. Si falta, PQRS usa `RESEND_API_KEY`. **En vías de desaparecer**, ver 4.1 | Production | Sí |
| `PQRS_DESTINO` | Buzón que recibe las PQRS comerciales y los recados administrativos | Production | No |
| `PQRS_REMITENTE` | Remitente de los correos de PQRS. Mientras sea `@resend.dev`, la constancia al ciudadano no se envía | Production | No |
| `PUBLIC_TURNSTILE_SITE_KEY` | Clave **pública** del widget de Turnstile. Va en el HTML | Production | No |
| `TURNSTILE_SECRET` | Clave secreta con la que el servidor valida el token de Turnstile. Sin ella se rechaza todo envío | Production | Sí |
| `BLOB_READ_WRITE_TOKEN` | Token del store `pqrs-adjuntos`. Guarda archivos y firma enlaces de descarga. **La usan PQRS y Empleos** | Preview, Production | Sí |
| `BLOB_STORE_ID` | Identificador del store (autenticación OIDC). El código no la usa, pero no estorba | Preview, Production | No |
| `BLOB_WEBHOOK_PUBLIC_KEY` | Clave pública para subidas con URL prefirmada. El código no la usa | Preview, Production | No |

### 5.2 Las que el código entiende y NO están configuradas

Cada ausencia tiene una consecuencia concreta. Esta es la parte de la tabla que
conviene revisar primero al tomar la administración.

| Variable | Para qué serviría | Qué pasa hoy por no estar |
| --- | --- | --- |
| `PUBLIC_GTM_CONTAINER_ID` | ID del contenedor de Tag Manager | **No se mide nada.** El sitio se publica sin analítica, sin fallar. Ver 7.6 |
| `CRON_SECRET` | Autoriza los endpoints de limpieza (`Authorization: Bearer`) | **El cron de limpieza de PQRS responde 503 todos los días.** Los soportes abandonados no se borran nunca. Ver 7.3 |
| `UPSTASH_REDIS_REST_URL` | Límite de peticiones por IP compartido entre instancias | El contador vive en la memoria de cada instancia: frena un script torpe, **no un ataque**. Ver 7.4 |
| `UPSTASH_REDIS_REST_TOKEN` | Igual que la anterior | Igual |
| `PQRS_IP_SALT` | Sal del hash de la IP de quien radica | La IP se sigue guardando hasheada y nunca en claro, pero **sin sal el hash se puede deshacer** recorriendo el espacio de direcciones IPv4. El registro lo marca con `ipHashSalada: false` |
| `EMPLEOS_RETENCION_MESES` | Plazo de conservación de hojas de vida (por defecto 6) | Se usa el valor por defecto. Da igual mientras el cron esté apagado |
| `EMPLEOS_RETENCION_ACTIVA` | Enciende el borrado real (solo el valor exacto `'1'`) | El borrado de hojas de vida **no se ejecuta**. Ver 7.8 |
| `PQRS_ADJUNTO_MAX_MB`, `PQRS_MAX_ARCHIVOS` | Límites de adjuntos que aplica el servidor | Se usan los valores por defecto del código (5 MB, 3 archivos) |
| `PUBLIC_PQRS_ADJUNTO_MAX_MB` | El mismo límite, para que el navegador avise antes de subir | Se usa el valor por defecto |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` | Traer las reseñas reales de Google | La sección de reseñas del inicio se alimenta de un archivo local con datos de ejemplo |

### 5.3 El entorno de **Preview** está casi vacío

**Comprobado el 02/10/2026:** en Preview solo existen las tres variables
`BLOB_*`. En Development no hay ninguna.

**(Deducción, a partir del código y de esa comprobación.)** Un despliegue de vista
previa, por tanto, no tiene clave de Turnstile ni de Resend. Siguiendo el camino
del código, una postulación enviada desde una vista previa acabaría así: Turnstile
rechaza por falta de secreto (403), el formulario reenvía como «sin verificar», el
correo falla porque no hay `RESEND_API_KEY`, y la red de seguridad **guarda la
hoja de vida en el Blob** (que sí está configurado en Preview) devolviendo
«Postulación enviada» con una referencia. Es decir: **se puede llenar el Blob de
postulaciones de prueba que nadie recibe por correo.** Conviene no usar las vistas
previas para probar el formulario con datos reales, o configurar en Preview al
menos las claves de prueba de Turnstile.

### 5.4 Comandos útiles

```
npx vercel env ls production      # qué variables hay (NO muestra los valores)
npx vercel env pull .env.local    # trae las de Development a un archivo local
npm run check:env                 # comprueba que no falta ninguna
```

---

## 6. Endpoints de API

Ocho rutas, todas bajo `src/pages/api/`. El sitio es estático (`output: 'static'`)
y cada una de estas rutas pide ser función a mano con
`export const prerender = false`.

**Solo existen en Vercel.** En GitHub Pages devuelven el HTML del 404 en vez de
JSON; los formularios lo detectan y avisan.

Todas responden `405` con la cabecera `Allow` a cualquier método que no sea el
suyo, en vez de un 404 confuso, y `cache-control: no-store`.

### 6.1 Postulaciones de empleo

| Ruta | Método | Qué hace |
| --- | --- | --- |
| `/api/empleos/postular` | POST | **Recibe la postulación.** Multipart con los campos y la hoja de vida (el archivo sí pasa por la función). Valida, limita por IP, comprueba Turnstile y manda el correo a Talento Humano con la hoja de vida adjunta. Si el correo no sale, guarda la postulación en el Blob. Detalle completo en el capítulo 6 bis |
| `/api/empleos/descarga` | GET | **Abre una hoja de vida puesta a salvo en el Blob.** Solo aparece en el correo de aviso que sale cuando el adjunto falló. Verifica la firma y la caducidad del enlace (7 días) y redirige a una URL de Blob de vida corta. Solo admite rutas `empleos/EMP-…/<uuid>.<ext>`: **no deja descargar `registro.json`**, que tiene los datos de contacto del candidato, ni ninguna ruta de PQRS, aunque la firma sea válida |
| `/api/empleos/limpieza` | GET | **Borra las hojas de vida que pasaron del plazo de conservación** (Ley 1581). Pide `Authorization: Bearer $CRON_SECRET`. **No está declarado como cron en `vercel.json`: nadie lo llama hoy**, y aunque se llamara, sin `EMPLEOS_RETENCION_ACTIVA='1'` solo hace un simulacro. Dos cerrojos a propósito: un borrado irreversible de datos personales no se enciende solo |

### 6.2 PQRS

| Ruta | Método | Qué hace |
| --- | --- | --- |
| `/api/pqrs` | POST | **Radica la solicitud comercial.** Recibe JSON (no multipart): los archivos ya están en el Blob y aquí llegan solo sus rutas. Descarga cada blob, comprueba sus bytes mágicos, lo mueve a la carpeta del radicado, escribe el registro, genera el número de radicado y avisa al área por correo |
| `/api/pqrs/token` | POST | **Firma un permiso para subir un soporte directamente al Blob**, sin pasar por la función. Existe porque una función de Vercel rechaza cuerpos de más de 4,5 MB y el tope por archivo es 5 MB. El permiso restringe tipo, tamaño y ruta. Es la primera puerta, no la única: la comprobación seria del contenido la hace `/api/pqrs` |
| `/api/pqrs/administrativa` | POST | **Manda un recado del bloque administrativo.** No radica: no genera número, no admite adjuntos, no escribe en el Blob. Acaba en el mismo buzón que las PQRS comerciales, separado por el asunto |
| `/api/pqrs/descarga` | GET | **Abre un soporte de una PQRS** desde el correo al área. Misma mecánica de enlace firmado que la descarga de empleos |
| `/api/pqrs/limpieza` | GET | **Borra los soportes que se subieron y nunca se radicaron** (más de 24 h en `pqrs/pendientes/`). Lo llama el cron declarado en `vercel.json`, **diario a las 04:00**. Pide `Authorization: Bearer $CRON_SECRET`, y sin esa variable responde 503 en vez de quedar abierto. ⚠️ **Hoy devuelve 503, ver 7.3** |

---

## 6 bis. El recorrido completo de una postulación

Esto es lo que pasa desde que un candidato pulsa **«Enviar postulación»** en
`/empleos/` hasta que el correo aparece (o no) en el buzón de Talento Humano.
Sale de leer `src/components/FormularioEmpleo.astro`, `src/lib/empleos/postular.ts`
y `src/lib/empleos/correo.ts`.

**La regla que ordena todo el diseño:** una persona que llenó el formulario y
adjuntó su hoja de vida **no se puede quedar sin postular**. Varias decisiones
de abajo parecen laxas vistas de una en una, y se entienden leídas con esa regla
delante.

### El camino normal

**1. En el navegador, antes de enviar.** El formulario valida en el propio
navegador que estén nombre, correo, teléfono, cargo y la casilla obligatoria de
autorización de datos (Ley 1581), y que la hoja de vida sea **PDF, DOC o DOCX de
4 MB como máximo**. El tope es 4 MB y no 5 porque el archivo viaja dentro del
cuerpo de la petición, y Vercel rechaza cuerpos de más de 4,5 MB con un 413 antes
de que el código vea nada. La comprobación la hace el mismo módulo que usará el
servidor, así que el aviso y el rechazo no se pueden contradecir.

**2. Token de Turnstile.** Se pide el token al widget de Cloudflare. Si Cloudflare
decide que hace falta marcar una casilla, el reloj del tope corto se para y la
página avisa de qué hay que hacer. Si el reto falla con un error de la familia
`600xxx`, **la librería reinicia el widget y lo reintenta una vez sola**, sin
pedirle nada al candidato.

**3. Envío.** `POST /api/empleos/postular` con todo el formulario como multipart,
más el token.

**4. El servidor comprueba, en este orden** — primero lo barato y local, después
lo que cuesta una llamada de red, para que un 400 no gaste un token de Turnstile,
que es de un solo uso:

| # | Comprobación | Si falla |
| --- | --- | --- |
| a | El cuerpo es `multipart/form-data` y se puede leer | `400` `E-CUERPO` |
| b | **Campo trampa** (`sitio-web`, oculto en el HTML): si viene lleno, es un robot | `200` vacío, **sin enviar nada**. No se le dice qué lo delató. Queda en el registro como `rechazo:campo-trampa` |
| c | Campos obligatorios, forma del correo, cargo de la lista cerrada, y que la hoja de vida sea **de verdad** lo que dice su extensión (bytes mágicos: `%PDF`, contenedor OLE2, ZIP con carpeta `word/`) | `400` `E-DATOS`, con **todos** los errores a la vez |
| d | Límite de peticiones por IP (ver más abajo) | `429` `E-LIMITE` con los minutos de espera |
| e | Token de Turnstile contra `siteverify` de Cloudflare | `403` `T-<código de Cloudflare>` |

**El límite por IP de hoy es de 20 postulaciones cada 10 minutos**, contando por
IP **más huella del archivo**. Es más alto de lo que parece razonable y es
deliberado: sin Upstash el contador vive en la memoria de cada instancia, así que
no frena a nadie decidido y lo único que puede hacer es no estorbar. Claro, Tigo y
Movistar sacan a muchos clientes por una misma IP pública: con un tope de cinco,
un grupo de WhatsApp donde se comparte una vacante dejaría fuera al sexto que lo
intente, y ese error es indistinguible para él de que la página esté rota.

**5. El correo.** Un correo a `EMPLEOS_DESTINO`, desde `EMPLEOS_REMITENTE`, con
**`replyTo` al correo del candidato** (para contestarle desde la bandeja sin
copiar direcciones) y **la hoja de vida adjunta**. El teléfono va como enlace
`tel:` y el correo como `mailto:`, para contestar desde el celular con un toque.
**No hay correo de confirmación al candidato:** la confirmación es la pantalla.

**6. Respuesta.** `200 {ok: true}` y la pantalla de confirmación. En el registro
queda una línea `enviada` con el **id que devolvió Resend**, el cargo, el tamaño
del archivo, los intentos y si la red de seguridad estaba en pie. **Sin datos
personales:** ni nombre, ni correo, ni teléfono, ni nombre de archivo, ni IP.

### Qué pasa si Turnstile falla

Hay tres fallos distintos y cada uno se trata diferente.

**a) El navegador del candidato no consigue el token.** Pasa de verdad: un WebView
de WhatsApp, un bloqueador de publicidad, una red corporativa, un teléfono viejo.
La librería ya reintentó una vez. Entonces **la postulación se manda igual**, con
la marca `sin_verificar` y el código del fallo, y el servidor **la acepta**, con
dos diferencias:

- **Límite mucho más estrecho:** 3 cada 30 minutos, por IP y huella del archivo.
- **El correo llega marcado `[SIN VERIFICAR]` al principio del asunto** —ahí es
  donde se lee en la lista de la bandeja, sin abrir el correo— y con un bloque de
  aviso naranja dentro, explicando que el reto no se pudo resolver y que sí se
  comprobaron los datos y que el archivo es un documento real.

Es un intercambio consciente: esa puerta también la puede usar un robot, y la
defensa que queda es el campo trampa, la validación de campos, la firma real del
archivo y ese límite estrecho. **Si un día entra basura, lo que hay que mirar es
el contador de `aceptada:sin-verificar` en el registro.**

**b) El servidor rechaza el token** (`403`): caducado, ya usado
(`timeout-or-duplicate`), o de un dominio que el widget no tiene autorizado
(`110200`). Para la persona es indistinguible de que el reto no funcione, así que
**el formulario lo reenvía una sola vez como «sin verificar»** en vez de dejarla
fuera. Si ya iba sin verificar, no hay nada que reintentar y se muestra el error
con su código corto visible (del estilo `T-110200`), para que una captura de
pantalla diga la causa sin abrir la consola.

**c) `TURNSTILE_SECRET` no está configurada en el servidor.** Se **rechaza** (403,
código `falta-secreto`). Falla cerrado a propósito. Es lo que ocurriría hoy en un
despliegue de vista previa (ver 5.3).

### Qué pasa si Resend falla

Aquí está la parte más importante del diseño, y también el único agujero que
queda.

**1. Se reintenta tres veces.** Pausas de 500 ms y 1500 ms: dos segundos de reloj
en el peor caso. El tope lo pone la duración máxima de una función de Vercel, que
también tiene que dar para leer 4 MB de multipart. Crecen poco porque el fallo que
se arregla esperando es el **429 del plan gratuito de Resend**, y ese cede en el
orden del segundo, no del minuto. Lo único que no se reintenta es la falta de
`RESEND_API_KEY`: insistir tres veces sobre una clave que no existe es dar el
mismo error más tarde.

**2. Si los tres intentos fallan, la hoja de vida se guarda en el Blob.** Bajo
`empleos/EMP-20261002-A7K2M9/`, con dos archivos: la hoja de vida y un
`registro.json` con nombre, correo, teléfono, cargo y experiencia —exactamente lo
que el candidato autorizó a tratar al marcar la casilla—. **Primero el archivo,
después el registro:** si el registro falla, la postulación ya está a salvo y se
sigue adelante, porque perder el JSON es perder datos de contacto que también van
en el correo de aviso, y perder el archivo es perder la postulación.

**3. Un último intento de correo, sin adjunto y con enlace firmado** al archivo ya
guardado (caducidad 7 días). Si lo que hacía fallar el envío era el peso del
adjunto, este sí sale: un correo de dos kilobytes no roza límites que uno de 4 MB
sí. Queda en el registro como `enviada:con-enlace`.

**4. Desenlaces posibles, y qué ve cada uno:**

| Situación | HTTP | Qué ve el candidato | Qué queda | Línea del registro |
| --- | --- | --- | --- | --- |
| Correo con adjunto, a la primera o tras reintentos | `200` | «Postulación enviada» | El correo en la bandeja | `enviada` + `idResend` |
| Correo con adjunto falló, el de enlace salió | `200` | «Postulación enviada» | Correo con enlace + copia en el Blob | `enviada:con-enlace` |
| **Ni con adjunto ni con enlace** | `200` | «Postulación enviada» **con una referencia `EMP-…`** | **Solo la copia en el Blob. Nadie en Talento Humano se ha enterado** | `guardada:sin-correo` + un `console.error` |
| No hay `BLOB_READ_WRITE_TOKEN` | `500` `E-CORREO` | «Inténtalo de nuevo o escríbenos por WhatsApp» | **Nada. La postulación se pierde** | `fallo:correo-sin-respaldo` |

> ⚠️ **El riesgo real que queda, y conviene que quede dicho:** en el tercer caso
> la postulación **existe** pero **nadie recibe un aviso**. Alguien tiene que
> entrar al store de Blob a buscarla. Y como los registros de Vercel duran una
> hora en el plan Hobby (7.5), pasada esa hora **no queda rastro consultable de
> que ocurrió**. Es exactamente la forma que tendría un fallo silencioso. Mitigarlo
> es el objeto de la propuesta de `docs/EMPALME-CONTROL360.md`, sección «Registro».
>
> El cuarto caso no puede ocurrir hoy en producción: `BLOB_READ_WRITE_TOKEN` está
> configurada (comprobado el 02/10/2026). Por eso esa variable **es obligatoria**,
> aunque el `.env.example` la liste como algo que Vercel pone solo.

### Cómo comprobar que una postulación concreta llegó

```
npx vercel logs --environment production --since 10m --search "empleos/postular"
```

Una línea `enviada` con `intentos:1` y su `idResend` es el camino bueno.
**Ojo con lo que significa `enviada`:** que Resend **aceptó** la petición, no que
el correo llegara. La entrega pasa después y puede acabar en rebote, queja o lista
de supresión sin que la función lo sepa. Con el `idResend`, `GET /emails/{id}` de
la API de Resend devuelve el `last_event` y resuelve la duda en un paso.

---

## 7. Pendientes conocidos

Ordenados por lo que cuesta no arreglarlos, no por dificultad.

### 7.1 `dstunja.com` no está verificado en Resend

**Comprobado el 02/10/2026 con `npm run verificar:correo`:** faltan los **tres**
registros obligatorios (MX de `send`, SPF en `send`, DKIM en
`resend._domainkey`) y también el DMARC recomendado. No hay ni un TXT en el
dominio.

**Qué cuesta:** los correos salen desde `onboarding@resend.dev`, un remitente
compartido y sin relación con el dominio. Hoy entrega —el 30/09/2026 se comprobó
que tres correos de prueba, uno con adjunto de 1 MB, llegaron a **Recibidos** y no
a spam— y puede dejar de hacerlo cualquier día sin avisar. Además **la constancia
al ciudadano que radica una PQRS no se envía desde el 07/09/2026**, y mientras
haya dos cuentas de Resend ninguna puede verificar el dominio.

**No es una emergencia**, pero es una deuda que se está pagando en silencio.

**Qué hacer:** `docs/PLAN-CORREO-DOMINIO.md` tiene los seis pasos en orden, con
qué comprobar entre cada uno y cuándo parar. **El orden importa y no se puede
alterar**: cambiar un destino antes que su remitente tumba el formulario en
silencio. El trabajo está parado esperando que se publiquen los registros DNS en
Hostinger.

### 7.2 `www.dstunja.com` no tiene certificado

**Comprobado el 02/10/2026.** El certificado cubre solo `dstunja.com`
(`DNS:dstunja.com`), así que quien entre por `www` recibe un aviso de seguridad
del navegador y **no llega al sitio**. Hay una redirección de `www` al apex
configurada, pero es inalcanzable: el TLS falla antes.

**Qué cuesta:** cualquiera que escriba `www.dstunja.com` —y muchos lo escriben—
ve una pantalla de sitio no seguro. Es la peor primera impresión posible y es
indistinguible, para quien la ve, de un sitio comprometido.

**Qué hacer:** añadir `www.dstunja.com` como dominio en el proyecto de Vercel.
Vercel emite el certificado y mantiene la redirección. El DNS ya está bien (CNAME
de `www` al apex), no hay que tocar Hostinger.

### 7.3 `CRON_SECRET` no está configurada

**Comprobado el 02/10/2026:** la variable no aparece en ningún entorno de Vercel.

**Qué cuesta.** `vercel.json` declara un cron diario a las 04:00 sobre
`/api/pqrs/limpieza`. Ese endpoint, sin `CRON_SECRET`, **responde 503 y no borra
nada** (falla cerrado a propósito: abierto, cualquiera podría dispararlo en bucle
y vaciar los pendientes de quien esté radicando en ese momento). Resultado: los
soportes que alguien subió y nunca radicó **se acumulan en el store desde el día
uno**, y son datos personales de gente que no llegó a radicar nada. También deja
inservible `/api/empleos/limpieza`, que usa el mismo cerrojo.

**Qué hacer:** generar una cadena larga y aleatoria y definirla en Vercel
(Production). Vercel manda la cabecera `Authorization: Bearer` sola en sus crons;
no hay que configurar nada más. Después, comprobar en los registros que la
ejecución de las 04:00 devuelve 200 con el conteo de borrados.

### 7.4 Upstash no está aprovisionado

**Comprobado el 02/10/2026:** `UPSTASH_REDIS_REST_URL` y
`UPSTASH_REDIS_REST_TOKEN` no existen en ningún entorno.

**Qué cuesta:** el límite de peticiones por IP funciona con un contador **en la
memoria de cada instancia**. Se reinicia en cada arranque en frío y se multiplica
por instancia: frena un script torpe, **no frena un ataque**. Por eso el tope de
postulaciones está en 20 cada 10 minutos en vez de 5 (ver 6 bis): un contador que
no limita de verdad al menos no debe estorbar a los candidatos reales.

**Qué hacer:** aprovisionar Redis desde el marketplace de Vercel (Upstash tiene
plan gratuito) y conectarlo al proyecto; las dos variables las pone Vercel. El
código las detecta solo (`hayUpstash`) y pasa a contar por IP a secas con el tope
estrecho. No hay que tocar código.

### 7.5 Los registros de Vercel duran una hora

Es el plan Hobby. **No sirven de historial.** Pasada una hora no se puede
responder a «¿llegó la postulación de tal persona el martes?» mirando los
registros.

**El historial que sí existe hoy es el buzón de correo:** cada postulación deja un
correo con asunto `Postulación: …`. Funciona mientras el correo salga; justo en el
caso en que no sale (ver 6 bis) es cuando no hay ni correo ni registro.

**Qué hacer:** o subir de plan, o llevar un registro propio. La segunda opción es
parte de la propuesta de `docs/EMPALME-CONTROL360.md`, y es la que resuelve además
el agujero del fallo silencioso. Añadir un webhook de Resend para recoger el
estado de entrega (`delivered`, `bounced`) está propuesto y aparcado.

### 7.6 No se está midiendo nada (hallazgo de este levantamiento)

**Comprobado el 02/10/2026:** `PUBLIC_GTM_CONTAINER_ID` no está definida en Vercel
en ningún entorno, y el HTML de producción no contiene ninguna referencia a
`googletagmanager` ni a `dataLayer`.

**Qué cuesta:** no hay datos de visitas, ni de conversiones, ni de qué páginas se
ven. El código está puesto y funciona.

**Qué hacer:** definir `PUBLIC_GTM_CONTAINER_ID` en Vercel (Production) con el ID
del contenedor y **redesplegar** —se lee en tiempo de build, no basta con
guardarla—. Para el espejo de GitHub Pages, la misma variable va en Settings →
Secrets and variables → Actions → **Variables** (no como secreto: el ID viaja en
el HTML). Comprobar después con `npm run verificar:analitica`. Detalle en
`docs/ANALITICA.md`. **No añadir `gtag.js` ni `PUBLIC_GA_ID`:** la etiqueta de GA4
vive dentro del contenedor y duplicar la carga haría contar doble cada visita.

### 7.7 El entorno de Preview no puede enviar correo

Ver 5.3. **(Deducción.)** Una postulación enviada desde una vista previa se guarda
en el Blob y nadie la recibe, mostrando «Postulación enviada». Conviene no probar
formularios con datos reales en vistas previas, o configurar en Preview al menos
las claves de prueba de Turnstile que publica Cloudflare.

### 7.8 Las hojas de vida guardadas no se borran nunca (Ley 1581 de 2012)

El código de retención está escrito y probado (`src/lib/empleos/retencion.ts`,
plazo por defecto **6 meses**), pero tiene **dos cerrojos puestos a propósito**:
el cron no está declarado en `vercel.json`, y sin `EMPLEOS_RETENCION_ACTIVA='1'`
solo hace un simulacro. Un borrado irreversible de datos personales no se enciende
solo.

**Qué cuesta:** la carpeta `empleos/` acumula datos personales sin plazo. La Ley
1581 pide una finalidad y un plazo, y «para siempre» no es un plazo. Hoy el daño
es pequeño porque ahí solo caen las postulaciones cuyo correo falló, pero es una
obligación legal, no una mejora opcional.

**Qué hacer:** aprobar el plazo, correr primero el simulacro para ver cuántas
postulaciones se llevaría la primera pasada, y entonces encender los dos cerrojos.
Pasos en `docs/EMPLEOS-POSTULACION.md`, sección «Conservación».

### 7.9 `PQRS_IP_SALT` no está configurada

La IP de quien radica **nunca se guarda en claro**, pero sin sal el hash se puede
deshacer recorriendo el espacio de direcciones IPv4, que es pequeño. El registro
lo marca con `ipHashSalada: false`, así que se sabe de qué registros se trata.
Se arregla definiendo una cadena aleatoria larga en Vercel. **Ojo:** cambiarla
después hace que los hashes nuevos no se puedan comparar con los viejos.

### 7.10 Otros, menores

- **El formulario de Contáctanos sigue abriendo el gestor de correo** con un
  `mailto:`, con el defecto que ya se corrigió en Empleos: en un celular sin app
  de correo configurada, no abre nada y el mensaje se pierde sin que la persona lo
  sepa. Está propuesto y aparcado a propósito: con el dominio verificado, ese
  endpoint nacería pudiendo mandar acuse de recibo.
- **`wrangler.jsonc`** es un resto de una evaluación de Cloudflare que no está en
  uso. Conviene borrarlo para que nadie deduzca que hay un despliegue allí.
- **Las reseñas del inicio son datos de ejemplo** de un archivo local, no las
  reseñas reales de Google. Conectarlas exige un proyecto de Google Cloud **con
  facturación** y la Places API (New).
- **La línea `Sitemap:` de `public/robots.txt` está escrita a mano** y no se entera
  del dominio configurado. Si el dominio cambia, hay que tocar los dos sitios.

---

## 8. Qué accesos hace falta recibir

Para administrar esto de verdad se necesitan seis accesos. Ninguno se puede
deducir del repositorio.

| Servicio | Para qué | Quién es el titular hoy |
| --- | --- | --- |
| **Vercel** (equipo `practicaspasantiasdst-6024`) | Despliegues, variables de entorno, registros, dominios, store de Blob | La cuenta que creó el proyecto |
| **Hostinger** (hPanel) | DNS del dominio. **Imprescindible** para verificar el correo y para cualquier cambio de dominio | — |
| **Resend — cuenta de Empleos** | Clave de API, verificación del dominio, historial de envíos | `ghsantiagodetunja@gmail.com` |
| **Resend — cuenta de PQRS** | Igual. **En vías de desaparecer**, ver 4.1 | `informacioncomercialdst@gmail.com` |
| **Cloudflare** | Configuración del widget de Turnstile y sus dominios autorizados | — |
| **Google Tag Manager / GA4** | Contenedor y propiedad de analítica | — |
| **GitHub** (`dstunja/proyecto_paginaWeb`) | Código, workflow de Pages, variables de Actions | — |

Y los dos buzones de Gmail que reciben hoy las postulaciones y las PQRS, porque
**mientras el remitente sea `onboarding@resend.dev` esos buzones son parte de la
infraestructura**: Resend solo entrega al titular de la cuenta, así que perder el
acceso a uno es perder los envíos de ese formulario.

---

## 9. Comandos de verificación

Todos corren en local, sin desplegar nada. Los de DNS no necesitan ninguna
credencial, así que los puede correr cualquiera.

```
npm run verificar:correo        # ¿están los registros DNS de Resend? (solo DNS)
npm run verificar:navegacion    # ¿funcionan todos los enlaces y la CSP?
npm run verificar:empleos       # el formulario de empleos, de punta a punta
npm run verificar:pqrs          # la radicación de PQRS
npm run verificar:analitica     # el aviso de cookies y el dataLayer (ver el aviso de abajo)
npm run verificar:cobertura     # cobertura de municipios del mapa
npm run check:env               # ¿falta alguna variable de entorno?
npm test                        # pruebas unitarias (vitest)
npm run check                   # tipos de TypeScript
```

**Solo `verificar:navegacion` acepta `-- --url https://dstunja.com`** para correr
contra producción; los demás trabajan sobre el build local de `dist/client/`.

**`verificar:analitica` está desactualizado.** Su guion sigue hablando de
`PUBLIC_GA_ID` y de `gtag.js`, que es como se cargaba la analítica *antes* de
pasar a Tag Manager, y necesita `npm run build` previo y Playwright. Sirve para el
aviso de cookies y el `dataLayer`, pero **no es la forma de comprobar si Tag
Manager está cargando en producción**. Para eso, directo contra el sitio:

```
curl -s https://dstunja.com/ | grep -c googletagmanager
```

Cero significa que no se está cargando nada (es el estado de hoy, ver 7.6).

**Atención con `verificar:pqrs`:** una PQRS de prueba **hay que radicarla desde un
navegador normal**. Turnstile no entrega token a un navegador automatizado, así
que no se puede hacer con un script.

---

## 10. Documentación relacionada

| Archivo | Qué cubre |
| --- | --- |
| `CLAUDE.md` | Reglas de trabajo del repositorio y decisiones de despliegue |
| `README.md` | Puesta en marcha en local y estructura del proyecto |
| `docs/EMPLEOS-POSTULACION.md` | Postulaciones: endpoint, Turnstile, red de seguridad, retención |
| `docs/PQRS-ADJUNTOS.md` | Radicación de PQRS, Blob, adjuntos, registros DNS que pide Resend |
| `docs/PLAN-CORREO-DOMINIO.md` | Los pasos para verificar el dominio y consolidar las cuentas de Resend |
| `docs/ANALITICA.md` | Tag Manager y GA4, paso a paso |
| `docs/EMPALME-CONTROL360.md` | Análisis previo de la integración con Control360 |
| `.env.example` | Todas las variables, documentadas una por una |

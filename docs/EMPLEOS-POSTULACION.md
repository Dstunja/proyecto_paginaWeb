# Postulaciones de Empleos con hoja de vida adjunta

## Qué hace

El formulario de `/empleos/` **envía la postulación desde la página**, sin abrir el
gestor de correo del candidato, y lleva la **hoja de vida adjunta**. Una función de
Vercel (`POST /api/empleos/postular`) recibe el formulario como multipart, lo
valida, comprueba que no es un robot y manda **un** correo por Resend a Talento
Humano con los datos en el cuerpo y el archivo adjunto.

| | Empleos |
| --- | --- |
| Cómo sale | `POST /api/empleos/postular` (multipart/form-data) |
| Destino | `EMPLEOS_DESTINO`; por defecto `contactoEmpleo.email` de `src/data/vacantes.ts` (`ghsantiagodetunja@gmail.com`) |
| Remitente | `EMPLEOS_REMITENTE`; por defecto el de PQRS (`PQRS_REMITENTE`) |
| Asunto | `Postulación: {cargo} – {nombre}` |
| Responder desde la bandeja | Va al candidato (`replyTo`) |
| Hoja de vida | **Obligatoria**, PDF, DOC o DOCX, **máximo 4 MB**, adjunta al correo |
| Dónde se guarda el archivo | **En ningún sitio**: vive en la memoria de la función lo que dura la petición |
| Antispam | Campo trampa (honeypot) + límite por IP (5 cada 10 min) + Turnstile |
| Autorización Ley 1581 | Casilla obligatoria, validada también en el servidor |
| Correos que salen | 1 (a Talento Humano). Al candidato no: la confirmación es la pantalla |
| Número de radicado | No |
| Funciona en GitHub Pages | Cae a `mailto:`, pidiendo adjuntar la hoja de vida a mano |

Todo reutiliza la infraestructura de PQRS: el mismo Resend, el mismo Turnstile, el
mismo limitador por IP (`src/lib/pqrs/limite-tasa.ts`, con Upstash si está
configurado) y las mismas reglas de archivos (`src/lib/adjuntos.ts`). **No hace
falta ninguna cuenta ni variable nueva.**

## Por qué el archivo SÍ pasa por la función (y en PQRS no)

En PQRS los soportes van del navegador a Vercel Blob y la función solo firma el
permiso, porque hay que **conservarlos** y porque una función de Vercel rechaza
cuerpos de más de **4,5 MB**.

Aquí no hay nada que conservar: la hoja de vida se adjunta al correo y se
descarta. Pasarla por el Blob sería subirla para bajarla, adjuntarla y borrarla.
Por eso viaja dentro del multipart, y por eso el tope es **4 MB y no 5**: con
4 MB de archivo más los campos de texto queda margen bajo el límite de 4,5 MB.
Si algún día hiciera falta admitir archivos mayores, el camino es el de PQRS
(subida directa al Blob y borrado después de enviar).

```
navegador                              función                      Resend
    |                                     |                            |
    |-- POST /api/empleos/postular ------>|                            |
    |   multipart: campos + hoja de vida  | campo trampa vacío?        |
    |   + turnstileToken                  | valida campos              |
    |                                     | valida bytes del archivo   |
    |                                     | límite por IP              |
    |                                     | Turnstile                  |
    |                                     |-- correo + adjunto ------->|
    |<-- { ok: true } --------------------|                            |
```

## Endpoint

### `POST /api/empleos/postular`

Cuerpo `multipart/form-data`:

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `nombre` | texto | obligatorio, 3-150 |
| `correo` | texto | obligatorio, formato de correo, hasta 150 |
| `telefono` | texto | obligatorio, 7-15 dígitos (el `57` inicial no cuenta), hasta 30 |
| `cargo` | texto | obligatorio; una de las vacantes de `src/data/vacantes.ts` o `Otro / hoja de vida espontánea` |
| `experiencia` | texto | **opcional**, hasta 3000 |
| `autorizacion` | `si` / `on` / `true` | obligatoria (Ley 1581 de 2012) |
| `hoja-de-vida` | archivo | obligatoria; `.pdf`, `.doc` o `.docx`; hasta 4 MB; el contenido debe corresponder a la extensión |
| `sitio-web` | texto | campo trampa: debe llegar **vacío** |
| `turnstileToken` | texto | token del widget |

La lista de cargos está en `src/lib/empleos/cargos.ts` y la leen **el `<select>` y
el servidor**: un cargo que se cierre desaparece de los dos a la vez, y nadie puede
postularse a uno inventado mandando el multipart a mano.

Orden de las comprobaciones (`src/lib/empleos/postular.ts`): forma del cuerpo →
campo trampa → campos y bytes del archivo → límite por IP → Turnstile → correo.
Lo barato y local va primero; un `400` llega **sin gastar un token de Turnstile**,
que es de un solo uso.

Respuestas:

- `200` → `{ ok: true }`. También cuando el campo trampa venía relleno: al robot no
  se le dice qué lo delató y no se manda nada.
- `400` → `{ ok: false, errores: [...] }`. Devuelve **todos** los errores, no solo
  el primero: campos mal, archivo rechazado, cuerpo que no es multipart.
- `403` → Turnstile no pasó (o no hay `TURNSTILE_SECRET`: falla cerrado).
- `429` → más de 5 postulaciones en 10 minutos desde la misma IP.
- `500` → el correo no salió. El navegador cae entonces al `mailto:`.

Ese `500` es deliberado, y no un `200` con un aviso: aquí no queda registro en
ningún sitio, así que si el correo no sale no queda **nada**. Con el `500` la
persona acaba mandando su hoja de vida por su gestor de correo; con un `200` se
iría convencida de que nos llegó. El motivo técnico (una clave mal puesta, el
dominio del remitente sin verificar en Resend) se queda en el registro de Vercel
y nunca viaja en la respuesta.

## El correo que llega a Talento Humano

- Asunto `Postulación: {cargo} – {nombre}`, para filtrar y encaminar sin abrirlo.
- `replyTo` al correo del candidato: **responder** desde la bandeja le escribe a él.
- En el cuerpo, el **teléfono es un enlace `tel:`** (en formato E.164, con el `+57`
  puesto si no venía) y el **correo un `mailto:`**, para contestar desde el celular
  con un toque.
- El texto de experiencia, si lo escribió; si no, se dice que está todo en la hoja
  de vida.
- La hoja de vida **adjunta**, con el nombre saneado (`hoja_de_vida.pdf`) y el MIME
  deducido del contenido, no del que declaró el navegador.
- Versión HTML y versión en texto plano.

No hay correo de confirmación al candidato: sin radicado ni plazo legal, un
segundo correo solo llenaría su bandeja. La confirmación es la pantalla.

## La hoja de vida se revisa dos veces

`src/lib/empleos/hoja-de-vida.ts` no toca el DOM ni el entorno, y lo importan el
navegador y el servidor sin cambiar una línea. Restringe la lista de extensiones
a `.pdf`, `.doc` y `.docx` y delega en `validarArchivo` de `src/lib/adjuntos.ts`:
peso, doble extensión (`hoja.exe.pdf`), saneado del nombre y **bytes mágicos**
(`%PDF`, contenedor OLE2 para `.doc`, ZIP con carpeta `word/` para `.docx`).

- En el navegador (`src/components/FormularioEmpleo.astro`), al elegir el archivo:
  el rechazado se saca del input, se explica por qué, y el motivo queda como
  validez personalizada del campo para que `reportValidity()` frene el envío con
  ese mensaje. El aceptado se enseña con su nombre y su peso. El texto de ayuda
  dice el tope **antes** de elegir: «PDF, DOC o DOCX, máximo 4 MB.».
- En el servidor, sobre los bytes recibidos. La validación del navegador se
  salta con las DevTools abiertas; la que vale es esta.

## Seguridad

- **Campo trampa.** Un `<input name="sitio-web">` fuera de la pantalla, fuera del
  orden de tabulación y oculto a los lectores de pantalla. Una persona no lo ve;
  un robot que rellena todo lo llena. Si llega con algo: `200` y nada más.
- **Límite por IP**, el mismo de PQRS (`limitar`, prefijo `empleos:postular`).
  Con Upstash es compartido entre instancias; sin él es un contador en memoria
  que frena un script torpe, no un ataque (ver `docs/PQRS-ADJUNTOS.md`).
- **Turnstile**, el mismo widget en modo `interaction-only`. Sin
  `TURNSTILE_SECRET` el servidor rechaza: no se deja pasar por defecto.
- **El archivo no se guarda.** Ni en Blob, ni en disco, ni en registro. Solo va
  en el correo.
- **Lo escrito se escapa** antes de meterlo en el HTML del correo, y el nombre
  del archivo viaja saneado (`sanitizarNombre`).
- **La IP no se guarda**: solo se usa para el límite de tasa y para Turnstile.

## GitHub Pages: el respaldo por correo

La función **solo existe en Vercel**. En el espejo estático de GitHub Pages la
ruta devuelve el HTML del 404, el navegador lo detecta (la respuesta no es JSON)
y cae al `mailto:` con los datos en el cuerpo, exactamente como hace PQRS. Como
un `mailto:` no puede llevar archivos, el aviso en pantalla y el cuerpo del
correo piden **adjuntar la hoja de vida a mano**. Lo mismo ocurre si Vercel
devuelve un 5xx o la red falla.

Un `400`, `403` o `429` **no** activan el respaldo: ahí el servidor sí contestó y
lo que toca es enseñar el motivo. En el DOM el respaldo queda marcado con
`data-respaldo="correo"`. El botón «Prefiero WhatsApp» está siempre, como
alternativa.

## Variables de entorno

Se reutilizan las de PQRS: `RESEND_API_KEY`, `TURNSTILE_SECRET`,
`PUBLIC_TURNSTILE_SITE_KEY` y, si están, `UPSTASH_REDIS_REST_URL` y
`UPSTASH_REDIS_REST_TOKEN`. Las dos propias son **opcionales**:

| Variable | Obligatoria | Qué es |
| --- | --- | --- |
| `EMPLEOS_DESTINO` | no | Buzón de Talento Humano. Sin ella, `contactoEmpleo.email` de `src/data/vacantes.ts`, que es la dirección que ya se publica en la página |
| `EMPLEOS_REMITENTE` | no | Remitente. Sin ella, el de PQRS, que es el dominio verificado en Resend. Para que diga «Empleos …», una dirección del **mismo** dominio |

Si los correos de PQRS salen hoy en producción, estos también: usan la misma
clave y el mismo remitente. Si no hay `EMPLEOS_REMITENTE`, no hay nada que
verificar de más en Resend.

## Dónde vive cada cosa

```
src/lib/empleos/cargos.ts          lista de cargos admitidos (vacantes + espontánea)
src/lib/empleos/hoja-de-vida.ts    formatos, tope de 4 MB y validación (navegador y servidor)
src/lib/empleos/config.ts          destino, remitente, límite por IP y nombre del campo trampa
src/lib/empleos/postulacion.ts     validación del multipart, con todos los errores a la vez
src/lib/empleos/correo.ts          el correo a Talento Humano, con tel:, mailto: y adjunto
src/lib/empleos/postular.ts        la orquestación, con pruebas en postular.test.ts
src/pages/api/empleos/postular.ts  la función de Vercel (solo el envoltorio HTTP)
src/components/FormularioEmpleo.astro  el formulario, la revisión del archivo y el respaldo
scripts/verificar-empleos.mjs      la prueba de navegador
```

## Comandos

```bash
npm run check              # tipos
npm test                   # Vitest: incluye src/lib/empleos/postular.test.ts
npm run build
npm run verificar:empleos  # Playwright sobre dist/, con la API interceptada
```

Para probar **el envío real** hace falta el entorno de Vercel, que es quien
resuelve las funciones:

```bash
npx vercel dev                                             # con las variables puestas
node scripts/verificar-empleos.mjs --api http://localhost:3000
```

Eso manda un multipart de verdad con un PDF de prueba a
`/api/empleos/postular`. Con las claves de **prueba** de Turnstile (`1x…`)
cualquier token pasa. Ojo: si `RESEND_API_KEY` es real, **el correo llega de
verdad** a Talento Humano; el nombre del candidato de prueba lo dice para que no
lo confundan con una postulación.

## Pruebas

`npm test` (`src/lib/empleos/postular.test.ts`, con Resend simulado y bytes de
archivo de verdad) comprueba: que sale un correo al buzón por defecto con el
asunto, el `replyTo` y el adjunto correctos (nombre saneado, MIME real, los
mismos bytes); que el teléfono va como `tel:` y el correo como `mailto:`; que lo
escrito llega escapado; que `EMPLEOS_DESTINO` y `EMPLEOS_REMITENTE` mandan si
están y que sin ellas se hereda el remitente de PQRS; que se aceptan `.pdf`,
`.doc` y `.docx` mirando los bytes y no el MIME declarado; que se rechazan el
archivo ausente o vacío, un `.txt`, una imagen o texto plano disfrazados de PDF,
un ZIP renombrado a `.docx`, la doble extensión y más de 4 MB; que los campos
devuelven **todos** los errores a la vez sin gastar token; que el campo trampa
relleno da `200` sin correo ni red; el límite por IP; que Turnstile falla
cerrado; y que un fallo de Resend da `500` sin filtrar el motivo.

`npm run verificar:empleos` (Playwright, en móvil y escritorio) cubre lo que se
ve: el campo con su `accept`, su ayuda y su obligatoriedad; que cada formato
válido se acepta y se enseña con nombre y peso; que los rechazados salen del
input con un mensaje claro y dejan el campo inválido; el campo trampa presente
pero invisible; la casilla obligatoria; que sin casilla o sin archivo no sale
ninguna petición; que el envío es **un** POST multipart con todos los campos, el
campo trampa vacío, el token y el archivo con sus bytes; el botón deshabilitado
con «Enviando…»; la confirmación; que un 400 o un 403 se muestran sin caer al
correo; que un 500, el HTML del espejo o la red caída sí abren el gestor de
correo con el aviso de adjuntar la hoja de vida y el botón de WhatsApp a la
vista; y el cargo preseleccionado desde `?cargo=` y desde «Postularme».

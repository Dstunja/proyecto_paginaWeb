# Radicación de PQRS y archivos de soporte

## Qué hace hoy

La página **empieza preguntando la categoría**, y ese primer clic decide todo lo
demás. No hay botón de «continuar» ni recarga.

- **Administrativa** — no es un trámite en línea. Desaparecen el paso 2 y el
  formulario de PQRS, y sale un bloque con el teléfono, el WhatsApp y el correo
  de la empresa, más un formulario corto y opcional para dejar los datos.
- **Comercial** — pide el **tipo** (Petición, Queja, Reclamo, Sugerencia o
  Felicitación) y radica de verdad.

Las dos categorías están descritas en `src/lib/pqrs/categorias.ts`; lo que enseña
y esconde cada tarjeta se declara en `src/pages/pqrs.astro`.

| | Administrativa | Comercial |
| --- | --- | --- |
| Qué enseña al elegirla | Bloque de contacto (`ContactoAdministrativo.astro`) | Paso 2 y formulario de radicación |
| Cómo sale | `POST /api/pqrs/administrativa` (formulario corto, opcional) | `POST /api/pqrs` |
| Destino | `PQRS_DESTINO`, por defecto `informacioncomercialdst@gmail.com` | Ídem |
| Remitente | `PQRS_REMITENTE`, por defecto `onboarding@resend.dev` | Ídem |
| Clave de Resend | `PQRS_RESEND_API_KEY`, o `RESEND_API_KEY` si no está | Ídem |
| Archivos de soporte | **No** | Sí, en los cinco tipos (opcional), en el Blob store **privado** `pqrs-adjuntos` |
| Antirrobots (Turnstile) | Sí | Sí |
| Límite de tasa por IP | 5 cada 10 min | 5 cada 10 min |
| Número de radicado | **No** | Sí |
| Asunto del correo | `Solicitud administrativa · {nombre}` | `[{radicado}] PQRS Comercial · {tipo} · {municipio}` |
| Correos que salen | 1 (al área) | 1 al área; la constancia a quien radica solo con un remitente de dominio verificado |
| Si falta Blob o Resend | Avisa y cae a `mailto:` (503) | Avisa y cae a `mailto:` sin radicar (503) |
| Funciona en GitHub Pages | Cae a `mailto:` | No (no hay funciones) |

### Resend sin dominio verificado

PQRS envía con **su propia cuenta de Resend**, registrada con
`informacioncomercialdst@gmail.com`, y remitente `onboarding@resend.dev`. Con ese
remitente Resend **solo entrega al titular de la cuenta**, y eso tiene tres
consecuencias:

- **`PQRS_DESTINO` tiene que ser el titular de la cuenta** de la clave que se use.
  Por eso su valor por defecto es `informacioncomercialdst@gmail.com`.
- **La constancia a quien radica no se envía.** Fallaría siempre, así que ni se
  intenta. La pantalla de confirmación no dice «también te lo enviamos por
  correo» y le pide a la persona que copie o anote el número.
- **Empleos va por otra cuenta** (`RESEND_API_KEY`), registrada con otro correo.
  Si PQRS usara esa clave, sus correos se rechazarían; por eso existe
  `PQRS_RESEND_API_KEY`, y PQRS solo cae a `RESEND_API_KEY` si no la tiene.

Cuando haya un dominio verificado en la cuenta de PQRS basta con poner en
`PQRS_REMITENTE` una dirección de ese dominio: la constancia vuelve a salir sola y
`PQRS_DESTINO` puede ser cualquier buzón.

### Por qué la administrativa dejó de radicar

Facturación, certificados, documentos y trámites los resuelve una persona
consultando sistemas a los que el sitio no llega. Darles número de radicado y
plazo de 15 días hábiles era prometer un trámite legal donde lo que hace falta
es una llamada. Por eso hoy esa categoría enseña los datos de contacto primero
—teléfono con `tel:` y botón de WhatsApp con el mensaje ya escrito, correo con
`mailto:` y el asunto puesto, y botón de copiar en cada uno— y el formulario
corto queda debajo como comodidad, no como requisito.

Ese formulario **no radica**: manda un correo y responde `{ ok: true }`. Ni la
pantalla ni el correo mencionan ningún número de seguimiento, a propósito.

Antes esa categoría compartía el formulario de PQRS y salía por un `mailto:` que
armaba el navegador, con su propia variable `PUBLIC_PQRS_ADMIN_DESTINO`. Las dos
cosas desaparecieron: el envío es del servidor y el buzón es el mismo de la
comercial. **Si `PUBLIC_PQRS_ADMIN_DESTINO` sigue definida en Vercel, hay que
borrarla**; ya no la lee nadie.

### El único `mailto:` que queda es el respaldo

Los dos caminos caen a un `mailto:` cuando la función no contesta —red caída, o
el sitio servido desde el espejo estático de GitHub Pages, que no tiene backend—.
No es lo mismo que un error del servidor: un 400 o un 403 **no** activan el
respaldo, porque ahí la API sí contestó y lo que toca es enseñar el motivo. En el
DOM el respaldo queda marcado con `data-respaldo="correo"`, y en la comercial va
además con un aviso explícito de que así la solicitud **no** quedó radicada.

La categoría **comercial** es la que **radica de verdad**: guarda la solicitud,
guarda los archivos de soporte, devuelve un número de radicado y manda dos
correos. Ya no depende del gestor de correo de quien lo diligencia.

| Parte | Estado |
| --- | --- |
| Categoría previa (administrativa / comercial) | Hecho |
| Bloque de contacto administrativo, sin paso 2 ni formulario de PQRS | Hecho |
| Formulario corto administrativo por Resend, con Turnstile | Hecho |
| Elección por tarjetas, sin `<select>` ni botón de continuar | Hecho |
| Municipio cerrado a los 87 de cobertura, validado también en el servidor | Hecho |
| Campo de soporte en los cinco tipos de la comercial, siempre opcional | Hecho |
| Hasta 3 archivos, 5 MB cada uno | Hecho |
| Validación por contenido real (bytes mágicos), en cliente **y** servidor | Hecho |
| Subida de los archivos a Vercel Blob **privado** (`access: 'private'` fijo) | Hecho |
| Número de radicado, fecha y registro guardado | Hecho |
| Correo al área de PQRS con enlaces de descarga (`/api/pqrs/descarga`) | Hecho |
| Correo de confirmación a quien radica | Solo con remitente de dominio verificado |
| Aviso claro si falta el Blob o la clave de Resend | Hecho (503 `config-incompleta`) |
| Antirrobots (Turnstile) en los dos endpoints | Hecho |
| Limpieza automática de subidas abandonadas | Hecho (cron diario) |
| Tabla `pqrs_adjuntos` en base de datos | **No**: ver «Lo que sigue pendiente» |
| Panel de administración | **No** |

El sitio sigue siendo estático (`output: 'static'`). Lo único que corre como
función de Vercel son las rutas de `src/pages/api/pqrs/` (y la de Empleos),
marcadas una a una con `export const prerender = false`.

## Por qué los archivos no pasan por la función

Una función de Vercel **rechaza cuerpos de más de 4,5 MB**, y el tope por
archivo es 5 MB: un PDF grande nunca llegaría. Por eso el archivo va del
navegador **directamente** a Vercel Blob, y la función solo firma el permiso.

```
navegador                    función                     Vercel Blob
    |                           |                              |
    |-- POST /api/pqrs/token -->|                              |
    |   (sessionId, tipo,       | Turnstile + tipo + ruta      |
    |    turnstileToken)        | -> firma un token acotado    |
    |<-- clientToken -----------|                              |
    |                                                          |
    |-- PUT el archivo (hasta 5 MB) --------------------------->|
    |                                                          |
    |-- POST /api/pqrs -------->|                              |
    |   (campos + rutas de los  |-- descarga cada blob ------->|
    |    blobs ya subidos)      |<-- bytes --------------------|
    |                           | valida bytes mágicos         |
    |                           |-- copy + del (mover) ------->|
    |                           |-- guarda solicitud.json ---->|
    |                           | correo al área con enlaces   |
    |<-- { radicado, fecha } ---|                              |

área de PQRS (correo)        función                     Vercel Blob
    |                           |                              |
    |-- GET /api/pqrs/descarga ->| firma + caducidad + ruta     |
    |                           |-- URL firmada de 5 min ----->|
    |<-- 302 a esa URL ---------|                              |
    |-- GET el archivo privado --------------------------------->|
```

El cuerpo de `POST /api/pqrs` es **JSON**, no multipart: solo lleva texto y las
rutas de los blobs. Nunca se acerca al límite de 4,5 MB.

## Endpoints

### `POST /api/pqrs/token`

Firma el permiso de subida (`handleUpload` de `@vercel/blob/client`). En
`onBeforeGenerateToken` exige, en este orden:

1. `clientPayload` con `sessionId` (UUID v4), `tipo` y `turnstileToken`.
2. Turnstile válido.
3. Que el tipo normalizado sea **uno de los cinco** del formulario
   (`TIPOS_PQRS`). No es para decidir si lleva soporte —lo llevan todos—, sino
   para que nadie pida tokens de subida con un tipo inventado y use el store
   como alojamiento gratuito. Si no lo es: `422 tipo-invalido`.
4. Que la ruta pedida cuelgue de `pqrs/pendientes/{sessionId}/`.

Y devuelve un token con `allowedContentTypes` (los cinco MIME permitidos),
`maximumSizeInBytes` (de `PQRS_ADJUNTO_MAX_MB`), `addRandomSuffix: false`,
`allowOverwrite: false` y `validUntil` a 30 minutos.

**Ese `allowedContentTypes` filtra pero no demuestra nada**: Vercel Blob lo
compara con el `Content-Type` que declara el navegador, y ese lo pone quien
sube. La comprobación seria es la de `/api/pqrs`.

### `POST /api/pqrs`

Cuerpo JSON:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `tipo` | texto | `Petición`, `Queja`, `Reclamo`, `Sugerencia`, `Felicitación` |
| `nombre` | texto | obligatorio, 3-150 |
| `documento` | texto | opcional |
| `telefono` | texto | obligatorio, 7-15 dígitos |
| `correo` | texto | obligatorio |
| `municipio` | texto | obligatorio |
| `descripcion` | texto | obligatorio, 10-5000 |
| `autorizacion` | booleano | obligatorio `true` (Ley 1581 de 2012) |
| `sessionId` | UUID v4 | el de las subidas |
| `turnstileToken` | texto | token nuevo, distinto del de las subidas |
| `adjuntos` | lista 0..3 | `{ url, pathname, nombreOriginal, tamano }`. Opcional en los cinco tipos |

Respuestas:

- `201` → `{ ok: true, radicado, fecha, correoArea, constancia }`. La radicación
  **es válida** aunque algún correo no saliera:
  - `correoArea` (`true`/`false`): si el correo al área salió. Con `false` la
    pantalla confirma el radicado y sugiere escribir por WhatsApp citándolo.
  - `constancia`: `enviada`, `omitida` (remitente `@resend.dev`, no se intenta) o
    `fallida` (Resend la rechazó). Si no es `enviada`, la pantalla no promete el
    correo y pide copiar el número.
- `400` → `{ ok: false, errores: [...] }`. Campos mal, archivo rechazado, más de
  tres archivos, blob de otra sesión.
- `403` → Turnstile no pasó.
- `429` → más de 5 radicaciones en 10 minutos desde la misma IP.
- `503` → `{ ok: false, codigo: 'config-incompleta', errores: [...] }`. Falta
  `BLOB_READ_WRITE_TOKEN` o la clave de Resend. Se comprueba **antes de todo**:
  no se valida, no se gasta Turnstile y **no se radica nada**. El formulario
  avisa «La radicación en línea no está disponible en este momento» y abre el
  correo. En el registro de Vercel queda qué variable falta.
- `500` → no se pudo guardar el registro. Aquí **no hay radicación**.

Los mensajes de `errores` están redactados en español y se muestran tal cual.
Hasta ahora la radicación correcta devolvía además una lista `avisos` con los
motivos técnicos de los correos fallidos, y el formulario la pintaba: la persona
podía leer «Falta RESEND_API_KEY.» o el inglés de Resend. Ya no existe; el detalle
se queda en el registro de Vercel.

### `POST /api/pqrs/administrativa`

El recado del bloque administrativo. **No radica nada**: ni guarda en el Blob, ni
genera número, ni admite adjuntos. Solo manda un correo al área para que
devuelva el contacto. El trabajo está en `src/lib/pqrs/administrativa.ts`, con
pruebas en `administrativa.test.ts`.

Cuerpo JSON:

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `nombre` | texto | obligatorio, 3-150 |
| `telefono` | texto | obligatorio, 7-15 dígitos (el `57` inicial no cuenta) |
| `correo` | texto | **opcional**; si viene, tiene que ser un correo válido |
| `mensaje` | texto | obligatorio, 10-1500 |
| `turnstileToken` | texto | token del widget |

El correo es opcional a propósito: a mucha gente de tienda es más fácil
devolverle la llamada que escribirle. Cuando no viene, el mensaje al área lo dice
(«Correo: (no lo dejó)») y **no se pone `replyTo`**, porque dejarlo vacío haría
que responder desde la bandeja fuera a parar al remitente del propio sitio.

Respuestas:

- `200` → `{ ok: true }`. Sin radicado, porque no lo hay.
- `400` → `{ ok: false, errores: [...] }`. Devuelve **todos** los errores, no
  solo el primero.
- `403` → Turnstile no pasó.
- `429` → más de 5 envíos en 10 minutos desde la misma IP.
- `503` → `{ ok: false, codigo: 'config-incompleta', errores: [...] }`. No hay
  ninguna clave de Resend. Se comprueba antes de todo; el formulario avisa de que
  el envío desde la página no está disponible y abre el correo.
- `500` → el correo no salió. El navegador cae entonces al `mailto:`.

Ese `500` es deliberado, y no un `200` con un aviso: aquí **no hay registro en el
Blob** que dé fe de que la solicitud existió, así que si el correo no sale no
queda nada. Con el `500` la persona acaba escribiendo por su gestor de correo; con
un `200` se iría convencida de que nos llegó. El motivo técnico (una clave mal
puesta, el dominio del remitente sin verificar en Resend) se queda en el registro
de Vercel y nunca viaja en la respuesta.

### `GET /api/pqrs/descarga`

Abre un soporte desde el correo al área. El store es **privado**: la URL de un
blob a secas no abre nada, así que el correo no puede llevarla. Lleva un enlace a
esta función:

```
https://<sitio>/api/pqrs/descarga?ruta=pqrs/PQRS-…/<uuid>.pdf&vence=<ms>&firma=<hex>
```

- **Firma** HMAC-SHA256 de `ruta` y `vence`, con una clave derivada de
  `BLOB_READ_WRITE_TOKEN`. No hace falta ninguna variable nueva y nadie sin el
  token del store puede fabricar un enlace. Si el token se rota, los enlaces ya
  enviados dejan de valer.
- **Caduca a los 7 días** (`MINUTOS_ENLACE_DESCARGA`).
- **Solo soportes radicados**: `pqrs/{radicado}/{uuid}.{pdf|doc|docx|jpg|jpeg|png}`.
  Ni `solicitud.json`, ni los pendientes, ni rutas con `../`. La forma se
  comprueba antes que la firma.
- Si todo cuadra, responde **302** a una URL firmada de Vercel Blob
  (`issueSignedToken` + `presignUrl`, `access: 'private'`) que dura **5 minutos**.
  El archivo no pasa por la función, así que su peso no choca con el límite de
  respuesta de Vercel, y la vida del enlace del correo no depende del máximo que
  Vercel admita para una URL firmada.

Respuestas, todas en una página corta en español: `400` enlace mal copiado o ruta
no permitida, `403` firma no válida, `410` caducado, `404` el archivo ya no está,
`503` falta `BLOB_READ_WRITE_TOKEN`, `502` no se pudo firmar la URL de Blob.

### `GET /api/pqrs/limpieza`

Cron diario. Borra lo que lleve más de 24 horas en `pqrs/pendientes/`: archivos
que alguien eligió y nunca radicó. Exige
`Authorization: Bearer $CRON_SECRET`; sin `CRON_SECRET` responde `503` en vez de
quedar abierto.

## Dónde vive cada cosa

```
pqrs/pendientes/{sessionId}/{uuid}.{ext}   subida en curso, se borra a las 24 h
pqrs/{radicado}/{uuid}.{ext}               soporte ya radicado
pqrs/{radicado}/solicitud.json             el registro
```

`solicitud.json` es el equivalente a las filas que habrían ido a base de datos:

```json
{
  "radicado": "PQRS-20260907-A7K2M9",
  "fecha": "2026-09-07T14:15:33.000Z",
  "tipo": "Queja",
  "nombre": "…",
  "documento": "…",
  "telefono": "…",
  "correo": "…",
  "municipio": "Tunja",
  "descripcion": "…",
  "autorizacion": true,
  "ipHash": "9f2c…",
  "ipHashSalada": true,
  "adjuntos": [
    {
      "nombreOriginal": "factura_marzo.pdf",
      "nombreAlmacenado": "3f8b…-….pdf",
      "ruta": "pqrs/PQRS-20260907-A7K2M9/3f8b….pdf",
      "mimeType": "application/pdf",
      "tamano": 184320
    }
  ]
}
```

La IP nunca se guarda en claro: va como SHA-256 con la sal de `PQRS_IP_SALT`.
`ipHashSalada: false` avisa de que esa variable no estaba puesta.

El **radicado** es `PQRS-YYYYMMDD-XXXXXX`. La fecha va en hora de Colombia, no
en UTC: Vercel ejecuta en UTC y una PQRS radicada a las 19:30 de Tunja llevaría
la fecha del día siguiente. El sufijo usa un alfabeto sin `0`/`O` ni `1`/`I`,
porque el radicado se dicta por teléfono.

## El municipio no es texto libre

El campo es un combobox cerrado a los **87 municipios donde distribuye la
empresa**, no un `<input type="text">`. La lista sale de `src/data/municipios.ts`,
que ya cruza el conteo real de clientes con las coordenadas geocodificadas: no
hay una segunda lista que mantener, y si mañana se amplía la cobertura el campo
se entera solo.

Se valida **dos veces**, y no por desconfianza sino porque son dos cosas
distintas:

- En el navegador (`src/components/CampoMunicipio.astro`) con
  `setCustomValidity`, para que quien se equivoque lo sepa antes de enviar y sea
  el propio `reportValidity()` del formulario el que frene.
- En el servidor (`src/lib/pqrs/solicitud.ts`), porque la comprobación de
  cliente se salta con las DevTools abiertas. Un municipio que no esté en la
  lista devuelve **400** con «Selecciona un municipio de la lista.».

El servidor además **guarda el nombre oficial**, no lo que llegó: quien mande
`chiquinquira` acaba en `solicitud.json` como `Chiquinquirá`. Sin eso, el mismo
municipio aparecería con tres grafías y ningún recuento cuadraría.

La comparación ignora tildes y mayúsculas en los dos lados, con la misma función
(`normalizarMunicipio` de `src/lib/municipios-busqueda.ts`) que usan el mapa de
la red y el buscador de cobertura. Una sola implementación es lo que evita que
un buscador encuentre «Villa de Leyva» y el otro no.

### La ubicación es una comodidad, nunca un requisito

Al aparecer el formulario —después de elegir categoría y tipo, no al entrar en
la página— se pide la ubicación del navegador y se preselecciona el municipio
más cercano por distancia haversine a la cabecera municipal. Se pide en ese
momento, y no antes, para que el aviso del navegador llegue después de un acto
de la persona y se entienda para qué es.

Si la niegan, falla o tarda más de 8 segundos, **no pasa nada y no se dice
nada**: el campo se queda vacío y se elige a mano. El formulario no espera a la
ubicación en ningún momento. Y si para cuando llega la respuesta la persona ya
eligió, manda su elección y no el GPS.

El municipio elegido se guarda en `sessionStorage`, así que sobrevive a cambiar
de categoría o de tipo y también a recargar la página.

## Quién decide si hay campo de soporte

**La categoría, y solo la categoría.** Dentro de la comercial lo llevan los
cinco tipos —Petición, Queja, Reclamo, Sugerencia y Felicitación— y siempre es
**opcional**. La administrativa no lo lleva nunca, porque ni siquiera enseña el
formulario de radicación.

Hubo una segunda condición: el tipo tenía que estar en una lista
`TIPOS_CON_SOPORTE` que eran Queja y Reclamo. Se eliminó porque dejaba fuera
casos reales —una Petición en la que hay que adjuntar el documento que se
solicita, una Felicitación con la foto de lo que salió bien— y con ella se
fueron la lista y su `requiereSoporte()` de `src/lib/adjuntos.ts`. La regla que
queda es `admiteSoporte()` en `src/lib/pqrs/categorias.ts`.

Eso tuvo tres consecuencias que conviene conocer:

- **`/api/pqrs/token` sigue mirando el tipo**, pero para otra cosa. Antes
  rechazaba lo que no fuera Queja o Reclamo; ahora comprueba que sea uno de los
  cinco del formulario (`esTipoValido`, contra `TIPOS_PQRS`). El papel que de
  verdad cumple es impedir que alguien pida tokens de subida con un tipo
  inventado y use el Blob store como alojamiento gratuito, y ese sigue en pie.
- **El código de error `tipo-sin-soporte` pasó a llamarse `tipo-invalido`**
  (sigue en 422), con el mensaje «El tipo de solicitud no es válido. Recarga la
  página e inténtalo de nuevo.». El nombre viejo habría quedado mintiendo en los
  registros de Vercel: ningún tipo se queda ya sin soporte.
- **`/api/pqrs` dejó de descartar adjuntos.** Tenía un atajo por el que los
  tipos sin soporte salían sin revisar nada y sus archivos se borraban; ya no
  existe, y con él se fue el campo `admiteSoporte` de `SolicitudValidada`.

`TIPOS_PQRS` vive en `src/lib/pqrs/categorias.ts` y no en `solicitud.ts`, que
sería el otro sitio natural: ese módulo arrastra los 87 municipios y construye
su índice al cargarse, así que `/api/pqrs/token` pagaría ese arranque en frío
sin necesitarlo. `solicitud.ts` lo reexporta como `TIPOS_VALIDOS`.

## Las reglas viven en un solo sitio

`src/lib/adjuntos.ts` no toca el DOM, no usa `import.meta.env` y lee los bytes a
través de una función que le inyecta quien lo llama. Lo usan **el navegador y el
servidor sin cambiar una línea**, así que formatos, peso, doble extensión y
saneado del nombre no se pueden desincronizar.

La validación de cliente no cuenta como validación: se salta con las DevTools
abiertas. En `/api/pqrs` se descarga cada blob y se vuelve a validar sobre los
bytes que hay guardados, que es lo único que no miente.

Detección por contenido: `%PDF` (PDF), `FF D8 FF` (JPEG), firma de 8 bytes
(PNG), contenedor OLE2 (`.doc`) y ZIP **que contenga la carpeta `word/`**
(`.docx`, mirando cabeceras locales y directorio central, para que un `.zip`
renombrado no cuele).

## Seguridad

- **Turnstile en los dos endpoints.** El token es de un solo uso, así que el
  navegador pide uno nuevo por cada archivo y otro para radicar. Si no hay
  `TURNSTILE_SECRET`, el servidor **rechaza**: no se deja pasar por defecto.
- **La espera del token no vence mientras se marca la casilla.** Si Cloudflare
  pide interacción, `src/lib/turnstile-cliente.ts` cambia el tope de 30 s por uno
  de 5 minutos. Antes ese tope cortaba la espera con la casilla en pantalla y el
  formulario caía al correo sin llamar a la API; pasó en producción con Empleos
  (ver docs/EMPLEOS-POSTULACION.md).
- **Blobs privados, sin opción pública.** Store `pqrs-adjuntos`, privado, y
  `access: 'private'` fijo en servidor (`ACCESO_BLOB` en `src/lib/pqrs/config.ts`)
  y navegador (`FormularioPqrs.astro`). La variable `PUBLIC_PQRS_BLOB_ACCESS`,
  que permitía `public`, se eliminó: un store privado rechaza las subidas
  públicas. **Si sigue definida en Vercel, hay que borrarla.** La URL de un blob
  sola no abre nada; el correo al área lleva enlaces a `/api/pqrs/descarga`,
  firmados y con caducidad de 7 días, que redirigen a una URL firmada de Blob de
  5 minutos.
- **Los archivos no se adjuntan al correo**, se enlazan: un correo se reenvía y
  el soporte de una queja no debe esparcirse sin control.
- **Ruta impuesta por el servidor.** El `pathname` que manda el navegador solo
  se comprueba; `sessionId` se valida contra la forma de un UUID v4 antes de
  usarse, para que un `../` no escriba fuera del prefijo.
- **Un blob de otra sesión se rechaza**: el `pathname` tiene que empezar por
  `pqrs/pendientes/{sessionId}/` de quien radica.
- **Nombre nuevo al guardar**: UUID más la extensión que confirmó la validación
  de bytes. El original va solo a `nombreOriginal`, saneado.
- **Si algo falla se borra todo lo de la sesión**, para no dejar archivos
  huérfanos con datos personales.
- **Nada se sirve como HTML.** Los blobs privados se descargan por enlace
  firmado; no hay ninguna ruta del sitio que lea un archivo por parámetro.
- **CORS**: el sitio y la API están en el mismo dominio, así que no aplica. Si
  algún día se sirviera el formulario desde otro origen habría que añadir la
  cabecera y restringirla a ese origen, no a `*`.

### Límite de tasa: leer esto

`src/lib/pqrs/limite-tasa.ts` usa **Upstash Redis** si están
`UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, y si no cae a un contador
**en la memoria del proceso**.

El contador en memoria es un apaño y hay que saberlo: Vercel arranca una
instancia nueva en cada arranque en frío y varias en paralelo bajo carga, así
que el contador se reinicia y se multiplica. **Frena un script torpe, no un
ataque.** Para darlo por resuelto hay que aprovisionar Upstash desde el
marketplace de Vercel (tiene plan gratuito) y definir esas dos variables.

## Lo que sigue pendiente

**No hay base de datos.** Vercel Blob es almacenamiento de objetos: guarda
archivos, no filas, y no se puede consultar. El registro de cada radicación es
su `solicitud.json`. Eso basta para dar fe de la fecha y del soporte recibido,
que es lo que exige la ley, pero tiene tres límites:

1. No hay consultas. Listar radicaciones es recorrer el prefijo `pqrs/` con
   `list()`, y filtrar por tipo o por municipio obliga a abrir cada JSON.
2. No hay atomicidad. Si la función muere después de mover los archivos y antes
   de guardar el JSON, quedan archivos sin registro. El endpoint devuelve `500`
   en ese caso para que la persona reintente, pero la limpieza es manual.
3. No hay estado de la solicitud (asignada, respondida, cerrada) ni plazos.

Cuando llegue el panel de administración, el diseño de tablas ya está pensado.
Es el mismo de antes, con `ruta` apuntando al pathname del blob:

```sql
-- migraciones/001_pqrs.sql (NO aplicado: todavía no hay base de datos)
CREATE TABLE pqrs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  radicado      VARCHAR(30)  NOT NULL,
  tipo          VARCHAR(20)  NOT NULL,
  nombre        VARCHAR(150) NOT NULL,
  documento     VARCHAR(30)      NULL,
  telefono      VARCHAR(30)  NOT NULL,
  correo        VARCHAR(150) NOT NULL,
  municipio     VARCHAR(100) NOT NULL,
  descripcion   TEXT         NOT NULL,
  autorizacion  TINYINT(1)   NOT NULL DEFAULT 0,
  ip_hash       CHAR(64)         NULL,
  fecha_creacion DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pqrs_radicado (radicado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pqrs_adjuntos (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pqrs_id          BIGINT UNSIGNED NOT NULL,
  nombre_original  VARCHAR(255) NOT NULL,
  nombre_almacenado VARCHAR(80) NOT NULL,
  ruta             VARCHAR(255) NOT NULL,
  mime_type        VARCHAR(120) NOT NULL,
  tamano           INT UNSIGNED NOT NULL,
  fecha_creacion   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_adjunto_almacenado (nombre_almacenado),
  KEY idx_adjunto_pqrs (pqrs_id),
  CONSTRAINT fk_adjunto_pqrs FOREIGN KEY (pqrs_id) REFERENCES pqrs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Cada campo de `solicitud.json` ya tiene su columna: el volcado sería un recorrido
del prefijo `pqrs/` insertando una fila por JSON y una por adjunto. La opción
más directa en Vercel es Neon Postgres desde el marketplace.

## Despliegue en Vercel

### 1. Conectar el proyecto

1. En [vercel.com/new](https://vercel.com/new), importar el repositorio
   `Dstunja/proyecto_paginaWeb`.
2. Framework: Astro (lo detecta solo). No hay que tocar los comandos:
   `npm run build`, salida `.vercel/output`.
3. La rama de producción es `main`.

### 2. El Blob store

Ya existe: **`pqrs-adjuntos`, privado**, conectado al proyecto. Al conectarlo
Vercel definió tres variables; no hay que copiarlas a mano:

| Variable | ¿La usa el código? |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | **Sí.** Guarda y lee los archivos, verifica el aviso de subida completada de `handleUpload` y es la base de la firma de los enlaces de descarga |
| `BLOB_STORE_ID` | No. El SDK la usa para autenticarse por OIDC, que este proyecto no usa |
| `BLOB_WEBHOOK_PUBLIC_KEY` | No. El SDK la usa en `handleUploadPresigned`; el endpoint del token usa `handleUpload`, que verifica con el token |

Después de conectar un store hay que **redesplegar**: una función ya desplegada
no ve variables que no existían cuando se creó.

### 3. Turnstile

En el panel de Cloudflare: **Turnstile → Add site**, con el dominio
`dstunja.com`. Da dos claves: la pública va a `PUBLIC_TURNSTILE_SITE_KEY` y la
privada a `TURNSTILE_SECRET`.

Para desarrollo local, Cloudflare publica claves de prueba que siempre pasan:

```
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
```

### 4. Resend

PQRS y Empleos usan **cuentas de Resend distintas**, porque sin dominio verificado
cada cuenta solo entrega a su titular:

| Formulario | Cuenta registrada con | Variable de la clave | Destino |
| --- | --- | --- | --- |
| PQRS | `informacioncomercialdst@gmail.com` | `PQRS_RESEND_API_KEY` | `PQRS_DESTINO` (por defecto ese mismo correo) |
| Empleos | el correo de `EMPLEOS_DESTINO` | `RESEND_API_KEY` | `EMPLEOS_DESTINO` |

1. Iniciar sesión en [resend.com](https://resend.com) con la cuenta de PQRS,
   **API Keys → Create API Key**, y copiarla a `PQRS_RESEND_API_KEY` en Vercel.
2. El remitente se queda en `onboarding@resend.dev` (valor por defecto; no hace
   falta definir `PQRS_REMITENTE`). Con él la constancia a quien radica no se
   envía y la pantalla lo explica.
3. Cuando se quiera la constancia, **verificar un dominio** en esa cuenta
   (Domains → Add Domain, registros DNS) y poner en `PQRS_REMITENTE` una
   dirección de ese dominio.

### 5. Variables de entorno

En **Settings → Environment Variables**, para Production (y Preview si se
prueba ahí). Ninguna clave va escrita aquí: los valores reales solo viven en
Vercel.

**Obligatorias para PQRS:**

| Variable | Valor esperado | De dónde sale |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | empieza por `vercel_blob_rw_` | La pone Vercel al conectar `pqrs-adjuntos` |
| `PQRS_RESEND_API_KEY` | empieza por `re_` | Resend, cuenta de `informacioncomercialdst@gmail.com`. Si falta se usa `RESEND_API_KEY` |
| `TURNSTILE_SECRET` | empieza por `0x` | Cloudflare → Turnstile → el widget → Secret Key |
| `PUBLIC_TURNSTILE_SITE_KEY` | empieza por `0x` | El mismo widget → Site Key. Se lee al compilar |

**Recomendadas:**

| Variable | Valor esperado | Para qué |
| --- | --- | --- |
| `CRON_SECRET` | cadena larga aleatoria | Protege el cron de limpieza; sin ella responde 503 y los pendientes no se borran |
| `PQRS_IP_SALT` | cadena larga aleatoria | Sal del hash de la IP |
| `UPSTASH_REDIS_REST_URL` | URL de Upstash | Límite de tasa compartido entre instancias |
| `UPSTASH_REDIS_REST_TOKEN` | token de Upstash | Ídem |

**Opcionales, con valor por defecto:**

| Variable | Por defecto | Cuándo definirla |
| --- | --- | --- |
| `PQRS_DESTINO` | `informacioncomercialdst@gmail.com` | Solo si cambia el buzón. Con `onboarding@resend.dev` tiene que ser el titular de la cuenta |
| `PQRS_REMITENTE` | `onboarding@resend.dev` | Cuando haya un dominio verificado en la cuenta de PQRS |
| `PQRS_ADJUNTO_MAX_MB` | `5` | Para cambiar el peso máximo por archivo |
| `PQRS_MAX_ARCHIVOS` | `3` | Para cambiar el número de archivos |
| `PUBLIC_PQRS_ADJUNTO_MAX_MB` | `5` | Debe coincidir con `PQRS_ADJUNTO_MAX_MB` |

**Las pone Vercel y el código no las usa:** `BLOB_STORE_ID`,
`BLOB_WEBHOOK_PUBLIC_KEY`. Pueden quedarse.

**Hay dos variables que BORRAR si siguen en Vercel:**

- `PUBLIC_PQRS_BLOB_ACCESS`. Permitía subir con acceso público; el acceso ahora
  es privado y fijo, y un store privado rechaza las subidas públicas.
- `PUBLIC_PQRS_ADMIN_DESTINO`. Existió mientras la categoría administrativa salía
  por un `mailto:` que armaba el navegador. Hoy ese envío va al mismo
  `PQRS_DESTINO` y ya no la lee nadie.

`RESEND_API_KEY` sigue siendo necesaria para **Empleos**, con la clave de su propia
cuenta (ver docs/EMPLEOS-POSTULACION.md). `npm run check:env` revisa todas.

Las que empiezan por `PUBLIC_` se leen **en tiempo de compilación** y acaban en
el JavaScript del navegador: ahí no puede ir ningún secreto. Cambiar una de
ellas en el panel de Vercel **no surte efecto hasta que se vuelve a compilar**.

El teléfono y el correo que se MUESTRAN en el bloque administrativo no son
variables de entorno: salen de `empresa`, en `src/data/site.ts`, que es la fuente
única del sitio y ya alimenta el pie.

`PQRS_ADJUNTO_MAX_MB` y `PUBLIC_PQRS_ADJUNTO_MAX_MB` deberían tener el mismo
valor. La primera es la que manda (la aplica el servidor); la segunda es la que
el navegador usa para avisar antes de subir y para el texto de ayuda.

### 6. El cron

`vercel.json` declara la limpieza diaria a las 04:00 UTC (23:00 en Colombia).
En el plan Hobby los cron se ejecutan **una vez al día** y a una hora
aproximada; para este trabajo sobra. Vercel manda la cabecera
`Authorization: Bearer $CRON_SECRET` automáticamente.

### 7. El dominio

**Settings → Domains → Add**, `dstunja.com`. Vercel indica los registros DNS
(un `A` a su IP para el ápice y un `CNAME` para `www`). El certificado se emite
solo.

`astro.config.mjs` ya tiene `site: 'https://dstunja.com'` y **ya no tiene
`base`**, que es lo que necesita un dominio propio.

### GitHub Pages sigue publicando, y ahora queda roto

`.github/workflows/deploy.yml` no se ha tocado: sigue republicando en
`https://dstunja.github.io/proyecto_paginaWeb` en cada push a `main`. Sin `base`,
esa copia **queda rota**: los archivos de `/_astro/` dan 404 y la página se ve
sin estilos. Y aunque se arreglara, ahí no hay funciones, así que radicar caería
siempre al respaldo por correo.

Para arreglarlo, una de dos:

- Retirar el workflow (`git rm .github/workflows/deploy.yml`), o
- devolver el `base` detrás de una variable, por ejemplo
  `base: process.env.DEPLOY_TARGET === 'github' ? '/proyecto_paginaWeb' : undefined`,
  y poner `DEPLOY_TARGET=github` en el workflow.

También quedan de la etapa anterior `wrangler.jsonc` y la dependencia `wrangler`
(Cloudflare), que ya no se usan.

## Comandos

```bash
# 1. Dependencias (ya instaladas en el repositorio)
npm install

# 2. Comprobación de tipos
npm run check

# 3. Pruebas de servidor (Vitest, sin red: Blob y Resend simulados)
npm test

# 4. Compilar
npm run build

# 5. Pruebas de navegador (Playwright, con las llamadas interceptadas)
npm run verificar:pqrs
```

Para desarrollo local con la API funcionando hace falta el entorno de Vercel,
que es quien resuelve las funciones:

```bash
npx vercel link      # una sola vez
npx vercel env pull  # baja las variables a .env.local
npx vercel dev
```

Con `npm run dev` a secas las páginas se ven, pero `/api/pqrs` no responde y el
formulario cae al respaldo por correo.

## Pruebas

`npm test` (Vitest, 112 comprobaciones de PQRS: 53 de `radicar.ts` —que
incluye la descarga—, 26 de `emitir-token.ts` y 33 de `administrativa.ts`; más
42 de Empleos) prueba el servidor con
Vercel Blob y Resend simulados y bytes de archivo de verdad: los cinco formatos
válidos, MIME falso, PNG que se hace pasar por PDF, ZIP renombrado a `.docx`,
doble extensión, exceso de peso mintiendo sobre el tamaño, más de tres archivos,
blob de otra sesión, Turnstile inválido o sin configurar, que **los cinco
tipos** guardan su adjunto y lo mueven a la carpeta del radicado, que el tope de
tres archivos rige para todos, que un tipo inventado da `422 tipo-invalido` y
que ese 422 llega **antes** que Turnstile —para poder diagnosticar sin gastar un
token bueno—, autorización ausente, límite de tasa,
municipio fuera de la lista de cobertura (400), municipio escrito sin tildes o
en minúsculas (se acepta y se guarda con su nombre oficial) y el asunto del
correo al área con categoría, tipo y municipio.

Sobre correo y almacenamiento, `radicar.ts` comprueba además: que con el
remitente por defecto (`onboarding@resend.dev`) sale solo el correo al área y la
constancia queda `omitida`, y que con un remitente de dominio propio sale también
la constancia; que el correo al área enlaza a `/api/pqrs/descarga` y no lleva ni
la URL del blob ni el archivo; que sin `BLOB_READ_WRITE_TOKEN` o sin clave de
Resend responde `503 config-incompleta` sin guardar ni mandar nada; que
`PQRS_RESEND_API_KEY` manda sobre `RESEND_API_KEY`; que sin `PQRS_DESTINO` va a
`informacioncomercialdst@gmail.com`; y que si Resend rechaza el correo al área la
radicación vale igual, con `correoArea: false` y sin filtrar el motivo. De la
descarga: el enlace del correo redirige (302) a una URL firmada; una firma
alterada, una ruta cambiada u otro token dan 403; un enlace caducado, 410;
`solicitud.json`, un pendiente o una ruta con `../`, 400 aunque la firma sea
buena; un archivo borrado, 404; y sin token, 503.

Las 33 de `administrativa.ts` comprueban: que el recado sale al buzón
de `PQRS_DESTINO` con el asunto «Solicitud administrativa · Nombre» y no con el
de una radicación, que el correo de quien escribe es opcional de verdad (sin él
no se pone `replyTo` y el mensaje lo dice) pero se valida si viene, que faltan
campos devuelve **todos** los errores a la vez, que Turnstile falla cerrado —sin
`TURNSTILE_SECRET` no sale nada—, los valores por defecto de destino y remitente,
que `PQRS_RESEND_API_KEY` manda sobre `RESEND_API_KEY`, que sin ninguna clave
responde `503 config-incompleta` antes de gastar Turnstile, que un fallo de
Resend da 500 sin filtrar el motivo técnico, y que el límite de tasa cuenta por IP.

`npm run verificar:pqrs` (Playwright, 184 comprobaciones en móvil y escritorio)
cubre lo que se ve:

- **La elección por clic**: que cada una de las dos categorías y cada uno de los
  cinco tipos se marca al pulsar su tarjeta, que el valor llega al campo que se
  envía, que el formulario aparece sin recargar y que el foco queda en el primer
  campo.
- **El campo de soporte y la validación de cliente**: que aparece habilitado en
  los cinco tipos de la comercial, que la etiqueta es «Soportes o evidencias
  (opcional)» y el input no es obligatorio, que cambiar de tipo **conserva** lo
  ya adjuntado, y que cambiar de categoría con un archivo puesto se lleva la
  sección entera y descarta el adjunto.
- **El bloque administrativo**: que aparece al elegir la categoría y **dentro de
  la pantalla**, no bajo el pliegue; que el paso 2 y el formulario de PQRS no
  solo se ocultan sino que quedan fuera de alcance del foco y del lector de
  pantalla; que el teléfono y el correo son los exactos, con sus enlaces
  `tel:`, `mailto:` (con asunto) y `wa.me` (con el mensaje prellenado); que los
  botones de copiar dejan el dato en el portapapeles; y que al volver a
  comercial todo se deshace.
- **El formulario corto administrativo**: que llama una sola vez a
  `/api/pqrs/administrativa` con los cuatro campos y el token, que no radica nada
  por el camino, que la confirmación no promete radicado, que un 403 de
  antirrobots enseña el motivo **sin** caer al `mailto:` y dejando el botón
  usable, y que si la función no contesta sí se abre el gestor de correo.
- **La radicación comercial** con `POST /api/pqrs`, `POST /api/pqrs/token` y el
  script de Turnstile interceptados, incluido el **camino completo con adjunto**:
  se simulan los dos pasos de `@vercel/blob` (pedir el permiso y subir el archivo
  a `https://vercel.com/api/blob`) y se comprueba que la queja llega hasta su
  radicado con el soporte anunciado.
- **El municipio**: que aparece con el formulario en los cuatro tipos de la
  categoría comercial, que al enfocarlo se despliegan los 87, que filtra ignorando
  tildes y mayúsculas en los dos sentidos, que se maneja con flechas, Enter y
  Escape anunciando la opción con `aria-activedescendant`, que un municipio
  fuera de cobertura deja el campo inválido y no deja enviar, que lo escrito a
  la ligera se corrige al nombre oficial, y que la elección sobrevive a cambiar
  de categoría, de tipo y a recargar.
- **La geolocalización por los dos caminos**, usando el permiso y las
  coordenadas simuladas de Playwright: concedida sobre Samacá preselecciona
  Samacá; denegada deja el campo vacío, sin ningún error, con el formulario
  usable y sin haber esperado a nada.
- **El botón de WhatsApp**: que lleva categoría, tipo, municipio y nombre, y que
  **no** arrastra el documento, el teléfono ni el correo.
- Que un error 400 se muestra sin caer al correo y que una API caída sí activa el
  respaldo con el aviso de que así **no** queda radicada.
- **La configuración incompleta**: que un `503 config-incompleta` avisa «La
  radicación en línea no está disponible en este momento» y abre el correo, en
  la comercial y en la administrativa, sin nombrar variables.
- **La confirmación sin constancia**: con `constancia: 'omitida'` no dice «también
  te lo enviamos por correo» y pide copiar o anotar el número; con
  `correoArea: false` confirma el radicado y sugiere WhatsApp; y con todo enviado
  mantiene la frase del correo y no enseña avisos.

Las comprobaciones de Turnstile se adaptan al sitio compilado: si el build no
llevaba `PUBLIC_TURNSTILE_SITE_KEY`, se exige que el token viaje **vacío**, que
es lo que hace que el error salga del servidor con un mensaje entendible.

Lo que ninguna de las dos cubre es la subida real a Vercel Blob: el protocolo de
`upload()` no se simula. Esa parte hay que probarla en un despliegue de vista
previa antes de dar por buena una versión.

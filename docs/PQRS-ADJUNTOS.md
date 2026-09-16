# Radicación de PQRS y archivos de soporte

## Estado en producción

Así queda configurado el despliegue de Vercel (<https://paginaweb-beta-coral.vercel.app>),
con la radicación y los recados enviando correo de verdad. Aquí no va ningún
valor de clave: solo nombres y dónde vive cada cosa.

| Pieza | Configuración |
| --- | --- |
| Antirrobots | Cloudflare Turnstile, widget **«DST web»**, modo **Non-interactive**. Hostnames: `dstunja.com`, `paginaweb-beta-coral.vercel.app`, `vercel.app` y `localhost` |
| Correo de PQRS | Cuenta de Resend registrada con **informacioncomercialdst@gmail.com**, clave en `PQRS_RESEND_API_KEY`. Remitente `onboarding@resend.dev`, sin dominio verificado |
| Correo de Empleos | Otra cuenta de Resend, registrada con **ghsantiagodetunja@gmail.com**, clave en `RESEND_API_KEY`. Mismo remitente de pruebas (ver docs/EMPLEOS-POSTULACION.md) |
| Soportes | Blob store **privado `pqrs-adjuntos`**, conectado al proyecto. El correo al área los enlaza por `/api/pqrs/descarga` |
| Constancia a quien radica | **No se envía**: con `onboarding@resend.dev` Resend solo entrega al titular de la cuenta. La pantalla pide copiar el número |

### Turnstile «DST web»

- **Non-interactive**: Cloudflare no pide marcar ninguna casilla; con
  `appearance: 'interaction-only'` el widget ni se ve. El cliente
  (`src/lib/turnstile-cliente.ts`) sigue preparado por si algún día pidiera
  interacción: avisa y no corta la espera.
- **Hostnames autorizados**: `dstunja.com` (listo para cuando el dominio apunte a
  Vercel), `paginaweb-beta-coral.vercel.app` (producción), `vercel.app` y
  `localhost` (desarrollo). Un dominio que no esté en la lista hace fallar el
  widget con el código `110200`, que el cliente deja en la consola.
- **Ojo con `vercel.app`**: autoriza cualquier subdominio de Vercel, no solo los
  de este proyecto. Sirve para las vistas previas de cada rama; si no se usan,
  conviene quitarlo y dejar solo `paginaweb-beta-coral.vercel.app`.

### Variables cargadas en Vercel (Production)

| Variable | Estado | Nota |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Cargada | La puso Vercel al conectar `pqrs-adjuntos` |
| `BLOB_STORE_ID` | Cargada | La puso Vercel; el código no la usa |
| `BLOB_WEBHOOK_PUBLIC_KEY` | Cargada | La puso Vercel; el código no la usa |
| `PQRS_RESEND_API_KEY` | Cargada | Cuenta de informacioncomercialdst@gmail.com |
| `RESEND_API_KEY` | Cargada | Cuenta de ghsantiagodetunja@gmail.com (Empleos) |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cargada | Site Key de «DST web». Se lee al compilar |
| `TURNSTILE_SECRET` | Cargada | Secret Key de «DST web» |
| `CRON_SECRET` | **Falta** | Sin ella el cron de limpieza responde 503 y las subidas abandonadas no se borran |
| `PQRS_IP_SALT` | **Falta** | Sin ella el hash de la IP va sin sal (`ipHashSalada: false` en cada registro) |
| `UPSTASH_REDIS_REST_URL` | **Falta** | Sin Upstash el límite por IP vive en la memoria de cada instancia: frena un script torpe, no un ataque |
| `UPSTASH_REDIS_REST_TOKEN` | **Falta** | Ídem |

`PQRS_DESTINO`, `PQRS_REMITENTE`, `EMPLEOS_DESTINO` y `EMPLEOS_REMITENTE` son
opcionales: sus valores por defecto ya son los de producción
(informacioncomercialdst@gmail.com, `onboarding@resend.dev`,
ghsantiagodetunja@gmail.com y `onboarding@resend.dev`). Si alguna está cargada,
tiene que valer eso mismo. `PUBLIC_PQRS_BLOB_ACCESS` y `PUBLIC_PQRS_ADMIN_DESTINO`
ya no existen: si aparecen en Vercel, se borran.

Para cargar las que faltan, las dos primeras se generan con
`node -e "console.log(crypto.randomUUID())"` y Upstash se añade desde
**Vercel → Marketplace → Upstash**, que define las dos variables sola. Después hay
que volver a desplegar.

## Pendiente: verificar dstunja.com en Resend

Hoy los correos salen desde `onboarding@resend.dev`, el remitente de pruebas de
Resend. Verificar el dominio `dstunja.com` en Resend desbloquea tres cosas:

1. **Remitente propio.** Los correos saldrían de, por ejemplo,
   `pqrs@dstunja.com` y `empleos@dstunja.com`, en vez de `onboarding@resend.dev`,
   que parece un correo de prueba y tiene más papeletas de acabar en spam.
2. **Constancia a quien radica.** Con un remitente de dominio verificado Resend
   entrega a cualquier destinatario. El código ya lo tiene en cuenta: en cuanto
   `PQRS_REMITENTE` deja de ser `@resend.dev`, la constancia vuelve a salir sola y
   la pantalla vuelve a decir «también te lo enviamos por correo».
3. **Una sola cuenta.** Ya no haría falta que cada formulario tenga la cuenta de
   su buzón: una cuenta con el dominio verificado puede mandar a
   informacioncomercialdst@gmail.com y a ghsantiagodetunja@gmail.com. Bastaría con
   `RESEND_API_KEY` de esa cuenta y borrar `PQRS_RESEND_API_KEY`, porque PQRS cae a
   `RESEND_API_KEY` cuando no tiene la suya.

### Qué registros DNS pide Resend

Se añade el dominio en **Resend → Domains → Add Domain**. Resend genera los
registros y los muestra en la pestaña **Records** del dominio; hay que copiarlos
**exactamente** como salen, porque los valores dependen de la cuenta y de la región
elegida. Tienen esta forma:

| Tipo | Nombre | Valor (forma) | Prioridad | ¿Obligatorio? |
| --- | --- | --- | --- | --- |
| MX | `send` | `feedback-smtp.<región>.amazonses.com` | 10 | Sí (rebotes y quejas) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — | Sí (SPF) |
| TXT | `resend._domainkey` | `p=` seguido de la clave pública | — | Sí (DKIM) |
| TXT | `_dmarc` | por ejemplo `v=DMARC1; p=none;` | — | Recomendado, después de verificar |
| MX | `inbound` | `inbound-smtp.<región>.amazonaws.com` | 10 | No; solo si se quiere **recibir** correo en Resend |

Tres cosas a tener en cuenta en dstunja.com:

- **No toca la web ni el correo actual.** Los registros van en subdominios
  (`send`, `resend._domainkey`): no cambian el registro `A` del sitio ni los `MX`
  de la raíz, que hoy son los del correo del dominio. Si ya hubiera un registro
  `_dmarc`, se revisa antes de añadir otro.
- **Verificación.** Suele tardar unos 15 minutos después de añadir los registros,
  aunque la propagación de DNS puede llevar hasta 72 horas.
- **Hace falta acceso al DNS de dstunja.com**, que hoy sirve otra web (WordPress).
  Resend recomienda enviar desde un subdominio para aislar la reputación;
  `send` ya lo es para el camino de retorno.

Una vez verificado: `PQRS_REMITENTE` y `EMPLEOS_REMITENTE` pasan a una dirección del
dominio, y se decide si se unifican las cuentas.

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

## El mínimo de caracteres se ve antes de enviar

La descripción de la radicación comercial y el «¿Qué necesitas?» del formulario
administrativo exigen **10 caracteres como mínimo** (y 5000 y 1500 como máximo). Antes
el mínimo no se decía en ningún sitio y la persona se enteraba al enviar, con un
«Cuéntanos brevemente qué necesitas» del servidor.

Ahora, bajo cada campo (`src/components/ContadorCaracteres.astro`):

- Antes de escribir: «Mínimo 10 caracteres.»
- Mientras falten: «Faltan 6 caracteres (mínimo 10).», en color de aviso. El campo
  queda inválido con un mensaje propio, así que al pulsar enviar el navegador
  frena y dice cuánto falta, **sin llamar a la API**.
- Al llegar: «47 de 5000 caracteres.», en verde.

El texto está enlazado al campo con `aria-describedby` y no es una región
`aria-live`: el lector de pantalla lo lee al entrar en el campo, sin anunciar cada
tecla. El campo lleva además `maxlength` con el máximo.

**El servidor valida igual que antes**, con los mismos números. Los límites y la
forma de contar viven en un solo sitio, `src/lib/pqrs/limites-texto.ts`, que usan
el contador y las dos validaciones. La forma de contar importa: el servidor
recorta los extremos y quita los caracteres de control, **saltos de línea
incluidos**, así que «hola↵mundo» cuenta 9. El contador cuenta igual
(`longitudComoServidor`), no con `value.length`; si no, podría decir «10 de 1500»
y el servidor rechazarlo. Los errores del servidor ahora dicen el mínimo: «Cuéntanos
brevemente qué necesitas, en al menos 10 caracteres.».

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

**Depende de la `Permissions-Policy` de `vercel.json`**, que tiene que decir
`geolocation=(self)`: el propio sitio puede pedir la ubicación y ningún iframe de
terceros puede. Con `geolocation=()` el navegador la niega sin preguntar y la
preselección desaparece sin ningún error visible, justo por lo de arriba. Pasó un
día en producción. `npm run verificar:navegacion` lo comprueba bajo la CSP con
coordenadas de Samacá.

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
- **Un fallo de Turnstile no abre el correo en el formulario administrativo.**
  Igual que en Empleos: si Cloudflare pide la casilla sale un aviso; si la
  verificación falla o caduca, se explica («No pudimos completar la verificación
  de seguridad… Vuelve a pulsar») y se puede reintentar. Solo si el script de
  Cloudflare no carga (un bloqueador) se ofrece el correo. Antes cualquier fallo
  de Turnstile abría el `mailto:` sin llamar nunca a la API. El formulario de
  radicación comercial todavía cae al correo en ese caso.
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

Ya existe: el widget **«DST web»** de Cloudflare, en modo **Non-interactive**, con
los hostnames `dstunja.com`, `paginaweb-beta-coral.vercel.app`, `vercel.app` y
`localhost` (ver «Estado en producción»). Su Site Key va a
`PUBLIC_TURNSTILE_SITE_KEY` y su Secret Key a `TURNSTILE_SECRET`. Si el sitio se
publica en otro dominio, hay que añadirlo en **Turnstile → «DST web» → Hostnames**
o el widget falla con `110200`.

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
| Empleos | `ghsantiagodetunja@gmail.com` | `RESEND_API_KEY` | `EMPLEOS_DESTINO` (por defecto ese mismo correo) |

Las dos están creadas y sus claves cargadas en Vercel. El remitente es
`onboarding@resend.dev` en las dos, sin dominio verificado, así que la constancia
a quien radica no se envía y la pantalla lo explica. Lo que cambia al verificar
dstunja.com está en «Pendiente: verificar dstunja.com en Resend», al principio de
este documento.

Para rotar una clave: iniciar sesión en [resend.com](https://resend.com) con la
cuenta correspondiente, **API Keys → Create API Key**, sustituirla en Vercel y
volver a desplegar.

### 5. Variables de entorno

En **Settings → Environment Variables**, para Production (y Preview si se
prueba ahí). Ninguna clave va escrita aquí: los valores reales solo viven en
Vercel. Cuáles están cargadas hoy y cuáles faltan está en «Estado en
producción», al principio de este documento.

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

`npm test` (Vitest, 144 comprobaciones de PQRS: 53 de `radicar.ts` —que
incluye la descarga—, 26 de `emitir-token.ts`, 33 de `administrativa.ts` y 32 de
`limites-texto.ts`; más 42 de Empleos) prueba el servidor con
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

Las 32 de `limites-texto.ts` comprueban que el **contador del navegador y la
validación del servidor aceptan y rechazan exactamente los mismos textos**, en la
descripción y en «¿Qué necesitas?»: vacíos, solo espacios, 9 y 10 caracteres,
espacios en los extremos, saltos de línea y tabuladores (que el servidor no
cuenta), emojis y el máximo justo y pasado por uno. También los textos del
contador en singular y plural, y que los errores del servidor dicen el mínimo.

`npm run verificar:pqrs` (Playwright, 204 comprobaciones en móvil y escritorio)
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
  usable, y que si la función no contesta sí se abre el gestor de correo. Con la
  clave de prueba inyectada y un doble de Cloudflare: que un error de Turnstile se
  explica sin abrir el correo ni llamar a la API y al reintentar el recado sale;
  que si pide la casilla sale el aviso, a los 31 s no se ha rendido y al llegar
  el token el recado llega; y que con el script bloqueado sí se ofrece el correo.
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
- **El mínimo de caracteres**, en la descripción y en «¿Qué necesitas?»: que antes
  de escribir se lee «Mínimo 10 caracteres.» enlazado al campo con
  `aria-describedby`, que al escribir poco dice cuántos faltan, que así no sale
  ninguna petición y el navegador explica cuánto falta, que un salto de línea no
  cuenta, y que al llegar al mínimo pasa a «N de 1500 caracteres.» (o de 5000) y
  el envío sale.

Las comprobaciones de Turnstile se adaptan al sitio compilado: si el build no
llevaba `PUBLIC_TURNSTILE_SITE_KEY`, se exige que el token viaje **vacío**, que
es lo que hace que el error salga del servidor con un mensaje entendible.

Lo que ninguna de las dos cubre es la subida real a Vercel Blob: el protocolo de
`upload()` no se simula. Esa parte hay que probarla en un despliegue de vista
previa antes de dar por buena una versión.

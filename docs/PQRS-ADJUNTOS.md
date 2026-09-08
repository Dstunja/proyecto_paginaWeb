# Radicación de PQRS y archivos de soporte

## Qué hace hoy

El formulario se elige en **dos pasos**, y cada clic se aplica al instante: no
hay botón de «continuar» ni recarga.

1. **Categoría** — a quién va dirigida. Decide el canal entero.
2. **Tipo** — Petición, Queja, Reclamo, Sugerencia o Felicitación.

Son ejes independientes a propósito: existe la queja administrativa y la queja
comercial. Las dos categorías están descritas en `src/lib/pqrs/categorias.ts`.

| | Administrativa | Comercial |
| --- | --- | --- |
| Cómo sale | `mailto:` desde el navegador | `POST /api/pqrs` |
| Destino | `PUBLIC_PQRS_ADMIN_DESTINO` | `PQRS_DESTINO` |
| Archivos de soporte | **No** | Sí, en Queja y Reclamo |
| Antirrobots (Turnstile) | No | Sí |
| Número de radicado | **No** | Sí |
| Asunto del correo | `PQRS Administrativa · {tipo} · {municipio}` | `[{radicado}] PQRS Comercial · {tipo} · {municipio}` |
| Funciona en GitHub Pages | Sí | No (no hay funciones) |

La administrativa no llega a tocar la red: sale por el gestor de correo de quien
escribe y por eso no puede llevar adjuntos ni dejar constancia con número. Es el
camino previsto de esa categoría, **no** un respaldo, y el formulario lo dice sin
alarmar. No hay que confundirla con el respaldo por correo de la comercial, que
solo aparece cuando la radicación ha fallado y sí avisa de que la solicitud no
quedó radicada. En el DOM se distinguen con `data-enviado="correo"` (envío
administrativo) y `data-respaldo="correo"` (respaldo tras un fallo).

La categoría **comercial** es la que **radica de verdad**: guarda la solicitud,
guarda los archivos de soporte, devuelve un número de radicado y manda dos
correos. Ya no depende del gestor de correo de quien lo diligencia.

| Parte | Estado |
| --- | --- |
| Categoría previa (administrativa / comercial) | Hecho |
| Elección por tarjetas, sin `<select>` ni botón de continuar | Hecho |
| Municipio cerrado a los 87 de cobertura, validado también en el servidor | Hecho |
| Campo de soporte solo en Comercial + Queja o Reclamo | Hecho |
| Hasta 3 archivos, 5 MB cada uno | Hecho |
| Validación por contenido real (bytes mágicos), en cliente **y** servidor | Hecho |
| Subida de los archivos a Vercel Blob privado | Hecho |
| Número de radicado, fecha y registro guardado | Hecho |
| Correo al área de PQRS con enlaces firmados | Hecho |
| Correo de confirmación a quien radica | Hecho |
| Antirrobots (Turnstile) en los dos endpoints | Hecho |
| Limpieza automática de subidas abandonadas | Hecho (cron diario) |
| Tabla `pqrs_adjuntos` en base de datos | **No**: ver «Lo que sigue pendiente» |
| Panel de administración | **No** |

El sitio sigue siendo estático (`output: 'static'`). Lo único que corre como
función de Vercel son las rutas de `src/pages/api/pqrs/`, marcadas una a una con
`export const prerender = false`.

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
    |                           | manda los dos correos        |
    |<-- { radicado, fecha } ---|                              |
```

El cuerpo de `POST /api/pqrs` es **JSON**, no multipart: solo lleva texto y las
rutas de los blobs. Nunca se acerca al límite de 4,5 MB.

## Endpoints

### `POST /api/pqrs/token`

Firma el permiso de subida (`handleUpload` de `@vercel/blob/client`). En
`onBeforeGenerateToken` exige, en este orden:

1. `clientPayload` con `sessionId` (UUID v4), `tipo` y `turnstileToken`.
2. Turnstile válido.
3. Que el tipo normalizado sea `queja` o `reclamo`. Sin esto, cualquiera podría
   usar el store como alojamiento gratuito radicando «Felicitaciones».
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
| `adjuntos` | lista 0..3 | `{ url, pathname, nombreOriginal, tamano }` |

Respuestas:

- `201` → `{ ok: true, radicado, fecha, avisos? }`. `avisos` aparece solo si la
  solicitud se guardó pero falló algún correo: la radicación **es válida** igual.
- `400` → `{ ok: false, errores: [...] }`. Campos mal, archivo rechazado, más de
  tres archivos, blob de otra sesión.
- `403` → Turnstile no pasó.
- `429` → más de 5 radicaciones en 10 minutos desde la misma IP.
- `500` → no se pudo guardar el registro. Aquí **no hay radicación**.

Los mensajes de `errores` están redactados en español y se muestran tal cual.

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
- **Blobs privados** (`access: 'private'`). La URL sola no sirve; el correo al
  área lleva enlaces firmados con caducidad de 7 días
  (`issueSignedToken` + `presignUrl`).
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

### 2. Crear el Blob store

En el proyecto: **Storage → Create Database → Blob**. Al crearlo, Vercel define
`BLOB_READ_WRITE_TOKEN` en el entorno del proyecto; no hay que copiarla a mano.

Comprobar que el plan de la cuenta admite blobs **privados**. Si no, poner
`PUBLIC_PQRS_BLOB_ACCESS=public` para que el sistema funcione, sabiendo que
entonces la única protección es que la ruta lleva un UUID no adivinable: la
caducidad del enlace deja de ser una garantía. Volver a `private` en cuanto se
pueda.

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

1. Crear cuenta en [resend.com](https://resend.com) y una API key →
   `RESEND_API_KEY`.
2. **Verificar el dominio** `dstunja.com` (Domains → Add Domain) y añadir los
   registros DNS que indique. Hasta que el dominio esté verificado, Resend solo
   deja enviar desde `onboarding@resend.dev` **y solo al correo del titular de
   la cuenta**: el correo de confirmación a quien radica no llegaría.
3. `PQRS_REMITENTE` tiene que usar el dominio verificado.

### 5. Variables de entorno

En **Settings → Environment Variables**, para Production y Preview:

| Variable | Obligatoria | Qué es |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | sí | La pone Vercel al crear el Blob store |
| `RESEND_API_KEY` | sí | API key de Resend |
| `TURNSTILE_SECRET` | sí | Clave privada de Turnstile |
| `PUBLIC_TURNSTILE_SITE_KEY` | sí | Clave pública de Turnstile (va al navegador) |
| `PQRS_DESTINO` | sí | Correo del área que atiende las PQRS **comerciales** |
| `PUBLIC_PQRS_ADMIN_DESTINO` | recomendada | Correo de las PQRS **administrativas**. Sin ella se usa `empresa.email` de `src/data/site.ts` |
| `CRON_SECRET` | sí | Cadena larga y aleatoria; protege el cron de limpieza |
| `PQRS_IP_SALT` | recomendada | Sal del hash de la IP |
| `PQRS_REMITENTE` | opcional | Remitente; por defecto `pqrs@dstunja.com` |
| `PQRS_ADJUNTO_MAX_MB` | opcional | Peso máximo por archivo (5) |
| `PQRS_MAX_ARCHIVOS` | opcional | Número de archivos (3) |
| `PUBLIC_PQRS_BLOB_ACCESS` | opcional | `private` (por defecto) o `public` |
| `PUBLIC_PQRS_ADJUNTO_MAX_MB` | opcional | Lo que aplica y muestra el navegador |
| `PUBLIC_GA_ID` | opcional | Google Analytics, como antes |
| `UPSTASH_REDIS_REST_URL` | opcional | Límite de tasa compartido |
| `UPSTASH_REDIS_REST_TOKEN` | opcional | Ídem |

Las que empiezan por `PUBLIC_` se leen **en tiempo de compilación** y acaban en
el JavaScript del navegador: ahí no puede ir ningún secreto. `PUBLIC_PQRS_ADMIN_DESTINO`
lo lleva por eso mismo: el `mailto:` se arma en el navegador, así que el valor
tiene que estar dentro del bundle. No es un secreto —es una dirección de
contacto que el sitio ya publica en el pie— pero **hay que redesplegar** después
de cambiarla. Admite varias direcciones separadas por coma.

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

`npm test` (Vitest, 53 comprobaciones) cubre `src/lib/pqrs/radicar.ts` con
Vercel Blob y Resend simulados y bytes de archivo de verdad: los cinco formatos
válidos, MIME falso, PNG que se hace pasar por PDF, ZIP renombrado a `.docx`,
doble extensión, exceso de peso mintiendo sobre el tamaño, más de tres archivos,
blob de otra sesión, Turnstile inválido o sin configurar, adjuntos con tipo
Petición (se ignoran y se borran), autorización ausente, límite de tasa,
municipio fuera de la lista de cobertura (400), municipio escrito sin tildes o
en minúsculas (se acepta y se guarda con su nombre oficial) y el asunto del
correo al área con categoría, tipo y municipio.

`npm run verificar:pqrs` (Playwright, 152 comprobaciones en móvil y escritorio)
cubre lo que se ve:

- **La elección por clic**: que cada una de las dos categorías y cada uno de los
  cinco tipos se marca al pulsar su tarjeta, que el valor llega al campo que se
  envía, que el formulario aparece sin recargar y que el foco queda en el primer
  campo.
- **El campo condicional y la validación de cliente**, incluida la regla que
  cruza los dos ejes: con «Administrativa + Queja» el campo de adjuntos
  desaparece y descarta lo que hubiera seleccionado.
- **La categoría administrativa**: que no llama a ninguna función, que anuncia el
  destino configurado, que dice que no hay radicado y que se marca como envío
  deliberado y no como respaldo de un fallo.
- **La radicación comercial** con `POST /api/pqrs`, `POST /api/pqrs/token` y el
  script de Turnstile interceptados, incluido el **camino completo con adjunto**:
  se simulan los dos pasos de `@vercel/blob` (pedir el permiso y subir el archivo
  a `https://vercel.com/api/blob`) y se comprueba que la queja llega hasta su
  radicado con el soporte anunciado.
- **El municipio**: que aparece con el formulario en las cuatro combinaciones de
  categoría y tipo, que al enfocarlo se despliegan los 87, que filtra ignorando
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

Las comprobaciones de Turnstile se adaptan al sitio compilado: si el build no
llevaba `PUBLIC_TURNSTILE_SITE_KEY`, se exige que el token viaje **vacío**, que
es lo que hace que el error salga del servidor con un mensaje entendible.

Lo que ninguna de las dos cubre es la subida real a Vercel Blob: el protocolo de
`upload()` no se simula. Esa parte hay que probarla en un despliegue de vista
previa antes de dar por buena una versión.

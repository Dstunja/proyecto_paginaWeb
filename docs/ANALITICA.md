# Estadísticas de la página — guía para la empresa

Esta guía explica **quién puede ver las estadísticas de dstunja.com y cómo se le
da acceso**, cómo se arma el panel que verá esa persona, y qué informe mirar
para cada pregunta de negocio. **No hace falta saber programar**: todo se hace
desde el navegador.

Tiempo aproximado: 30 minutos la primera vez. Después, nada: el panel se
actualiza solo.

---

## 1. Qué se decidió y por qué

La empresa quiere saber cuánta gente entra a la página, cómo se mueve dentro de
ella y qué secciones consulta más. Esa información **no puede ser pública**:
solo la ve una persona autorizada.

La página es un **sitio estático**: son archivos HTML publicados en Vercel, sin
base de datos y sin sistema de usuarios propio. Por eso **no** se creó una
página `/estadisticas` con contraseña dentro del sitio: en un sitio estático la
contraseña viajaría dentro del código de la página y cualquiera podría leerla
con "ver código fuente". No protegería nada.

En su lugar, las estadísticas viven en **la nube de Google**, en dos piezas:

| Pieza | Para qué sirve | Quién entra |
|---|---|---|
| **Google Analytics 4 (GA4)** | Recoge y guarda los datos. Tiene todos los informes, pero su interfaz es densa. | Quien quiera el detalle completo. |
| **Looker Studio** | Un panel de una sola pantalla, con las gráficas que de verdad importan. Se comparte como un documento. | La persona de la empresa que solo quiere ver cómo va la página. |

Las dos son gratuitas, no necesitan servidor y **el control de acceso lo
resuelve la propia cuenta de Google**: se comparten solo con el correo de la
persona autorizada, que entra desde cualquier computador con su usuario y
contraseña de Google. Aunque alguien conozca la dirección de la web, no puede
ver los datos.

Los datos no se recogen con GA4 directamente, sino a través de un **contenedor
de Google Tag Manager (GTM)**. La etiqueta de GA4 está creada dentro de ese
contenedor. Esto permite cambiar qué se mide desde la interfaz de Tag Manager,
sin volver a tocar el código ni a publicar el sitio.

---

## 2. Poner en marcha la medición

Hazlo con el **Gmail de la empresa**, no con un correo personal: esa cuenta es
la dueña de los datos y es la única que puede dar y quitar accesos.

### 2.1 Crear la propiedad de GA4

1. Entra a <https://analytics.google.com> e inicia sesión con el Gmail de la
   empresa.
2. Pulsa **Empezar a medir** (o **Administrar** → **Crear** → **Cuenta**).
3. **Nombre de la cuenta**: `Distribuciones Santiago de Tunja`.
4. **Nombre de la propiedad**: `dstunja.com`.
   - Zona horaria: `(GMT-05:00) Bogotá`.
   - Moneda: `Peso colombiano (COP)`.
5. Responde las preguntas del sector (**Comercio minorista / Distribución**) y
   marca el objetivo **Examinar el comportamiento de los usuarios**.
6. En **Empezar a recoger datos** elige **Web**.
   - **URL del sitio web**: `https://dstunja.com`.
   - **Nombre del flujo**: `Sitio dstunja`.
7. Deja activada la **Medición mejorada**: registra sola el desplazamiento por
   la página, los clics a sitios externos, las búsquedas del sitio y las
   descargas.
8. Al terminar verás el **ID de medición**, con la forma `G-XXXXXXXXXX`.
   **Cópialo**: se usa en el paso siguiente, dentro de Tag Manager.

Anota también el **ID numérico de la propiedad** (**Administrar** → **Detalles
de la propiedad**, con la forma `123456789`). No es lo mismo que el
`G-XXXXXXXXXX` y hace falta si algún día se consulta la API.

### 2.2 Crear el contenedor de Tag Manager

1. Entra a <https://tagmanager.google.com> con el mismo Gmail.
2. **Crear cuenta**: nombre `Distribuciones Santiago de Tunja`, país `Colombia`.
3. **Nombre del contenedor**: `dstunja.com`. Plataforma: **Web**.
4. Al terminar verás el **ID del contenedor**, con la forma `GTM-XXXXXXX`.
   **Cópialo**: es lo único que hay que llevar al sitio.
5. Dentro del contenedor, crea la etiqueta de GA4:
   - **Etiquetas** → **Nueva** → tipo **Google Tag**.
   - **ID de la etiqueta**: el `G-XXXXXXXXXX` del paso anterior.
   - **Activador**: `Initialization - All Pages`.
   - Guarda y pulsa **Enviar** arriba a la derecha para publicar el contenedor.

> **Importante:** el sitio **no** carga `gtag.js` por su cuenta. Si además de la
> etiqueta de GTM se cargara GA4 directo, cada página vista se contaría **dos
> veces**. Por eso la variable `PUBLIC_GA_ID` se retiró del proyecto.

### 2.3 Dónde se pone el ID del contenedor

El ID **no se escribe en el código**. Se guarda como variable de entorno y solo
se usa mientras la página se compila.

- **Vercel** (la publicación real, <https://dstunja.com>): panel del proyecto →
  **Settings** → **Environment Variables** → nombre `PUBLIC_GTM_CONTAINER_ID`,
  valor `GTM-XXXXXXX`, marcando los tres entornos. Luego **Deployments** →
  **Redeploy** en el último despliegue, para que la variable entre.
- **GitHub Pages** (el espejo de revisión interna): repositorio → **Settings** →
  **Secrets and variables** → **Actions** → pestaña **Variables** → **New
  repository variable** con el mismo nombre y valor.
- **En local**, para pruebas: una línea `PUBLIC_GTM_CONTAINER_ID=GTM-XXXXXXX` en
  el archivo `.env`, que no se sube al repositorio.

### 2.4 Comprobar que quedó funcionando

1. Abre <https://dstunja.com> en el navegador.
2. Acepta el aviso de cookies que aparece abajo.
3. En Google Analytics entra a **Informes** → **Tiempo real**. Deberías verte a
   ti mismo como usuario activo en menos de un minuto.

Si no aparece nada: revisa que la variable se llame exactamente
`PUBLIC_GTM_CONTAINER_ID`, que el contenedor de GTM esté **publicado** (botón
**Enviar**), que hayas vuelto a desplegar en Vercel después de crear la
variable, y que no tengas un bloqueador de anuncios activo (bloquean Google
Analytics y Tag Manager).

> En desarrollo (`npm run dev`) nunca se envía nada, aunque el ID esté
> configurado. Las pruebas de quien programa no ensucian las estadísticas.

---

## 3. Dar acceso a la persona autorizada (y a nadie más)

Son dos accesos distintos y conviene dar los dos.

### 3.1 Acceso a GA4 (el detalle completo)

1. En Google Analytics, abajo a la izquierda, entra a **Administrar**.
2. En la columna **Propiedad**, entra a **Gestión de acceso a la propiedad**.
3. Arriba a la derecha, botón **+** → **Añadir usuarios**.
4. Escribe el **correo** de la persona. Tiene que ser una cuenta de Google; si
   usa un correo de otro proveedor, primero debe crear una cuenta de Google con
   ese correo.
5. Elige el rol:
   - **Lector** — puede ver todos los informes. *Es el recomendado.*
   - **Analista** — además puede crear y guardar exploraciones propias.
   - **No uses Editor ni Administrador**: dejarían cambiar la configuración de
     medición o dar acceso a otras personas.
6. **Añadir**. La persona recibe un correo y desde ese momento entra a
   <https://analytics.google.com> con su cuenta y ve la propiedad.

### 3.2 Acceso al panel de Looker Studio (lo del día a día)

Una vez armado el panel (punto 4), se comparte como cualquier documento de
Google:

1. Abre el informe en <https://lookerstudio.google.com>.
2. Botón **Compartir**, arriba a la derecha.
3. Escribe **solo** el correo de la persona autorizada, con permiso **Puede
   ver**.
4. **No** actives "Cualquier persona con el enlace": eso haría públicos los
   datos de la empresa.
5. Pásale el enlace del informe. Entra con su cuenta de Google y ve el panel, en
   el computador o en el celular.

### 3.3 Higiene de accesos

- **Revisa la lista periódicamente.** En las dos pantallas anteriores se ve
  quién tiene acceso; para quitárselo a alguien, márcalo y elimínalo. Cuando
  alguien sale de la empresa, ese es el primer paso.
- **Activa la verificación en dos pasos** en el Gmail de la empresa y pide a la
  persona autorizada que la active en el suyo: es lo que impide que alguien que
  adivine la contraseña entre a ver los datos. Se hace en
  <https://myaccount.google.com/security> → **Verificación en dos pasos**.
- **Nunca compartas la contraseña del Gmail de la empresa** para que alguien
  "mire las estadísticas". Para eso está el acceso por correo: se da y se quita
  sin tocar la cuenta dueña.

---

## 4. Armar el panel en Looker Studio

1. Entra a <https://lookerstudio.google.com> con el Gmail de la empresa.
2. **Crear** → **Informe** → conector **Google Analytics** → elige la cuenta, la
   propiedad `dstunja.com` → **Añadir**.
3. Ponle nombre al informe arriba a la izquierda: `Estadísticas dstunja.com`.
4. Añade estos gráficos (**Añadir un gráfico** en la barra superior). Es una
   sugerencia de punto de partida; se puede cambiar en cualquier momento:

| Gráfico | Configuración | Qué responde |
|---|---|---|
| **Marcadores** (4, en fila) | Métricas: `Usuarios activos`, `Vistas`, `Tiempo de interacción medio`, `Sesiones interesadas` | El resumen de la semana de un vistazo |
| **Serie temporal** | Dimensión `Fecha`, métrica `Usuarios activos` | Si la página sube o baja |
| **Gráfico circular** | Dimensión `Grupo de canales predeterminado de la sesión`, métrica `Sesiones` | De dónde llega la gente (buscador, redes, directo) |
| **Tabla** | Dimensión `Ruta de página`, métrica `Vistas` | Qué páginas se ven más |
| **Tabla** | Dimensión `Ciudad`, métrica `Usuarios activos` | De qué municipios entran |
| **Gráfico circular** | Dimensión `Categoría de dispositivo`, métrica `Usuarios activos` | Celular o computador |
| **Tabla** | Dimensión `Nombre del evento`, métrica `Recuento de eventos`, filtrada a los eventos del punto 6 | Qué hace la gente: pedidos, WhatsApp, PQRS |
| **Tabla** | Dimensión personalizada `seccion`, métrica `Recuento de eventos` | Qué secciones del inicio se ven más |

5. Añade arriba un **control de periodo** (**Añadir un control** → **Control de
   periodo**) para que la persona pueda cambiar el rango de fechas sin ayuda.
6. Pulsa **Ver** para dejarlo en modo lectura, y compártelo como dice el punto
   3.2.

> Las últimas dos filas de la tabla solo funcionan después de hacer el punto 5:
> los eventos propios y sus parámetros necesitan configurarse antes en GTM y en
> GA4.

---

## 5. Que los eventos propios lleguen a los informes

Los eventos propios del sitio (punto 6) se empujan al `dataLayer` de Tag
Manager. Para que aparezcan en GA4 —y por tanto en Looker Studio— hacen falta
dos configuraciones, las dos por única vez.

### 5.1 En Tag Manager: conectar cada evento

Por cada evento que quieras medir:

1. **Activadores** → **Nuevo** → tipo **Evento personalizado**.
   - **Nombre del evento**: el nombre exacto de la tabla del punto 6, por
     ejemplo `pedido_whatsapp`.
2. **Etiquetas** → **Nueva** → **Google Analytics: evento de GA4**.
   - **Etiqueta de configuración**: la Google Tag que creaste en el punto 2.2.
   - **Nombre del evento**: el mismo, `pedido_whatsapp`.
   - **Parámetros del evento**: añade una fila por cada parámetro de la tabla,
     con el valor tomado de una **Variable de capa de datos** con ese mismo
     nombre (**Variables** → **Nueva** → **Variable de capa de datos** →
     nombre `municipio`, y así con cada uno).
   - **Activador**: el que creaste arriba.
3. Cuando termines, pulsa **Enviar** para publicar el contenedor. Mientras no se
   publique, los cambios no llegan al sitio.

Para probar antes de publicar, usa **Vista previa** en Tag Manager: abre
dstunja.com desde ahí y verás en pantalla cada evento según lo vas disparando.

### 5.2 En GA4: registrar las dimensiones personalizadas

GA4 solo muestra un parámetro en los informes si antes se registra como
**dimensión**:

1. **Administrar** → columna Propiedad → **Definiciones personalizadas**.
2. **Crear dimensiones personalizadas**, una por cada parámetro que quieras
   desglosar. Los más útiles: `seccion`, `destino`, `marca`, `municipio`,
   `vacante`, `categoria`, `tipo`, `valor`.
   - **Nombre de la dimensión**: el mismo del parámetro (`seccion`).
   - **Ámbito**: `Evento`.
   - **Parámetro del evento**: el mismo nombre (`seccion`).
3. Los datos empiezan a acumularse desde ese momento y **no se aplican hacia
   atrás**, así que conviene hacerlo el mismo día que se activa la medición.

### 5.3 Marcar los eventos clave

Un "evento clave" es lo que para la empresa cuenta como éxito. Aquí son
`pedido_whatsapp` (un pedido armado y enviado), `envio_pqrs` y
`postulacion_enviada`.

1. **Administrar** → columna Propiedad → **Eventos clave**.
2. Si el evento ya se registró alguna vez, aparece en la lista: activa el
   interruptor **Marcar como evento clave**.
3. Si todavía no aparece, pulsa **Nuevo evento clave** y escribe el nombre
   exacto.

A partir de ahí, en los informes de adquisición se ve **de qué canal llegan las
personas que sí terminan enviando un pedido**, que es la pregunta de marketing
que más sirve.

---

## 6. Eventos propios de este sitio

Además de lo que GA4 mide solo (páginas vistas, desplazamiento, clics de salida,
búsquedas del sitio), la página envía estos eventos. Todos están en español y en
`snake_case`, dentro del límite de 40 caracteres de GA4.

| Evento | Cuándo se dispara | Parámetros |
|---|---|---|
| `seccion_vista` | Una sección del inicio se ve en pantalla. Una sola vez por sección y visita. | `seccion`: `hero`, `cifras`, `marcas`, `especiales_mes`, `valor_agregado`, `cobertura`, `para_tu_negocio`, `resenas`, `haz_tu_pedido`, `empleos_pqrs`, `siguenos` |
| `clic_cta` | Clic en un botón o enlace de contacto o de una sección clave. | `destino`: `whatsapp`, `pedido`, `correo`, `telefono`, `pqrs`, `empleos`, `catalogo`, `contactanos`, `innovacion`, `nosotros`, `instagram`, `facebook`, `x`, `pideky`, `ubicacion`, `resenas`, `resena_autor`, `escribir_resena` |
| `cta_arma_pedido` | Clic en el botón "Arma tu pedido" del encabezado. | `pagina` (ruta desde donde se pulsó), `sitio` (`barra` u otro, según el botón) |
| `catalogo_buscar` | La persona deja de escribir en el buscador del armador de pedidos (mínimo 3 letras). | `termino` |
| `filtro_catalogo` | Se usa cualquier filtro del catálogo. | `tipo` (`marca`, `categoria`, `subcategoria`), `valor`, `accion` (`poner`, `quitar`, `limpiar`), `activas` (cuántos filtros quedan), `categoria` (solo en subcategorías) |
| `pedido_agregar` | Se agrega una referencia al pedido. | `codigo_sap`, `marca` |
| `pedido_quitar` | Se quita una referencia del pedido. | `codigo_sap`, `marca` |
| `pedido_whatsapp` | Se envía el pedido por WhatsApp. **Evento clave.** | `productos` (cuántas referencias), `marcas_distintas`, `municipio` |
| `busqueda_cobertura` | Se busca un municipio en el mapa del inicio. | `municipio`, `encontrado` (`true` / `false`) |
| `envio_pqrs` | Se radica una PQRS. **Evento clave.** | `formulario`, `categoria`, `tipo` |
| `envio_contacto` | Se envía un formulario que abre el gestor de correo. | `formulario` |
| `vacante_ver` | Se abre el detalle de una convocatoria. | `vacante` |
| `vacante_postular` | Se pulsa "Postularme". | `vacante` |
| `contacto_vacante` | Se escribe por WhatsApp desde una convocatoria. | `vacante`, `linea` |
| `postulacion_enviada` | Se envía una postulación de empleo. **Evento clave.** | `cargo` |
| `articulo_leer` | Una novedad de la página Innovación se ve en pantalla. | `articulo` |
| `articulo_completado` | El recorrido de la página Innovación pasa el 90 %. | — |

### Qué NO se envía nunca

- Nombres, correos, teléfonos ni datos del negocio de quien arma un pedido, se
  postula a un empleo o radica una PQRS. De un pedido enviado solo viaja cuántas
  referencias lleva, cuántas marcas distintas y el municipio de entrega.
- El contenido de los formularios: el texto de una PQRS o de una postulación no
  pasa por la analítica.
- Búsquedas que parezcan datos personales. Si un término lleva una arroba o
  siete o más dígitos seguidos, se reemplaza por `[omitido]` antes de salir del
  navegador (`limpiarTermino()` en `src/lib/analitica.ts`).

---

## 7. Qué informe mirar para cada pregunta

Si la respuesta no está en el panel de Looker Studio, en GA4:

| Pregunta de negocio | Dónde mirarlo |
|---|---|
| **¿Cuánta gente entra?** | **Informes** → **Adquisición** → **Adquisición de tráfico**. Arriba el total de usuarios; abajo, de dónde llegaron. |
| **¿Cómo navegan dentro de la página?** | **Explorar** → **Exploración de rutas**. Empieza en "page_view / Inicio" y ve abriendo pasos. |
| **¿Qué secciones consultan más?** | **Informes** → **Interacción** → **Eventos** → `seccion_vista`, con el parámetro **seccion** como dimensión secundaria. |
| **¿De dónde son?** | **Informes** → **Usuario** → **Datos demográficos** → **Detalles demográficos**, cambiando la dimensión principal a **Ciudad**. |
| **¿Con qué entran, celular o computador?** | **Informes** → **Usuario** → **Tecnología** → **Descripción general**. |
| **¿Cuánto tiempo se quedan?** | La métrica **Tiempo de interacción medio**, en casi todos los informes de **Interacción**. |
| **¿Qué productos agregan al pedido?** | Evento `pedido_agregar`, con el parámetro **marca** o **codigo_sap**. |
| **¿Qué municipios buscan y no cubrimos?** | Evento `busqueda_cobertura`, filtrando por **encontrado** = `false`. |
| **¿Cuántos pedidos se arman de verdad?** | Evento `pedido_whatsapp`. Comparado con `pedido_agregar` dice cuántos carritos se quedan a medias. |

---

## 8. Aviso de cookies y protección de datos

La página muestra abajo una franja con dos botones, **Aceptar** y **Solo lo
necesario**, la primera vez que alguien entra. Es lo que pide la Ley 1581 de 2012
de protección de datos personales.

- Mientras la persona no acepte, la medición funciona en modo restringido
  (*Consent Mode*): recibe la visita pero **no guarda cookies** ni identifica a
  la persona entre sesiones. Los totales de "usuarios" serán algo menos
  precisos, pero la medición es legal desde el primer momento.
- Al aceptar, la medición pasa a ser completa.
- La decisión se guarda en el propio navegador de la persona y la franja no
  vuelve a aparecer.
- El texto legal está en <https://dstunja.com/privacidad/>. **Ese texto es un
  borrador y debe revisarlo el área jurídica antes de la publicación
  definitiva.**

---

## 9. Para quien mantiene el código

| Archivo | Qué hace |
|---|---|
| `src/components/Analitica.astro` | Inyecta el contenedor de GTM en el `<head>`. Solo si hay `PUBLIC_GTM_CONTAINER_ID` **y** la compilación es de producción. |
| `public/js/analitica-arranque.js` | Crea el `dataLayer`, declara el Consent Mode en `denied` y carga el contenedor. Va en un archivo aparte, no en línea, porque la CSP de `vercel.json` no permite `'unsafe-inline'` en `script-src`. |
| `src/components/AnaliticaNoscript.astro` | El `<iframe>` de respaldo de GTM al inicio del `<body>`. |
| `src/lib/analitica.ts` | `registrarEvento()`, `limpiarTermino()` y el consentimiento. Todo es no-op si GTM no cargó. |
| `src/components/AvisoCookies.astro` | La franja de cookies. Guarda la decisión en `localStorage` con la clave `dst_consentimiento`. |
| `src/components/AnaliticaEnlaces.astro` | Un solo escucha delegado que deduce el `destino` de `clic_cta` a partir del `href`. Para forzar otro destino: `data-cta="loquesea"`. |
| `src/components/AnaliticaSecciones.astro` | El `IntersectionObserver` de `seccion_vista`. **Se monta solo en el inicio**, porque el armador de pedidos ya usa `data-seccion` para sus acordeones de marca. |
| `.github/workflows/deploy.yml` | Pasa `PUBLIC_GTM_CONTAINER_ID` como variable de entorno al paso de compilación. |

Para añadir un evento nuevo:

```ts
import { registrarEvento } from '../lib/analitica';

registrarEvento('mi_evento', { parametro: 'valor' });
```

El nombre va en `snake_case`, en español y con 40 caracteres como máximo. Si el
valor viene de un campo que escribe la persona, pásalo primero por
`limpiarTermino()`. Y recuerda: un evento nuevo **no llega a GA4 hasta que se le
crea el activador y la etiqueta en Tag Manager** (punto 5.1), y hay que añadirlo
a la tabla del punto 6.

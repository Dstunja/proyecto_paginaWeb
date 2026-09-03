# Estadísticas de la página — guía para la empresa

Esta guía explica cómo poner en marcha las estadísticas de dstunja.com, quién
puede verlas y qué informe mirar para cada pregunta. **No hace falta saber
programar**: todo se hace desde el navegador.

Tiempo aproximado: 25 minutos la primera vez.

---

## 1. Qué se decidió y por qué

La empresa quiere saber cuánta gente entra a la página, cómo se mueve dentro de
ella y qué secciones consulta más. Esa información **no puede ser pública**:
solo la ve una persona autorizada.

La página es un **sitio estático**: son archivos HTML publicados en un servidor,
sin base de datos y sin sistema de usuarios propio. Por eso **no** se creó una
página `/estadisticas` con contraseña: en un sitio estático la contraseña
viajaría dentro del código de la página y cualquiera podría leerla con "ver
código fuente". No protegería nada.

En su lugar se usa **Google Analytics 4 (GA4)**:

- Es gratuito y no necesita servidor.
- Funciona igual hoy en GitHub Pages y mañana en Hostinger.
- El control de acceso lo resuelve la cuenta de Google: la propiedad se crea con
  el Gmail de la empresa y se comparte **solo** con el correo de la persona
  autorizada. Aunque alguien conozca la dirección de la web, no puede ver los
  datos.
- Da exactamente lo que se pidió: usuarios, páginas vistas, recorrido de
  navegación, tiempo en página, origen del tráfico, ciudad y dispositivo, más
  los eventos propios que se programaron para este sitio (ver la tabla del
  punto 7).

---

## 2. Crear la cuenta y la propiedad de GA4

Hazlo con el **Gmail de la empresa**, no con un correo personal: esa cuenta es
la dueña de los datos y es la única que puede dar y quitar accesos.

1. Entra a <https://analytics.google.com> e inicia sesión con el Gmail de la
   empresa.
2. Pulsa **Empezar a medir** (o **Administrar** → **Crear** → **Cuenta**).
3. **Nombre de la cuenta**: `Distribuciones Santiago de Tunja`. Acepta las
   casillas de uso compartido de datos que consideres y continúa.
4. **Nombre de la propiedad**: `dstunja.com`.
   - Zona horaria: `(GMT-05:00) Bogotá`.
   - Moneda: `Peso colombiano (COP)`.
5. Responde las preguntas del sector (**Comercio minorista / Distribución**,
   tamaño de la empresa) y los objetivos: marca **Examinar el comportamiento de
   los usuarios**.
6. En **Empezar a recoger datos** elige **Web**.
   - **URL del sitio web**: `https://dstunja.github.io` mientras se revisa
     internamente; cuando el sitio pase a Hostinger, `https://dstunja.com`.
   - **Nombre del flujo**: `Sitio dstunja`.
7. Deja activada la **Medición mejorada**. Es la que registra sola el
   desplazamiento por la página, los clics a sitios externos, las búsquedas del
   sitio, las descargas y los vídeos. Si quieres revisarla: rueda dentada junto
   a "Medición mejorada" → deja todo marcado.
8. Al terminar verás el **ID de medición**, con la forma `G-XXXXXXXXXX`.
   **Cópialo**: es lo único que hay que llevar al sitio.

---

## 3. Dónde se pone el ID de medición

El ID **no se escribe en el código**. Se guarda como un secreto y solo existe
mientras la página se compila.

### Mientras el sitio está en GitHub Pages

1. Entra al repositorio en GitHub.
2. **Settings** → menú lateral **Secrets and variables** → **Actions**.
3. Botón **New repository secret**.
   - **Name**: `PUBLIC_GA_ID` (exactamente así, en mayúsculas).
   - **Secret**: el `G-XXXXXXXXXX` que copiaste.
4. **Add secret**.
5. Ve a la pestaña **Actions**, abre el flujo *Desplegar en GitHub Pages* y pulsa
   **Run workflow** para volver a publicar. A partir de esa publicación la página
   empieza a medir.

### Cuando el sitio se mude a Hostinger

En el servidor donde se compile el sitio, crea un archivo `.env` junto al
proyecto con esta única línea:

```
PUBLIC_GA_ID=G-XXXXXXXXXX
```

y vuelve a ejecutar `npm run build`. El archivo `.env` **no** se sube al
repositorio (está en `.gitignore`).

### Cómo comprobar que quedó funcionando

1. Abre `https://dstunja.github.io/proyecto_paginaWeb/` en el navegador.
2. Acepta el aviso de cookies que aparece abajo.
3. En Google Analytics entra a **Informes** → **Tiempo real**. Deberías verte a ti
   mismo como usuario activo en menos de un minuto.

Si no aparece nada: revisa que el secreto se llame exactamente `PUBLIC_GA_ID`,
que la publicación haya terminado bien en la pestaña **Actions** y que no tengas
un bloqueador de anuncios activo (bloquean Google Analytics).

> **Importante:** en desarrollo (`npm run dev`) nunca se envía nada, aunque el ID
> esté configurado. Las pruebas de quien programa no ensucian las estadísticas.

---

## 4. Dar acceso a la persona autorizada (y a nadie más)

1. En Google Analytics, abajo a la izquierda, entra a **Administrar**.
2. En la columna **Propiedad**, entra a **Gestión de acceso a la propiedad**.
3. Arriba a la derecha, botón **+** → **Añadir usuarios**.
4. Escribe el **correo** de la persona autorizada (tiene que ser una cuenta de
   Google; si usa un correo de otro proveedor, primero debe crear una cuenta de
   Google con ese correo).
5. Elige el rol:
   - **Lector** — puede ver todos los informes. *Es el recomendado.*
   - **Analista** — además puede crear y guardar exploraciones e informes
     propios. Elige este si la persona va a construir sus propios análisis.
   - **No uses Editor ni Administrador**: dejarían cambiar la configuración de
     medición o dar acceso a otras personas.
6. Desmarca **Notificar por correo electrónico a los nuevos usuarios** solo si
   prefieres avisarle tú.
7. **Añadir**.

**Revisa la lista periódicamente.** En esa misma pantalla se ve quién tiene
acceso; para quitárselo a alguien, márcalo y pulsa el icono de papelera.

**Activa la verificación en dos pasos** en el Gmail de la empresa y pídele a la
persona autorizada que la active en el suyo: es lo que impide que alguien que
adivine la contraseña entre a ver los datos. Se hace en
<https://myaccount.google.com/security> → **Verificación en dos pasos**.

---

## 5. Qué informe mirar para cada pregunta

| Pregunta de negocio | Dónde mirarlo |
|---|---|
| **¿Cuánta gente entra?** | **Informes** → **Adquisición** → **Adquisición de tráfico**. Arriba se ve el total de usuarios; abajo, de dónde llegaron (buscador, redes, enlace directo). También **Informes** → **Ciclo de vida** → **Interacción** → **Páginas y pantallas** para el detalle por página. |
| **¿Cómo navegan dentro de la página?** | **Explorar** → **Exploración de rutas**. Empieza en el punto de partida "page_view / Inicio" y ve abriendo pasos: muestra el camino real que sigue la gente. |
| **¿Qué secciones consultan más?** | **Informes** → **Interacción** → **Eventos** → clic en `seccion_vista`. Dentro, añade el parámetro **seccion** como dimensión secundaria para ver el desglose (`cobertura`, `especiales_mes`, `haz_tu_pedido`…). Ver también el punto 6. |
| **¿De dónde son?** | **Informes** → **Usuario** → **Datos demográficos** → **Detalles demográficos**, y cambia la dimensión principal a **Ciudad**. |
| **¿Con qué entran, celular o computador?** | **Informes** → **Usuario** → **Tecnología** → **Descripción general**. |
| **¿Cuánto tiempo se quedan?** | La métrica **Tiempo de interacción medio** aparece en casi todos los informes de **Interacción**. |
| **¿Qué productos agregan al pedido?** | **Informes** → **Interacción** → **Eventos** → `pedido_agregar`, con el parámetro **marca** o **codigo_sap**. |
| **¿Qué municipios buscan y no cubrimos?** | Evento `cobertura_buscar`, filtrando por el parámetro **encontrado** = `false`. |

### Para que los parámetros aparezcan en los informes

GA4 solo muestra un parámetro personalizado en los informes si antes se registra
como **dimensión**. Se hace una vez:

1. **Administrar** → columna Propiedad → **Definiciones personalizadas**.
2. **Crear dimensiones personalizadas**, y añade una por cada parámetro de la
   tabla del punto 7 que quieras poder desglosar. Los más útiles:
   `seccion`, `destino`, `marca`, `municipio`, `vacante`, `categoria`.
   - **Nombre de la dimensión**: el mismo del parámetro (`seccion`).
   - **Ámbito**: `Evento`.
   - **Parámetro del evento**: el mismo nombre (`seccion`).
3. Los datos empiezan a acumularse desde ese momento; **no se aplica hacia
   atrás**, así que conviene hacerlo el mismo día que se activa la medición.

### Marcar conversiones (eventos clave)

Un "evento clave" es lo que para la empresa cuenta como éxito. Aquí son
`pedido_enviar` y `clic_cta`.

1. **Administrar** → columna Propiedad → **Eventos clave**.
2. Si el evento ya se registró alguna vez, aparece en la lista: activa el
   interruptor **Marcar como evento clave**.
3. Si todavía no aparece (nadie lo ha disparado aún), pulsa **Nuevo evento clave**
   y escribe el nombre exacto: `pedido_enviar`.

A partir de ahí, en los informes de adquisición se ve **de qué canal llegan las
personas que sí terminan enviando un pedido**, que es la pregunta de marketing
que más sirve.

---

## 6. Opcional: un panel en Looker Studio

Si a la persona autorizada le resulta más cómodo un tablero de una sola pantalla
que los informes de GA4:

1. Entra a <https://lookerstudio.google.com> con el Gmail de la empresa.
2. **Crear** → **Informe** → conector **Google Analytics** → elige la cuenta, la
   propiedad `dstunja.com` y **Añadir**.
3. Arrastra los gráficos que quieras: una serie temporal de usuarios, una tabla
   de `seccion_vista` desglosada por `seccion`, un marcador con el total de
   `pedido_enviar`.
4. Botón **Compartir** (arriba a la derecha) → escribe **solo** el correo de la
   persona autorizada → permiso **Puede ver**.
5. **No** actives "Cualquier persona con el enlace": eso haría públicos los datos.

---

## 7. Eventos propios de este sitio

Además de lo que GA4 mide solo (páginas vistas, desplazamiento, clics de salida,
búsquedas del sitio), la página envía estos eventos. Todos están en español y en
`snake_case`, dentro del límite de 40 caracteres de GA4.

| Evento | Cuándo se dispara | Parámetros |
|---|---|---|
| `seccion_vista` | Una sección del inicio se ve en pantalla. Una sola vez por sección y visita. | `seccion`: `hero`, `cifras`, `marcas`, `especiales_mes`, `valor_agregado`, `cobertura`, `para_tu_negocio`, `resenas`, `haz_tu_pedido`, `empleos_pqrs`, `siguenos` |
| `clic_cta` | Clic en un botón o enlace de contacto o de una sección clave. | `destino`: `whatsapp`, `pedido`, `correo`, `telefono`, `pqrs`, `empleos`, `catalogo`, `contactanos`, `innovacion`, `nosotros`, `instagram`, `facebook`, `x`, `pideky` |
| `catalogo_buscar` | La persona deja de escribir en el buscador del armador de pedidos (mínimo 3 letras). | `termino` |
| `catalogo_filtrar_marca` | Se elige una píldora de marca. | `marca` (o `todas`) |
| `catalogo_filtrar_categoria` | Se elige una categoría. | `categoria` (o `todas`) |
| `pedido_agregar` | Se agrega una referencia al pedido. | `codigo_sap`, `marca` |
| `pedido_quitar` | Se quita una referencia del pedido. | `codigo_sap`, `marca` |
| `pedido_enviar` | Se envía el pedido por WhatsApp. **Evento clave.** | `items` (cuántas referencias), `marcas_distintas` |
| `cobertura_buscar` | Se busca un municipio en el mapa del inicio. | `municipio`, `encontrado` (`true` / `false`) |
| `vacante_ver` | Se abre el detalle de una convocatoria. | `vacante` |
| `vacante_postular` | Se pulsa "Postularme". | `vacante` |
| `articulo_leer` | Una novedad de la página Innovación se ve en pantalla. | `articulo` |
| `articulo_completado` | El recorrido de la página Innovación pasa el 90 %. | — |

### Qué NO se envía nunca

- Nombres, correos, teléfonos ni datos del negocio de quien arma un pedido. De un
  pedido enviado solo viaja cuántas referencias y cuántas marcas distintas lleva.
- El contenido de los formularios de contacto, PQRS o empleo: esos abren el
  gestor de correo de la persona y no pasan por la página.
- Búsquedas que parezcan datos personales. Si un término lleva una arroba o
  siete o más dígitos seguidos, se reemplaza por `[omitido]` antes de salir del
  navegador (`limpiarTermino()` en `src/lib/analitica.ts`).

---

## 8. Aviso de cookies y protección de datos

La página muestra abajo una franja con dos botones, **Aceptar** y **Solo lo
necesario**, la primera vez que alguien entra. Es lo que pide la Ley 1581 de 2012
de protección de datos personales.

- Mientras la persona no acepte, GA4 funciona en modo restringido (*Consent
  Mode*): recibe la visita pero **no guarda cookies** ni identifica a la persona
  entre sesiones. Los totales de "usuarios" serán algo menos precisos, pero la
  medición es legal desde el primer momento.
- Al aceptar, la medición pasa a ser completa.
- La decisión se guarda en el propio navegador de la persona y la franja no
  vuelve a aparecer.
- El texto legal está en `https://dstunja.com/privacidad/`. **Ese texto es un
  borrador y debe revisarlo el área jurídica antes de la publicación
  definitiva.**

---

## 9. Para quien mantiene el código

| Archivo | Qué hace |
|---|---|
| `src/components/Analitica.astro` | Carga `gtag.js` en el `<head>`. Solo si hay `PUBLIC_GA_ID` **y** la compilación es de producción. |
| `src/lib/analitica.ts` | `registrarEvento()`, `limpiarTermino()` y el consentimiento. Todo es no-op si `gtag` no existe. |
| `src/components/AvisoCookies.astro` | La franja de cookies. Guarda la decisión en `localStorage` con la clave `dst_consentimiento`. |
| `src/components/AnaliticaEnlaces.astro` | Un solo escucha delegado que deduce el `destino` de `clic_cta` a partir del `href`. Para forzar otro destino: `data-cta="loquesea"`. |
| `src/components/AnaliticaSecciones.astro` | El `IntersectionObserver` de `seccion_vista`. **Se monta solo en el inicio**, porque el armador de pedidos ya usa `data-seccion` para sus acordeones de marca. |
| `.github/workflows/deploy.yml` | Pasa `PUBLIC_GA_ID` como variable de entorno al paso de compilación. |

Para añadir un evento nuevo:

```ts
import { registrarEvento } from '../lib/analitica';

registrarEvento('mi_evento', { parametro: 'valor' });
```

El nombre va en `snake_case`, en español y con 40 caracteres como máximo. Si el
valor viene de un campo que escribe la persona, pásalo primero por
`limpiarTermino()`.

# Archivos de soporte en las PQRS

## Qué hay hoy y qué falta

El sitio es **estático**: Astro compila a HTML y se publica en GitHub Pages (y
mañana en Hostinger). No hay servidor propio, ni base de datos, ni carpeta de
subidas. El formulario de PQRS no envía nada por su cuenta: arma un correo y
abre el gestor de correo de quien lo diligencia (ver
`src/components/FormularioMailto.astro`).

Por eso lo implementado es **solo la mitad de cliente**:

| Parte | Estado |
| --- | --- |
| Campo visible solo para Queja y Reclamo | Hecho |
| Hasta 3 archivos, 5 MB cada uno | Hecho |
| Validación de formato por contenido real (no por extensión) | Hecho, en el navegador |
| Nombre y tamaño en pantalla, con botón de quitar | Hecho |
| Limpieza al cambiar de tipo de solicitud | Hecho |
| Saneado del nombre y rechazo de doble extensión | Hecho |
| Subida al servidor, tabla `pqrs_adjuntos`, descarga protegida | **Falta: no hay backend** |

Un `mailto:` **no puede llevar archivos adjuntos**. No es una limitación de este
código: el esquema `mailto:` no tiene forma de adjuntar nada. Lo que hace el
formulario es listar los nombres de los archivos en el cuerpo del correo y
avisar en pantalla de que hay que arrastrarlos al mensaje antes de enviarlo.

**Esto no sirve como constancia de radicación.** Para PQRS la empresa debe poder
demostrar la fecha de radicación y el soporte recibido, así que la parte de
servidor de este documento hay que construirla antes de que el sitio se
considere terminado.

## Configuración

| Variable | Dónde | Valor por defecto |
| --- | --- | --- |
| `PUBLIC_PQRS_ADJUNTO_MAX_MB` | `.env`, o el panel del hosting | `5` |

Se lee **en tiempo de compilación**, igual que `PUBLIC_GA_ID`. Cambiarla ajusta
a la vez el límite que aplica el navegador y el texto de ayuda que se muestra.
El número de archivos se pasa como propiedad del componente
(`<CampoAdjuntos maxArchivos={3} />`); el valor por defecto está en
`MAX_ARCHIVOS_POR_DEFECTO`.

## Las reglas viven en un solo sitio

`src/lib/adjuntos.ts` no toca el DOM, no usa `import.meta.env` y no depende de
ninguna API exclusiva del navegador: lee los bytes a través de una función
`LectorBytes` que le pasa quien lo llama. **El mismo archivo se puede importar
tal cual desde el servidor** con un lector sobre `fs.read` o sobre el buffer del
multipart, y así las reglas no se escriben dos veces ni se desincronizan.

```js
import { validarArchivo } from '../src/lib/adjuntos.js';

const veredicto = await validarArchivo(
  { nombre: parte.filename, tamano: buffer.length, leer: async (i, f) => buffer.subarray(i, f) },
  { maxMb: Number(process.env.PQRS_ADJUNTO_MAX_MB) || 5 },
);
if (!veredicto.ok) return respuesta400(veredicto.error);
// veredicto.mime, veredicto.extension, veredicto.nombreSeguro
```

La validación del navegador **no cuenta como validación**: se salta con las
DevTools abiertas o mandando la petición a mano. Hay que volver a ejecutar
`validarArchivo` en el servidor, sin excepción.

## Contrato del endpoint que falta

`POST /api/pqrs`, `Content-Type: multipart/form-data`.

Campos, con los mismos `name` que ya usa el formulario:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `tipo-pqrs` | texto | `Petición`, `Queja`, `Reclamo`, `Sugerencia`, `Felicitación` |
| `nombre-pqrs` | texto | obligatorio |
| `documento-pqrs` | texto | opcional |
| `telefono-pqrs` | texto | obligatorio |
| `correo-pqrs` | texto | obligatorio |
| `municipio-pqrs` | texto | obligatorio |
| `descripcion-pqrs` | texto | obligatorio |
| `autorizacion-pqrs` | texto | obligatorio (Ley 1581 de 2012) |
| `soporte-pqrs` | archivo, 0..3 | **solo se procesa si `tipo-pqrs` es Queja o Reclamo** |

Reglas que el servidor debe aplicar:

1. Si `requiereSoporte(tipo)` es falso, **descartar los archivos sin guardarlos**
   aunque vengan en la petición. Que el navegador deshabilite el campo no impide
   que alguien mande el multipart a mano.
2. Rechazar la petición completa si llegan más de 3 archivos.
3. Cortar la lectura al superar el límite de bytes, para que un archivo enorme no
   agote la memoria antes de que se lo rechace.
4. `validarArchivo` sobre cada uno. Si alguno falla, responder `400` con el
   mensaje que devuelve la función (ya está redactado en español y es apto para
   mostrar tal cual).
5. Guardar con **nombre nuevo**: `crypto.randomUUID() + veredicto.extension`.
   Nunca el nombre que mandó el navegador, ni siquiera saneado: el original va
   a la columna `nombre_original` y nada más.

## Almacenamiento

- **Fuera de la raíz pública.** En Hostinger, fuera de `public_html`; en
  Cloudflare, un bucket R2 privado. Si los archivos quedan servidos por URL
  directa, cualquiera con el enlace lee la queja de otra persona.
- **Nunca servirlos como HTML.** Al descargarlos hay que responder siempre
  `Content-Type: application/octet-stream` (o el MIME detectado, jamás el que
  declaró el navegador) junto a `Content-Disposition: attachment; filename="…"`,
  `X-Content-Type-Options: nosniff` y `Content-Security-Policy: default-src 'none'`.
  El caso peligroso es un SVG o un HTML disfrazado: si el navegador lo renderiza
  en el dominio del sitio, ejecuta JavaScript con las cookies del panel.
- **Sin permisos de ejecución** en la carpeta (`chmod 0640` en los archivos, y en
  Apache un `.htaccess` con `php_flag engine off` por si acaso).
- La descarga desde el panel debe pasar por un script que compruebe la sesión
  **antes** de leer el archivo, y que busque por `id` en la base de datos en vez
  de aceptar una ruta por parámetro (si no, `?ruta=../../config.php`).

## Migración

MySQL / MariaDB, que es lo que ofrece Hostinger:

```sql
-- migraciones/001_pqrs.sql
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

Notas de las columnas:

- `nombre_original`: el nombre saneado que devuelve `sanitizarNombre`, no el
  crudo. Aun así hay que escaparlo al pintarlo en el panel.
- `nombre_almacenado`: `UUID + extensión`, de ahí los 80 caracteres. El índice
  único deja constancia si alguna vez se repite.
- `ruta`: relativa a la carpeta base de subidas, nunca absoluta, para que mover
  el almacenamiento no obligue a reescribir filas.
- `mime_type`: el que devolvió `validarArchivo`, no el que declaró el navegador.
- `tamano`: en bytes.

En SQLite o Cloudflare D1 el equivalente es el mismo cambiando
`BIGINT UNSIGNED AUTO_INCREMENT` por `INTEGER PRIMARY KEY AUTOINCREMENT` y
`DATETIME DEFAULT CURRENT_TIMESTAMP` por `TEXT DEFAULT (datetime('now'))`.

## Verificación

```bash
npm run build
npm run verificar:pqrs
```

Levanta `dist/` en un servidor local y recorre el formulario con Chromium en
móvil (375 px) y escritorio (1280 px): archivo válido de cada formato, formato
rechazado, doble extensión, contenido que no corresponde a la extensión, exceso
de peso, tope de tres archivos y el campo ignorado cuando el tipo no es Queja ni
Reclamo. Los archivos de prueba se generan en el directorio temporal del
sistema, así que no ensucian el repositorio.

Cuando exista el endpoint hay que añadir las mismas comprobaciones contra el
servidor: las de este script solo demuestran que el navegador se porta bien.

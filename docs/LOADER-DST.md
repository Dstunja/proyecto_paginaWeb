# Loader DST — la animación de carga con el logotipo

`src/components/LoaderDST.astro` convierte el isotipo de la empresa en un
indicador de espera: la "mesa" del centro respira y las ocho "sillas" de
alrededor se encienden en círculo, una cada 0,18 s, en un ciclo de 1,6 s.

## Cómo se usa

```astro
---
import LoaderDST from '../components/LoaderDST.astro';
---

<LoaderDST texto="Cargando el catálogo…" />
<LoaderDST tamano={56} />
```

| Prop | Por defecto | Para qué |
|---|---|---|
| `tamano` | `96` | Lado del cuadrado, en píxeles. |
| `texto` | — | Rótulo visible debajo. Si se omite, queda un "Cargando…" que solo leen los lectores de pantalla. |
| `class` | — | Clases extra para el contenedor. |

Para tapar un hueco mientras algo carga hay una clase auxiliar en `global.css`:

```astro
<div class="relative">
  <div id="algo"></div>
  <div class="dst-capa-carga" data-mi-capa>
    <LoaderDST texto="Cargando…" />
  </div>
</div>
```

y al terminar, `capa.dataset.fuera = 'true'` la desvanece en 250 ms; se quita
del árbol 10 ms después.

## Decisiones de diseño

**La geometría es la del logotipo real.** Se comparó el SVG recibido con
`public/LOGO-removebg-preview.png`: cuadro redondeado central y ocho satélites,
con los cuatro diagonales girados 45° en forma de rombo. Coincide, así que se
integró tal cual.

**Los colores son los de la marca, no los del archivo original.** El demo venía
con `#2b2f8c` y `#2fa8c8`, que no están en la paleta. Ahora se usan tokens
declarados en `global.css`:

| Token | Valor | Pieza |
|---|---|---|
| `--color-loader-mesa` | `#0D2C84` | El cuadro central. |
| `--color-loader-silla` | `#1E88E5` | Las ocho de alrededor. |
| `--color-loader-acento` | `#F5A623` | Solo la primera del ciclo, para marcar dónde empieza la vuelta. |

Dentro de un bloque `.sobre-oscuro` esos tokens se redefinen (mesa blanca,
sillas `#90CAF9`): sobre el azul oscuro de marca, el azul de marca desaparece.
Por eso el SVG va **en línea** y no como `<img>`: así hereda los tokens.

**Accesibilidad.** El contenedor es `role="status"` con `aria-live="polite"`.
Con `prefers-reduced-motion` el logotipo se muestra quieto y con todas las
piezas a plena opacidad. Esa excepción vive en el propio componente y no en
`global.css`: los estilos con ámbito de Astro le ganan por especificidad a
cualquier regla global, y la regla general de reducción de movimiento habría
dejado las sillas congeladas al 22 % de opacidad, como un logotipo a medio
encender.

## Dónde se usa hoy

| Sitio | Qué se está esperando |
|---|---|
| Mapa de cobertura del inicio (`MapaRed.astro`) | Que Leaflet se descargue, arme los 87 puntos y lleguen las teselas del servidor de mapas. |
| Mapa de la sede en Contáctanos (`MapaCobertura.astro`) | Que responda el iframe de OpenStreetMap. |
| Armador de pedidos (`CatalogoPedido.astro`) | Que el navegador lea las 709 referencias del bloque JSON, las indexe y pinte la primera tanda. |

Las tres son esperas reales: sin el loader, ahí habría un rectángulo vacío.

### El caso del iframe con carga diferida

El mapa de la sede lleva `loading="lazy"`, y saber cuándo está listo tiene dos
trampas:

- `contentDocument.readyState` no sirve: mientras el iframe no se acerca a la
  pantalla contiene un `about:blank` que **ya** dice `"complete"`.
- El evento `load` tampoco basta por sí solo: el navegador lo dispara también
  por ese `about:blank` de relleno, antes de pedir nada a la red.

Con cualquiera de las dos señales la capa desaparecía al instante y se veía un
marco vacío. La solución es esperar al primer `load` **posterior** a que el
iframe se acerque a la pantalla (un `IntersectionObserver` con margen amplio),
más un plazo de seguridad para que la capa nunca se quede pegada si un
bloqueador de contenido impide que el mapa cargue.

## Por qué NO hay pantalla de carga completa (splash)

Se midió antes de decidir, con Playwright sobre el sitio compilado, tres
ejecuciones por escenario:

| Escenario | FCP | LCP | DOMContentLoaded | load |
|---|---|---|---|---|
| Sin límite de red | 232 ms | **265 ms** | 267 ms | 426 ms |
| 4G lenta (1,6 Mbps, 150 ms de latencia) | 2051 ms | **2491 ms** | 3117 ms | 3997 ms |

Con esos números un splash no aporta nada y sí quita:

- **En conexión buena**, la página ya está pintada a los 265 ms. Un splash que
  se retira en `window.load` o a los 800 ms tardaría más que la propia página:
  triplicaría la espera percibida para mostrar una animación que nadie pidió.
- **Además empeoraría el LCP.** Una capa fija a pantalla completa tapa el
  elemento que el navegador mide como "contenido principal"; el LCP pasaría a
  contarse cuando la capa se retira, no cuando la página se pinta.
- **En conexión lenta tampoco ayuda.** El splash se retira a los 800 ms como
  máximo, y a esa altura la página todavía no ha pintado (FCP 2051 ms): la
  persona vería el logotipo un instante y volvería a la misma pantalla en
  blanco. El hueco que hay que llenar está *después* del splash, no antes.

Donde el loader sí gana es en las esperas puntuales del cuadro de arriba, que
son las que de verdad dejan un hueco visible.

Si en el futuro se quiere reconsiderar, la condición para que valga la pena
sería que el LCP del inicio subiera bastante por encima de los 800 ms de forma
sostenida; y aun entonces habría que volver a medir el LCP antes y después.

## Reproducir las medidas

```
npm run build
```

y medir con Playwright leyendo `largest-contentful-paint` de la
`PerformanceObserver` sobre `dist/` servido en local, con y sin limitación de
red. Las cifras de la tabla son la media de tres ejecuciones en un portátil,
así que sirven para comparar entre sí, no como valor absoluto de producción.

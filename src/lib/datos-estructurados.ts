/**
 * Datos estructurados (schema.org, JSON-LD) del sitio.
 *
 * Es lo que leen Google y los demás buscadores para mostrar la ficha de la
 * empresa (dirección, horario, teléfono, logo), las migas de cada página en
 * los resultados y, en las vacantes, la tarjeta de Google Empleos (eso vive en
 * src/lib/empleos/job-posting.ts).
 *
 * Todo aquí es puro: recibe la URL del sitio (`Astro.site`) y devuelve objetos.
 * Los .astro los pintan con `jsonLd()`, que escapa `<` para que ningún texto
 * pueda cerrar la etiqueta <script>.
 */
import { ANIO_FUNDACION, SEDE, empresa, horario, redes } from '../data/site';

/** URL absoluta dentro del sitio. `rutaInterna` ya trae el `base` si lo hay. */
const absoluta = (rutaInterna: string, sitio: string | URL) => new URL(rutaInterna, sitio).href;

/** Teléfono en formato internacional legible: "+57 310 623 2429". */
export const TELEFONO_INTERNACIONAL = `+57 ${empresa.telefono}`;

/** Dirección postal de la sede. La comparten la empresa y las vacantes de Tunja. */
export function direccionSede() {
  return {
    '@type': 'PostalAddress',
    streetAddress: empresa.direccion.replace(/‑/g, '-'),
    addressLocality: empresa.ciudad,
    addressRegion: empresa.departamento,
    addressCountry: empresa.pais,
  } as const;
}

/**
 * La empresa como `LocalBusiness` (que también es una `Organization`): nombre,
 * NIT, fundación, dirección, coordenadas, horario, teléfono, logo y perfiles.
 *
 * @param sitio  `Astro.site`
 * @param base   `import.meta.env.BASE_URL` (para las rutas de public/)
 */
export function organizacion(sitio: string | URL, base = '/') {
  const publico = (archivo: string) => absoluta(`${base.replace(/\/?$/, '/')}${archivo}`, sitio);
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${absoluta(base, sitio)}#empresa`,
    name: empresa.razonSocial,
    alternateName: [empresa.nombre, empresa.sigla],
    legalName: empresa.razonSocial,
    description: empresa.descripcion,
    url: absoluta(base, sitio),
    logo: publico('logo-distribuciones.png'),
    image: publico('og.png'),
    telephone: TELEFONO_INTERNACIONAL,
    email: empresa.email,
    taxID: empresa.nit,
    foundingDate: String(ANIO_FUNDACION),
    address: direccionSede(),
    geo: { '@type': 'GeoCoordinates', latitude: SEDE.lat, longitude: SEDE.lng },
    hasMap: empresa.mapsUrl,
    openingHoursSpecification: horario
      .filter((h) => h.dias && h.abre && h.cierra)
      .map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [...(h.dias ?? [])],
        opens: h.abre,
        closes: h.cierra,
      })),
    areaServed: ['Boyacá', 'Santander', 'Cundinamarca'].map((name) => ({ '@type': 'State', name })),
    sameAs: redes.map((r) => r.url),
  };
}

export interface Miga {
  nombre: string;
  /** Ruta interna con el `base` ya puesto (lo que devuelve `ruta()`). */
  ruta: string;
}

/** `BreadcrumbList` a partir de las migas, en orden, empezando por Inicio. */
export function listaMigas(migas: readonly Miga[], sitio: string | URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.nombre,
      item: absoluta(m.ruta, sitio),
    })),
  };
}

/** JSON listo para `<script type="application/ld+json" set:html={...}>`. */
export function jsonLd(datos: unknown): string {
  return JSON.stringify(datos).replace(/</g, '\\u003c');
}

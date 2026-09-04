/**
 * Plantillas del catálogo del armador de pedidos, como texto HTML.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 * ---------------------------
 * La primera pantalla del catálogo se imprime en el HTML durante el build, para
 * que quien abre /pedido/ vea productos de inmediato -y los siga viendo aunque
 * el JavaScript falle o esté desactivado-. A partir de ahí, cada filtro,
 * búsqueda o "Ver más" vuelve a pintar la lista en el navegador.
 *
 * Son dos momentos distintos pintando exactamente la misma grilla, así que las
 * plantillas viven aquí una sola vez y las usan los dos: el frontmatter de
 * CatalogoPedido.astro (build) y su `<script>` (navegador). Si estuvieran
 * duplicadas, cualquier retoque de la tarjeta habría que hacerlo dos veces y la
 * grilla daría un salto visible en cuanto el visitante tocara un filtro.
 *
 * Por lo mismo aquí no se usa `document` ni ninguna API del navegador: son
 * funciones puras que devuelven cadenas y que tienen que dar exactamente el
 * mismo resultado en Node y en el navegador (ver `pesos`).
 */

import type { ProductoPedido } from './carrito';
import { CANTIDAD_MAXIMA, TAMANO_TANDA } from '../data/pedido';

/**
 * Lo que la vista necesita saber del estado para pintarse.
 *
 * En el build todas estas respuestas son fijas (no hay pedido guardado, ninguna
 * tanda ampliada, solo la primera marca abierta); en el navegador salen del
 * estado vivo. La vista no distingue un caso del otro.
 */
export interface EstadoCatalogo {
  /** Logotipo de cada marca, si está subido a public/img/marcas/. */
  logos: Record<string, string | null>;
  /** Unidades que esa referencia ya tiene en el pedido guardado. */
  enPedido: (id: string) => number;
  /** Cantidad escrita en el campo de la tarjeta, todavía sin agregar. */
  cantidad: (id: string) => number;
  /** Cuántas tarjetas se muestran en esa lista (clave: marca, o '' si es plana). */
  visibles: (clave: string) => number;
  /** Si la sección de esa marca está desplegada. */
  abierta: (marca: string) => boolean;
  /**
   * Cuántas tarjetas del principio se cargan sin `loading="lazy"`.
   *
   * Solo lo usa el build: son las que caen sobre la línea de flotación, y por
   * tanto entre ellas está la imagen que mide el LCP. Pedirlas en diferido
   * retrasaría justamente esa. En el navegador ya no hace falta, porque para
   * entonces cualquier repintado ocurre con la página a la vista.
   */
  ansiosas?: number;
}

export const escapar = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/** Dos iniciales de la marca, para el marcador cuando no hay logotipo. */
export const iniciales = (marca: string) =>
  marca
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();

export const unidades = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;

/**
 * Precio en pesos, sin decimales y con punto de miles: $22.000.
 *
 * Se arma a mano y no con `Intl.NumberFormat` a propósito: la misma cifra la
 * pinta Node durante el build y el navegador al filtrar, y para COP en es-CO no
 * coinciden -Node mete un espacio duro entre el signo y el número y los
 * navegadores no-. Esa diferencia haría que la tarjeta cambiara sola al primer
 * clic en un filtro. El separador de miles del español de Colombia es el punto.
 */
export const pesos = (n: number) =>
  '$' +
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Marcas en el orden en que aparecen en el catálogo, con sus productos. */
export function agruparPorMarca(catalogo: ProductoPedido[]): Map<string, ProductoPedido[]> {
  const porMarca = new Map<string, ProductoPedido[]>();
  for (const p of catalogo) {
    const lista = porMarca.get(p.marca);
    if (lista) lista.push(p);
    else porMarca.set(p.marca, [p]);
  }
  return porMarca;
}

export function tarjeta(p: ProductoPedido, estado: EstadoCatalogo, ansiosa = false): string {
  const logo = estado.logos[p.marca];
  const enPedido = estado.enPedido(p.id);
  const cantidad = estado.cantidad(p.id);
  const nombre = escapar(`${p.nombre} ${p.presentacion}`);
  const carga = ansiosa ? '' : ' loading="lazy"';

  /*
   * EL CUADRO DE 80x80: TRES CASOS
   * ------------------------------
   *  1. La referencia tiene FOTO REAL propia (`p.imagen`).
   *  2. No tiene foto, pero su marca tiene LOGOTIPO. ← la mayoría hoy
   *  3. No hay ni lo uno ni lo otro: quedan las INICIALES de la marca.
   *
   * En los tres se usa object-contain y nunca object-cover: recortar
   * mutilaría un logotipo, y en una foto de producto se comería parte del
   * empaque, que es justo lo que el cliente necesita reconocer para pedir.
   *
   * La foto real lleva además el mismo tratamiento que en "Especiales del
   * mes": encima de una copia desenfocada de ella misma. Las fotos vienen
   * en cualquier proporción (frascos altos, cajas apaisadas) y el hueco
   * que deja el contain se rellena con el color de la propia imagen en vez
   * de una franja blanca. Así una referencia con foto y otra con logotipo,
   * lado a lado en la misma marca, se leen como la misma tarjeta. El
   * desenfoque va más corto que en el inicio (blur-md, no blur-xl) porque
   * aquí el cuadro mide 80 px y no 300: con el radio grande el fondo se
   * volvía un color plano.
   *
   * El logotipo, en cambio, se deja sobre blanco y sin padding: los
   * archivos de marca ya traen fondo blanco y su propio margen interno, y
   * agregarle más lo dejaba flotando en medio de un marco vacío.
   */
  const foto = p.imagen;
  const medio = foto
    ? `<div class="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-md" style="background-image:url('${escapar(foto)}')" aria-hidden="true"></div>
           <img src="${escapar(foto)}" alt=""${carga} class="relative h-full w-full object-contain p-1" />`
    : logo
      ? `<img src="${escapar(logo)}" alt=""${carga} class="h-full w-full object-contain" />`
      : `<span class="font-display text-lg font-bold text-primary/60" aria-hidden="true">${escapar(iniciales(p.marca))}</span>`;

  const fondoCuadro = foto
    ? 'border-line bg-surface-2'
    : logo
      ? 'border-line bg-white'
      : 'border-transparent bg-primary-soft';

  /*
   * EL PRECIO: solo aparece si la referencia lo tiene
   * -------------------------------------------------
   * Es el PSP (precio sugerido al público) del deck. La mayoría de las
   * referencias todavía no lo tiene y su tarjeta se pinta igual que antes,
   * sin renglón de precio: es preferible eso a un "consultar" repetido 600
   * veces, que solo agregaría ruido a la grilla.
   *
   * Va rotulado como SUGERIDO a propósito. Es lo que la tienda le cobra al
   * consumidor, no lo que la tienda le paga al asesor, y sin el rótulo la
   * cifra se leería como el precio del pedido. El aviso de que el asesor
   * confirma precios y disponibilidad sigue estando en el panel del pedido
   * y en el mensaje de WhatsApp (AVISO_PRECIOS).
   */
  const precio =
    typeof p.precio === 'number'
      ? `<p class="m-0 mt-1 font-display text-[15px] font-bold text-primary">${escapar(pesos(p.precio))}<span class="ml-1.5 font-sans text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">sugerido</span></p>`
      : '';

  return `
        <article class="glass-card flex gap-4 p-4 ${enPedido ? '!border-secondary/60' : ''}" data-tarjeta="${escapar(p.id)}">
          <div class="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border ${fondoCuadro}">
            ${medio}
          </div>

          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="min-w-0">
              <p class="m-0 font-display text-[11px] font-semibold tracking-[0.1em] text-secondary-dark uppercase">${escapar(p.marca)}</p>
              <h3 class="m-0 text-[15px] leading-snug">${escapar(p.nombre)}</h3>
              <p class="m-0 text-[13px] text-muted">${escapar(p.presentacion)}</p>
              ${precio}
            </div>

            <div class="mt-auto flex flex-wrap items-center gap-2" data-controles>
              <div class="flex items-center overflow-hidden rounded-full border border-line bg-surface">
                <button type="button" class="paso" data-paso="-1" data-foco="menos:${escapar(p.id)}"
                        aria-label="Quitar una unidad de ${nombre}" ${cantidad <= 1 ? 'disabled' : ''}>
                  <span aria-hidden="true" class="text-lg leading-none">&minus;</span>
                </button>
                <input type="number" class="campo-cantidad" value="${cantidad}" min="1" step="1"
                       max="${CANTIDAD_MAXIMA}" inputmode="numeric" data-cantidad data-foco="campo:${escapar(p.id)}"
                       aria-label="Cantidad de unidades de ${nombre}" />
                <button type="button" class="paso" data-paso="1" data-foco="mas:${escapar(p.id)}"
                        aria-label="Agregar una unidad de ${nombre}" ${cantidad >= CANTIDAD_MAXIMA ? 'disabled' : ''}>
                  <span aria-hidden="true" class="text-lg leading-none">+</span>
                </button>
              </div>

              <button type="button" class="btn btn-primary !px-5 !py-2 !text-[13px]"
                      data-agregar data-foco="agregar:${escapar(p.id)}">Agregar</button>
            </div>

            <p class="m-0 text-[12.5px] font-semibold text-ok ${enPedido ? '' : 'hidden'}" data-en-pedido>
              En tu pedido: ${unidades(enPedido)}
            </p>
          </div>
        </article>`;
}

/** Grilla + botón "Ver más" de una lista. `clave` identifica su tanda. */
export function grilla(lista: ProductoPedido[], clave: string, estado: EstadoCatalogo): string {
  const visibles = Math.min(estado.visibles(clave), lista.length);
  const ansiosas = estado.ansiosas ?? 0;
  const tarjetas = lista
    .slice(0, visibles)
    .map((p, i) => tarjeta(p, estado, i < ansiosas))
    .join('');
  const restantes = lista.length - visibles;
  const mas =
    restantes > 0
      ? `<div class="mt-6 flex justify-center" data-mas-caja>
               <button type="button" class="btn btn-secondary" data-mas="${escapar(clave)}" data-foco="mas-lista:${escapar(clave)}">
                 Ver ${Math.min(restantes, TAMANO_TANDA)} más
                 <span class="text-muted">(faltan ${restantes})</span>
               </button>
             </div>`
      : '';

  return `<div class="grid grid-cols-1 gap-4 tablet:grid-cols-2 nav:grid-cols-3">${tarjetas}</div>${mas}`;
}

export function seccionMarca(
  marca: string,
  lista: ProductoPedido[],
  estado: EstadoCatalogo,
): string {
  const abierta = estado.abierta(marca);
  const idCuerpo = `seccion-${marca.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
  const logo = estado.logos[marca];

  const emblema = logo
    ? `<img src="${escapar(logo)}" alt="" class="h-8 w-auto max-w-[92px] object-contain" />`
    : `<span class="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft font-display text-[13px] font-bold text-primary" aria-hidden="true">${escapar(iniciales(marca))}</span>`;

  return `
        <section class="mb-4">
          <h2 class="m-0">
            <button type="button" class="glass-card flex w-full items-center gap-4 p-4 text-left"
                    aria-expanded="${abierta}" aria-controls="${idCuerpo}"
                    data-seccion="${escapar(marca)}" data-foco="seccion:${escapar(marca)}">
              ${emblema}
              <span class="flex-1 font-display text-[17px] font-semibold text-primary">${escapar(marca)}</span>
              <span class="text-[13px] text-muted">${lista.length} ${lista.length === 1 ? 'referencia' : 'referencias'}</span>
              <span class="text-primary transition-transform duration-300 ${abierta ? 'rotate-180' : ''}" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="m6 9 6 6 6-6"/></svg>
              </span>
            </button>
          </h2>
          <div id="${idCuerpo}" class="pt-4" ${abierta ? '' : 'hidden'}>
            ${abierta ? grilla(lista, marca, estado) : ''}
          </div>
        </section>`;
}

/** La vista sin filtros: el catálogo recorrido marca por marca. */
export function vistaPorMarcas(
  porMarca: Map<string, ProductoPedido[]>,
  estado: EstadoCatalogo,
): string {
  return [...porMarca].map(([marca, lista]) => seccionMarca(marca, lista, estado)).join('');
}

/** El renglón de conteo cuando no hay ningún filtro puesto. */
export const conteoSinFiltro = (referencias: number, marcas: number) =>
  `${referencias} referencias en ${marcas} marcas. Abre una marca para ver sus productos.`;

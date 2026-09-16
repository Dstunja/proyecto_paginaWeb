/**
 * Tercer paso: de las filas validadas a las estructuras que ya usa el sitio.
 *
 * Produce lo mismo que hoy exportan src/data/productos.ts, especiales.ts y
 * vacantes.ts, para que los componentes no distingan de dónde vienen los
 * datos. Aquí se aplican las reglas de vigencia: lo que no se publica no sale
 * de esta función, y los conteos de lo oculto van en `resumen` para el log.
 *
 * EL `id` DEL PRODUCTO
 * --------------------
 * Antes salía del nombre y la presentación, y cambiaba con cualquier tilde
 * corregida. Ahora es el CÓDIGO SAP, que es estable. Las dos parejas que
 * comparten código llevan además el nombre en slug (1080263-monticello-
 * spaghetti-integral), que es lo único que las distingue. El carrito guardado
 * en el navegador usa este id: al cambiar de esquema, los pedidos antiguos
 * pierden sus productos una sola vez (src/lib/carrito.ts los descarta sin
 * error).
 *
 * IMÁGENES
 * --------
 * `imagen` se deja tal cual viene de la columna Imagen (o el código si está
 * vacía): quién la resuelve a un archivo real es imagenes.ts, que descarga la
 * carpeta de Drive. Aquí no se toca el disco.
 */
import type { Producto } from '../../data/productos.ts';
import type { ProductoEspecial } from '../../data/especiales.ts';
import type { Vacante } from '../../data/vacantes.ts';
import { slug } from './texto.ts';
import type { FechaISO, Listas, OfertaHoja, ProductoHoja } from './tipos.ts';
import { ofertaPublicable, periodoDe, productoPublicable } from './vigencia.ts';

/** Una vacante del sitio más los campos que solo existen en la hoja. */
export interface VacanteHoja extends Vacante {
  /** Área de la empresa. Solo se muestra en el detalle si está llena. */
  area?: string;
  /** Salario, tal como se escribió. Solo se muestra en el detalle si está lleno. */
  salario?: string;
}

export interface Catalogo {
  productos: Producto[];
  /** Marcas y categorías en el orden de la pestaña Listas, solo las que tienen productos. */
  marcas: string[];
  categorias: string[];
  /** Subcategorías por categoría, en el orden de Listas, solo las usadas. */
  subcategorias: Record<string, string[]>;
  especiales: ProductoEspecial[];
  periodoEspeciales: string;
  resumen: { publicables: number; inactivos: number; vencidos: number; especiales: number };
}

export interface Empleos {
  vacantes: VacanteHoja[];
  resumen: { publicables: number; inactivas: number; cerradas: number; futuras: number };
}

export function mapearCatalogo(productos: ProductoHoja[], listas: Listas, hoy: FechaISO): Catalogo {
  const resumen = { publicables: 0, inactivos: 0, vencidos: 0, especiales: 0 };
  const publicables: ProductoHoja[] = [];
  for (const p of productos) {
    if (!p.activo) resumen.inactivos++;
    else if (!productoPublicable(p, hoy)) resumen.vencidos++;
    else publicables.push(p);
  }
  resumen.publicables = publicables.length;

  const ids = idsDeProductos(publicables);
  const salida: Producto[] = publicables.map((p) => ({
    id: ids.get(p) as string,
    marca: p.marca,
    categoria: p.categoria,
    ...(p.subcategoria ? { subcategoria: p.subcategoria } : {}),
    nombre: p.nombre,
    presentacion: p.presentacion,
    codigo: p.codigo,
    codigoParcial: false,
    ...(p.precio !== null ? { precio: p.precio } : {}),
    // Notas internas del maestro del deck; la hoja no las tiene.
    embalaje: '',
    paginaPdf: 0,
    imagen: p.imagen || p.codigo,
  }));

  const usadas = (valores: string[], lista: string[]) => lista.filter((v) => valores.includes(v));
  const marcas = usadas(salida.map((p) => p.marca), listas.marcas);
  const categorias = usadas(salida.map((p) => p.categoria), listas.categorias);
  const subcategorias: Record<string, string[]> = {};
  for (const c of categorias) {
    const deLaCategoria = salida.filter((p) => p.categoria === c).map((p) => p.subcategoria ?? '');
    subcategorias[c] = usadas(deLaCategoria, listas.subcategorias);
  }

  const especiales: ProductoEspecial[] = publicables
    .filter((p) => p.etiquetaEspecial !== null)
    .map((p) => ({
      nombre: p.nombre,
      marca: p.marca,
      descripcion: p.descripcion,
      imagen: p.imagen || p.codigo,
      ...(p.etiquetaEspecial ? { etiqueta: p.etiquetaEspecial } : {}),
      codigo: p.codigo,
    }));
  resumen.especiales = especiales.length;

  return { productos: salida, marcas, categorias, subcategorias, especiales, periodoEspeciales: periodoDe(hoy), resumen };
}

/** El código SAP como id; con el nombre detrás solo cuando el código se comparte. */
function idsDeProductos(productos: ProductoHoja[]): Map<ProductoHoja, string> {
  const veces = new Map<string, number>();
  for (const p of productos) veces.set(p.codigo, (veces.get(p.codigo) ?? 0) + 1);
  const ids = new Map<ProductoHoja, string>();
  for (const p of productos) {
    ids.set(p, (veces.get(p.codigo) ?? 0) > 1 ? `${p.codigo}-${slug(p.nombre)}` : p.codigo);
  }
  return ids;
}

export function mapearEmpleos(ofertas: OfertaHoja[], hoy: FechaISO): Empleos {
  const resumen = { publicables: 0, inactivas: 0, cerradas: 0, futuras: 0 };
  const vacantes: VacanteHoja[] = [];
  for (const o of ofertas) {
    if (!o.activa) resumen.inactivas++;
    else if (!ofertaPublicable(o, hoy)) {
      if (o.cierraEl && o.cierraEl < hoy) resumen.cerradas++;
      else resumen.futuras++;
    } else {
      vacantes.push({
        slug: o.id,
        cargo: o.cargo,
        ciudad: o.ciudad,
        tipo: o.tipoContrato,
        // La tarjeta del listado enseña el primer párrafo.
        resumen: o.descripcion[0] ?? '',
        imagen: o.imagen || o.id,
        descripcion: o.descripcion,
        requisitos: o.requisitos,
        ...(o.ofrecemos.length ? { ofrecemos: o.ofrecemos } : {}),
        ...(o.whatsappExtra ? { whatsappExtra: o.whatsappExtra } : {}),
        ...(o.area ? { area: o.area } : {}),
        ...(o.salario ? { salario: o.salario } : {}),
      });
    }
  }
  resumen.publicables = vacantes.length;
  return { vacantes, resumen };
}

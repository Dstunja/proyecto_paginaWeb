/**
 * Vista pública de las vacantes, para el JSON de /api/empleos/vacantes.json.
 *
 * El módulo Talento de Control360 lee ese JSON para darle a RRHH una sugerencia
 * con IA: si el candidato encaja en el cargo al que se postuló o en otra vacante
 * abierta. La única fuente de verdad de las vacantes es este sitio
 * (src/data/vacantes.ts); Control360 no guarda una copia propia.
 *
 * Aquí solo se ELIGEN campos, no se inventan ni se transforman: todo lo que sale
 * ya se ve en /empleos/. Quedan fuera la imagen del flyer, lo que ofrece la
 * empresa, las habilidades deseables y los WhatsApp extra: no hacen falta para
 * comparar un perfil con un cargo, y cuanto menos se publique, menos hay que
 * mantener estable. La lista es cerrada a propósito (`CAMPOS_PUBLICOS`): un
 * campo nuevo en `Vacante` no se cuela en el JSON sin decidirlo aquí.
 *
 * La convocatoria de vehículos ("Buscamos Vehículos") no es un cargo, pero va
 * igual, con sus mismos campos: el `tipo` ("Convocatoria abierta") ya lo dice y
 * Control360 decide qué hacer con ella.
 */
import type { Vacante } from '../../data/vacantes';

/** Versión del formato. Sube solo si cambia la forma, no las vacantes. */
export const VERSION_VACANTES_PUBLICAS = 1;

/** Los únicos campos que salen, en este orden. */
export const CAMPOS_PUBLICOS = [
  'slug',
  'cargo',
  'ciudad',
  'tipo',
  'resumen',
  'descripcion',
  'requisitos',
  'funciones',
] as const;

export interface VacantePublica {
  slug: string;
  cargo: string;
  ciudad: string;
  tipo: string;
  resumen: string;
  descripcion: string[];
  requisitos: string[];
  /** Siempre arreglo: vacío si la vacante no tiene funciones escritas. */
  funciones: string[];
}

export interface VacantesPublicas {
  version: typeof VERSION_VACANTES_PUBLICAS;
  vacantes: VacantePublica[];
}

/** Deja solo los campos públicos de una vacante. */
export function vacantePublica(v: Vacante): VacantePublica {
  return {
    slug: v.slug,
    cargo: v.cargo,
    ciudad: v.ciudad,
    tipo: v.tipo,
    resumen: v.resumen,
    descripcion: [...v.descripcion],
    requisitos: [...v.requisitos],
    funciones: v.funciones ? [...v.funciones] : [],
  };
}

/** El cuerpo completo del JSON, con las vacantes en el mismo orden de la fuente. */
export function vacantesPublicas(lista: readonly Vacante[]): VacantesPublicas {
  return { version: VERSION_VACANTES_PUBLICAS, vacantes: lista.map(vacantePublica) };
}

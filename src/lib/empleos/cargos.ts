/**
 * Cargos a los que se puede postular alguien desde /empleos/.
 *
 * Son las vacantes abiertas de src/data/vacantes.ts más una opción abierta
 * para quien deja la hoja de vida sin que haya convocatoria. El `<select>` del
 * formulario y la validación del servidor leen la MISMA lista: así un cargo
 * que se cierre desaparece de los dos sitios a la vez, y nadie puede postularse
 * a uno inventado mandando el multipart a mano.
 *
 * No toca el entorno ni el DOM.
 */
import { vacantes } from '../../data/vacantes';

/** Opción para quien no se postula a una vacante concreta. */
export const CARGO_ESPONTANEO = 'Otro / hoja de vida espontánea';

/** Todos los cargos admitidos, en el orden en que salen en el formulario. */
export function cargosAdmitidos(): string[] {
  return [...vacantes.map((v) => v.cargo), CARGO_ESPONTANEO];
}

export function esCargoValido(cargo: string): boolean {
  return cargosAdmitidos().includes(cargo);
}

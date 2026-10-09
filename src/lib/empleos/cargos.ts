/**
 * Cargos a los que se puede postular alguien desde /empleos/.
 *
 * Son las vacantes abiertas —las de Control360 si se pudieron leer, las de
 * src/data/vacantes.ts si no (ver vacantes-fuente.ts)— más una opción abierta
 * para quien deja la hoja de vida sin que haya convocatoria. El `<select>` del
 * formulario y la validación del servidor leen la MISMA lista: así un cargo
 * que se cierre desaparece de los dos sitios a la vez, y nadie puede postularse
 * a uno inventado mandando el multipart a mano.
 *
 * `cargosDe` es pura; `cargosAdmitidos` y `esCargoValido` resuelven la lista
 * (una vez por proceso) y por eso son asíncronas.
 */
import { vacantes as vacantesEstaticas, type Vacante } from '../../data/vacantes';
import { cargarVacantes } from './vacantes-fuente';

/** Opción para quien no se postula a una vacante concreta. */
export const CARGO_ESPONTANEO = 'Otro / hoja de vida espontánea';

/** Los cargos de una lista de vacantes, en su orden, más la espontánea. */
export function cargosDe(lista: readonly Vacante[]): string[] {
  return [...lista.map((v) => v.cargo), CARGO_ESPONTANEO];
}

/** Todos los cargos admitidos, en el orden en que salen en el formulario. */
export async function cargosAdmitidos(): Promise<string[]> {
  return cargosDe((await cargarVacantes()).vacantes);
}

/**
 * Si el cargo es uno de los admitidos. Acepta también los de la lista estática:
 * el formulario se compiló con una lista y la función de postular puede haber
 * arrancado con otra (Control360 cambió entre el build y la postulación); un
 * cargo que fue vacante real no debe rechazar a nadie.
 */
export async function esCargoValido(cargo: string): Promise<boolean> {
  return (await cargosAdmitidos()).includes(cargo) || cargosDe(vacantesEstaticas).includes(cargo);
}

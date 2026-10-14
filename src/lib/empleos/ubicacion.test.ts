// PRUEBAS DE UBICACIÓN — la misma regla que src/features/talento/postulaciones/ubicacion.ts de Control360.
//
// Por qué existe: si aquí no se pregunta el traslado y allá sí, Control360 rechaza la postulación
//   por falta de una obligatoria. Por eso los resultados tienen que coincidir con los de allá.
// Dónde corre: vitest (npm test), sin red.

import { describe, expect, it } from 'vitest';
import {
  ID_TRASLADO,
  ciudadDeSede,
  esMismaSede,
  limpiarMunicipio,
  pideTraslado,
  preguntaTraslado,
  preguntasConTraslado,
} from './ubicacion';

describe('limpiarMunicipio', () => {
  it('limpia espacios y comas y pone la mayúscula inicial', () => {
    expect(limpiarMunicipio('  san  josé de pare ,boyacá ')).toBe('San josé de pare, boyacá');
    expect(limpiarMunicipio('tunja')).toBe('Tunja');
  });
  it('lo corto, lo largo o sin letras no sirve', () => {
    expect(limpiarMunicipio('')).toBeNull();
    expect(limpiarMunicipio('ab')).toBeNull();
    expect(limpiarMunicipio('12345')).toBeNull();
    expect(limpiarMunicipio('x'.repeat(81))).toBeNull();
  });
});

describe('sede y traslado', () => {
  it('la ciudad de la sede va sin departamento ni «y alrededores»', () => {
    expect(ciudadDeSede('Tunja, Boyacá')).toBe('Tunja');
    expect(ciudadDeSede('Tunja y alrededores')).toBe('Tunja');
    expect(ciudadDeSede('Barbosa (Santander)')).toBe('Barbosa');
  });
  it('compara sin tildes ni mayúsculas', () => {
    expect(esMismaSede('TUNJA', 'Tunja, Boyacá')).toBe(true);
    expect(esMismaSede('Chiquinquirá', 'chiquinquira')).toBe(true);
    expect(esMismaSede('Tunja Boyacá', 'Tunja')).toBe(true);
    expect(esMismaSede('Paipa', 'Tunja, Boyacá')).toBe(false);
  });
  it('sin municipio o sin sede no pregunta', () => {
    expect(pideTraslado('', 'Tunja')).toBe(false);
    expect(pideTraslado('Paipa', '')).toBe(false);
    expect(pideTraslado('Paipa', 'Tunja')).toBe(true);
  });
  it('la pregunta es Sí/No, obligatoria y con el id de Control360', () => {
    expect(preguntaTraslado('Tunja, Boyacá')).toEqual({
      id: 'c360-traslado',
      texto: '¿Puedes vivir o trabajar en Tunja?',
      tipo: 'SI_NO',
      obligatoria: true,
    });
  });
  it('se agrega al final, una sola vez, y se quita si ya no hace falta', () => {
    const otra = { id: 'moto', texto: '¿Moto?', tipo: 'SI_NO' as const, obligatoria: true };
    expect(preguntasConTraslado([otra], 'Paipa', 'Tunja').map((p) => p.id)).toEqual(['moto', ID_TRASLADO]);
    expect(preguntasConTraslado([otra, preguntaTraslado('Tunja')], 'Tunja', 'Tunja').map((p) => p.id)).toEqual([
      'moto',
    ]);
    expect(preguntasConTraslado([], 'Paipa', null)).toEqual([]);
  });
});

// PRUEBAS DE LAS PREGUNTAS DE FILTRO — lectura del JSON de Control360 y validación en el servidor.
//
// Por qué existe: si una pregunta rara tumba el build, o si una obligatoria se puede saltar
//   mandando el multipart a mano, Talento Humano recibe postulaciones a medias sin enterarse.
// Dónde corre: vitest (npm test), sin red.

import { describe, expect, it } from 'vitest';
import {
  leerPreguntas,
  nombreCampo,
  preguntasDelCargo,
  validarRespuestas,
  type PreguntaVacante,
} from './preguntas';

const PREGUNTAS: PreguntaVacante[] = [
  { id: 'moto', texto: '¿Tienes moto propia?', tipo: 'SI_NO', obligatoria: true },
  { id: 'exp', texto: '¿Cuántos años de experiencia tienes en ventas TAT?', tipo: 'NUMERO', obligatoria: true },
  { id: 'ciudad', texto: '¿En qué ciudad vives?', tipo: 'OPCION', opciones: ['Tunja', 'Duitama', 'Otra'], obligatoria: true },
  { id: 'antes', texto: '¿En qué empresa trabajaste antes?', tipo: 'TEXTO', obligatoria: false },
];

const lector = (valores: Record<string, string>) => (nombre: string) => valores[nombre] ?? '';

describe('leerPreguntas', () => {
  it('lee lo que manda Control360 y descarta lo raro sin lanzar', () => {
    const r = leerPreguntas([
      { id: 'MOTO', texto: '  ¿Tienes  moto? ', tipo: 'SI_NO', obligatoria: true, regla: { descarta_si: 'NO' } },
      { id: 'ciudad', texto: '¿Dónde vives?', tipo: 'OPCION', opciones: ['Tunja', '', 'Duitama'], obligatoria: 'si' },
      { id: 'sola', texto: '¿Opción sin opciones?', tipo: 'OPCION', opciones: ['Una'] },
      { id: 'Con Espacio', texto: 'x', tipo: 'TEXTO' },
      { id: 'tipo', texto: 'Tipo raro', tipo: 'RADIO' },
      { id: 'moto', texto: 'Repetida', tipo: 'SI_NO' },
      'basura',
      null,
    ]);
    expect(r.map((p) => p.id)).toEqual(['moto', 'ciudad']);
    expect(r[0]).toEqual({ id: 'moto', texto: '¿Tienes moto?', tipo: 'SI_NO', obligatoria: true });
    expect(r[1].opciones).toEqual(['Tunja', 'Duitama']);
    expect(r[1].obligatoria).toBe(false);
    expect(JSON.stringify(r)).not.toContain('regla');
  });

  it('con cualquier cosa que no sea lista devuelve []', () => {
    expect(leerPreguntas(undefined)).toEqual([]);
    expect(leerPreguntas('x')).toEqual([]);
    expect(leerPreguntas({})).toEqual([]);
  });

  it('se queda con las primeras 8', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, texto: `Pregunta ${i}`, tipo: 'TEXTO' }));
    expect(leerPreguntas(muchas)).toHaveLength(8);
  });
});

describe('preguntasDelCargo', () => {
  it('encuentra las del cargo y [] para la espontánea', () => {
    const vacantes = [{ cargo: 'Vendedor TAT', preguntas: PREGUNTAS }, { cargo: 'Facturación' }];
    expect(preguntasDelCargo(vacantes, 'Vendedor TAT')).toHaveLength(4);
    expect(preguntasDelCargo(vacantes, 'Facturación')).toEqual([]);
    expect(preguntasDelCargo(vacantes, 'Otro / hoja de vida espontánea')).toEqual([]);
  });
});

describe('validarRespuestas', () => {
  it('con todo respondido no hay errores y las respuestas van en orden, normalizadas', () => {
    const r = validarRespuestas(
      PREGUNTAS,
      lector({
        [nombreCampo('moto')]: 'Sí',
        [nombreCampo('exp')]: '1,5',
        [nombreCampo('ciudad')]: 'duitama',
        [nombreCampo('antes')]: '  Nutresa  ',
      }),
    );
    expect(r.errores).toEqual([]);
    expect(r.respuestas).toEqual([
      { id: 'moto', texto_pregunta: '¿Tienes moto propia?', respuesta: 'SI' },
      { id: 'exp', texto_pregunta: '¿Cuántos años de experiencia tienes en ventas TAT?', respuesta: '1.5' },
      { id: 'ciudad', texto_pregunta: '¿En qué ciudad vives?', respuesta: 'Duitama' },
      { id: 'antes', texto_pregunta: '¿En qué empresa trabajaste antes?', respuesta: 'Nutresa' },
    ]);
  });

  it('las obligatorias sin responder son errores (todos, no solo el primero); las opcionales no', () => {
    const r = validarRespuestas(PREGUNTAS, lector({}));
    expect(r.errores).toEqual([
      'Falta responder: «¿Tienes moto propia?».',
      'Falta responder: «¿Cuántos años de experiencia tienes en ventas TAT?».',
      'Falta responder: «¿En qué ciudad vives?».',
    ]);
    expect(r.respuestas).toEqual([]);
  });

  it('rechaza valores que no caben en el tipo', () => {
    const r = validarRespuestas(
      PREGUNTAS,
      lector({
        [nombreCampo('moto')]: 'tal vez',
        [nombreCampo('exp')]: 'muchos',
        [nombreCampo('ciudad')]: 'Bogotá',
        [nombreCampo('antes')]: 'x'.repeat(301),
      }),
    );
    expect(r.errores).toHaveLength(4);
    expect(r.errores[0]).toContain('Sí o No');
    expect(r.errores[1]).toContain('un número');
    expect(r.errores[2]).toContain('no es una de las opciones');
    expect(r.errores[3]).toContain('300 caracteres');
  });

  it('sin preguntas no hay nada que validar', () => {
    expect(validarRespuestas([], lector({ x: 'y' }))).toEqual({ errores: [], respuestas: [] });
  });
});

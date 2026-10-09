// PRUEBAS DEL FORMULARIO CON PREGUNTAS DE FILTRO — validarPostulacion con una vacante que las trae.
//
// Por qué existe: postular.test.ts usa la lista estática (sin preguntas). Aquí se inyecta la vacante
//   para comprobar que el servidor exige las obligatorias, que una vacante sin preguntas deja
//   `respuestas` en null (Control360 → SIN FILTRO) y que el cuerpo firmado las lleva.
// Dónde corre: vitest (npm test), sin red.

import { describe, expect, it } from 'vitest';
import { cuerpoParaControl360 } from './control360';
import { nombreCampo, type PreguntaVacante } from './preguntas';
import { validarPostulacion } from './postulacion';

const PDF_MINIMO = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

const PREGUNTAS: PreguntaVacante[] = [
  { id: 'moto', texto: '¿Tienes moto propia?', tipo: 'SI_NO', obligatoria: true },
  { id: 'exp', texto: '¿Cuántos años de experiencia tienes?', tipo: 'NUMERO', obligatoria: false },
];

const vacanteDe = async (cargo: string) =>
  cargo === 'Vendedor TAT' ? { slug: 'vendedor-tat', preguntas: PREGUNTAS } : cargo === 'Facturación' ? { slug: 'facturacion', preguntas: [] } : null;

function formulario(extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  const base: Record<string, string> = {
    nombre: 'Cristian Amaya',
    correo: 'practicaspasantiasdst@gmail.com',
    telefono: '310 623 2429',
    cargo: 'Vendedor TAT',
    experiencia: '',
    autorizacion: 'si',
    turnstileToken: 'token',
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  f.set('hoja-de-vida', new File([new Uint8Array(PDF_MINIMO)], 'cv.pdf', { type: 'application/pdf' }));
  return f;
}

describe('validarPostulacion con preguntas de filtro', () => {
  it('exige la obligatoria y la devuelve junto a los demás errores', async () => {
    const r = await validarPostulacion(formulario(), { vacanteDe });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toEqual(['Falta responder: «¿Tienes moto propia?».']);
  });

  it('con las respuestas, salen validadas y con el slug de la vacante', async () => {
    const r = await validarPostulacion(
      formulario({ [nombreCampo('moto')]: 'SI', [nombreCampo('exp')]: '2' }),
      { vacanteDe },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.vacanteSlug).toBe('vendedor-tat');
    expect(r.datos.respuestas).toEqual([
      { id: 'moto', texto_pregunta: '¿Tienes moto propia?', respuesta: 'SI' },
      { id: 'exp', texto_pregunta: '¿Cuántos años de experiencia tienes?', respuesta: '2' },
    ]);
  });

  it('una vacante sin preguntas deja respuestas en null y el cuerpo a Control360 no las lleva', async () => {
    const r = await validarPostulacion(formulario({ cargo: 'Facturación' }), { vacanteDe });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.vacanteSlug).toBe('facturacion');
    expect(r.datos.respuestas).toBeNull();
    const cuerpo = JSON.parse(cuerpoParaControl360(r.datos, 'id-1'));
    expect(cuerpo).not.toHaveProperty('respuestas');
    expect(cuerpo).not.toHaveProperty('vacanteSlug');
  });

  it('la espontánea no tiene vacante: sin slug, sin respuestas, y el formulario queda como hoy', async () => {
    const r = await validarPostulacion(formulario({ cargo: 'Otro / hoja de vida espontánea' }), { vacanteDe });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.vacanteSlug).toBeNull();
    expect(r.datos.respuestas).toBeNull();
  });

  it('el cuerpo firmado a Control360 lleva vacanteSlug y respuestas {id, texto_pregunta, respuesta}', async () => {
    const r = await validarPostulacion(formulario({ [nombreCampo('moto')]: 'no' }), { vacanteDe });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cuerpo = JSON.parse(cuerpoParaControl360(r.datos, 'id-2'));
    expect(cuerpo.vacanteSlug).toBe('vendedor-tat');
    expect(cuerpo.respuestas).toEqual([{ id: 'moto', texto_pregunta: '¿Tienes moto propia?', respuesta: 'NO' }]);
    expect(Object.keys(cuerpo.respuestas[0]).sort()).toEqual(['id', 'respuesta', 'texto_pregunta']);
  });
});

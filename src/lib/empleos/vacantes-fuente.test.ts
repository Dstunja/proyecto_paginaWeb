/**
 * Pruebas de la fuente de vacantes (src/lib/empleos/vacantes-fuente.ts):
 * Control360 primero y la lista estática como respaldo.
 *
 * Lo que más importa es que la página NUNCA se quede sin vacantes: sin
 * variable, con la URL caída, con un JSON raro o vacío, sale la lista de
 * src/data/vacantes.ts. Y que lo que sí viene de Control360 conserve el flyer
 * y los extras de la lista estática cuando el slug coincide.
 */
import { describe, expect, it } from 'vitest';
import type { Vacante } from '../../data/vacantes';
import { cargosDe, CARGO_ESPONTANEO } from './cargos';
import { leerVacantesRemotas, resolverVacantes, urlVacantes, VARIABLE_URL } from './vacantes-fuente';

const ESTATICA: Vacante = {
  slug: 'vendedor-tat',
  cargo: 'Vendedor TAT (estático)',
  ciudad: 'Tunja, Boyacá',
  tipo: 'Tiempo completo',
  resumen: 'Resumen estático.',
  imagen: '/img/empleos/perfil-de-ventas.jpeg',
  descripcion: ['Párrafo estático.'],
  requisitos: ['Requisito estático.'],
  habilidades: ['Comunicación'],
  ofrecemos: ['Salario base'],
  whatsappExtra: { numero: '573000000000', texto: '300 000 0000' },
};
const ESTATICAS = [ESTATICA];

const REMOTO = {
  version: 1,
  vacantes: [
    {
      slug: 'vendedor-tat',
      cargo: 'Vendedor TAT',
      ciudad: 'Duitama, Boyacá',
      tipo: 'Tiempo completo',
      resumen: 'Resumen desde Control360.',
      descripcion: ['Párrafo 1.'],
      requisitos: ['Moto propia', 'Licencia A2'],
      funciones: ['Visitar tiendas'],
    },
    {
      slug: 'auxiliar-de-bodega',
      cargo: 'Auxiliar de Bodega',
      ciudad: 'Tunja, Boyacá',
      tipo: '',
      resumen: '',
      descripcion: [],
      requisitos: [],
      funciones: [],
    },
  ],
};

const respuesta = (cuerpo: unknown, status = 200): typeof fetch =>
  (async () => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

describe('leerVacantesRemotas', () => {
  it('convierte el JSON de Control360 en vacantes del sitio, en orden', () => {
    const r = leerVacantesRemotas(REMOTO, ESTATICAS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.vacantes.map((v) => v.slug)).toEqual(['vendedor-tat', 'auxiliar-de-bodega']);
    expect(r.vacantes[0].requisitos).toEqual(['Moto propia', 'Licencia A2']);
    expect(r.vacantes[0].funciones).toEqual(['Visitar tiendas']);
  });

  it('el texto manda Control360; el flyer y los extras los hereda de la lista estática por slug', () => {
    const r = leerVacantesRemotas(REMOTO, ESTATICAS);
    if (!r.ok) throw new Error(r.motivo);
    const [vendedor, bodega] = r.vacantes;
    expect(vendedor.cargo).toBe('Vendedor TAT');
    expect(vendedor.ciudad).toBe('Duitama, Boyacá');
    expect(vendedor.imagen).toBe(ESTATICA.imagen);
    expect(vendedor.ofrecemos).toEqual(['Salario base']);
    expect(vendedor.habilidades).toEqual(['Comunicación']);
    expect(vendedor.whatsappExtra).toEqual(ESTATICA.whatsappExtra);
    expect(bodega.imagen).toBe('');
    expect(bodega.ofrecemos).toBeUndefined();
  });

  it('descarta entradas sin slug válido, sin cargo o repetidas', () => {
    const r = leerVacantesRemotas(
      {
        version: 1,
        vacantes: [
          { slug: 'Con Mayúsculas', cargo: 'X' },
          { slug: 'sin-cargo' },
          { slug: 'bueno', cargo: 'Bueno' },
          { slug: 'bueno', cargo: 'Repetido' },
          'basura',
          null,
        ],
      },
      ESTATICAS,
    );
    expect(r.ok && r.vacantes.map((v) => v.cargo)).toEqual(['Bueno']);
  });

  it('trae las preguntas de filtro de Control360 (sin la regla) y no inventa ninguna', () => {
    const r = leerVacantesRemotas(
      {
        version: 1,
        vacantes: [
          {
            slug: 'vendedor-tat',
            cargo: 'Vendedor TAT',
            preguntas: [
              { id: 'moto', texto: '¿Tienes moto propia?', tipo: 'SI_NO', obligatoria: true, regla: { descarta_si: 'NO' } },
              { id: 'ciudad', texto: '¿Dónde vives?', tipo: 'OPCION', opciones: ['Tunja', 'Duitama'], obligatoria: false },
            ],
          },
          { slug: 'sin-preguntas', cargo: 'Sin preguntas' },
        ],
      },
      ESTATICAS,
    );
    if (!r.ok) throw new Error(r.motivo);
    expect(r.vacantes[0].preguntas).toEqual([
      { id: 'moto', texto: '¿Tienes moto propia?', tipo: 'SI_NO', obligatoria: true },
      { id: 'ciudad', texto: '¿Dónde vives?', tipo: 'OPCION', opciones: ['Tunja', 'Duitama'], obligatoria: false },
    ]);
    expect(r.vacantes[1]).not.toHaveProperty('preguntas');
  });

  it('rechaza lo que no tiene la forma esperada', () => {
    expect(leerVacantesRemotas(null, ESTATICAS).ok).toBe(false);
    expect(leerVacantesRemotas({ version: 2, vacantes: [] }, ESTATICAS).ok).toBe(false);
    expect(leerVacantesRemotas({ version: 1 }, ESTATICAS).ok).toBe(false);
    expect(leerVacantesRemotas({ version: 1, vacantes: [] }, ESTATICAS)).toEqual({
      ok: false,
      motivo: 'Control360 no tiene vacantes publicadas',
    });
  });
});

describe('urlVacantes', () => {
  it('solo acepta una URL http(s)', () => {
    expect(urlVacantes({})).toBeNull();
    expect(urlVacantes({ [VARIABLE_URL]: '   ' })).toBeNull();
    expect(urlVacantes({ [VARIABLE_URL]: 'control360app.com/api' })).toBeNull();
    expect(urlVacantes({ [VARIABLE_URL]: ' https://control360app.com/api/talento/vacantes/dst ' })).toBe(
      'https://control360app.com/api/talento/vacantes/dst',
    );
  });
});

describe('resolverVacantes', () => {
  const env = { [VARIABLE_URL]: 'https://control360app.com/api/talento/vacantes/dst' };

  it('con Control360 sano, usa sus vacantes', async () => {
    const r = await resolverVacantes({ env, fetchFn: respuesta(REMOTO), estaticas: ESTATICAS });
    expect(r.fuente).toBe('control360');
    expect(r.vacantes).toHaveLength(2);
  });

  it('sin la variable, usa la lista estática sin salir a la red', async () => {
    let llamadas = 0;
    const fetchFn = (async () => { llamadas += 1; return new Response('{}'); }) as unknown as typeof fetch;
    const r = await resolverVacantes({ env: {}, fetchFn, estaticas: ESTATICAS });
    expect(r.fuente).toBe('estatica');
    expect(r.vacantes).toEqual(ESTATICAS);
    expect(llamadas).toBe(0);
  });

  it('con la URL caída (503), con error de red o con JSON vacío, cae a la estática', async () => {
    const caida = await resolverVacantes({ env, fetchFn: respuesta({ ok: false }, 503), estaticas: ESTATICAS });
    expect(caida.fuente).toBe('estatica');
    expect(caida.motivo).toContain('503');

    const sinRed = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    const red = await resolverVacantes({ env, fetchFn: sinRed, estaticas: ESTATICAS });
    expect(red.fuente).toBe('estatica');
    expect(red.motivo).toContain('ECONNREFUSED');

    const vacio = await resolverVacantes({ env, fetchFn: respuesta({ version: 1, vacantes: [] }), estaticas: ESTATICAS });
    expect(vacio.fuente).toBe('estatica');
    expect(vacio.vacantes).toEqual(ESTATICAS);
  });

  it('la lista estática que devuelve es una copia', async () => {
    const r = await resolverVacantes({ env: {}, estaticas: ESTATICAS });
    expect(r.vacantes).not.toBe(ESTATICAS);
  });
});

describe('cargosDe', () => {
  it('los cargos del formulario salen de la lista que se resolvió, más la espontánea al final', () => {
    const r = leerVacantesRemotas(REMOTO, ESTATICAS);
    if (!r.ok) throw new Error(r.motivo);
    expect(cargosDe(r.vacantes)).toEqual(['Vendedor TAT', 'Auxiliar de Bodega', CARGO_ESPONTANEO]);
  });
});

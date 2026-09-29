/**
 * Pruebas del plazo de conservación de las hojas de vida guardadas
 * (src/lib/empleos/retencion.ts).
 *
 * Lo que más importa aquí no es que borre, sino que NO borre mientras no se le
 * diga: es un borrado irreversible de datos personales, y nace desactivado a
 * propósito. La primera mitad del archivo comprueba justamente eso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Lo que hay en el store, por ruta, con su fecha de subida. */
const enElStore = new Map<string, Date>();
/** Rutas que se pidió borrar, en orden. */
const borradas: string[] = [];

vi.mock('../pqrs/almacen', () => ({
  listar: async (prefijo: string) =>
    [...enElStore.entries()]
      .filter(([ruta]) => ruta.startsWith(prefijo))
      .map(([ruta, subidoEn]) => ({ pathname: ruta, url: `https://blob/${ruta}`, tamano: 1, subidoEn })),
  borrar: async (rutas: string[]) => {
    borradas.push(...rutas);
    for (const ruta of rutas) enElStore.delete(ruta);
  },
}));

const { limpiarPostulaciones, MESES_RETENCION_POR_DEFECTO } = await import('./retencion');

const AHORA = new Date('2026-09-29T14:00:00Z');

/** Escribe una postulación en el store falso, con sus dos archivos. */
function guardar(id: string, cuandoSeSubio: Date) {
  enElStore.set(`empleos/${id}/11111111-2222-3333-4444-555555555555.pdf`, cuandoSeSubio);
  enElStore.set(`empleos/${id}/registro.json`, cuandoSeSubio);
}

/** Una fecha a N meses de AHORA hacia atrás, más o menos unos días. */
function haceMeses(meses: number, masDias = 0): Date {
  const fecha = new Date(AHORA);
  fecha.setMonth(fecha.getMonth() - meses);
  fecha.setDate(fecha.getDate() - masDias);
  return fecha;
}

const CON_BLOB = { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_prueba' };

beforeEach(() => {
  enElStore.clear();
  borradas.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('nace desactivado', () => {
  it('sin EMPLEOS_RETENCION_ACTIVA no borra nada, solo mira', async () => {
    guardar('EMP-20250101-AAAAAA', haceMeses(12));

    const resultado = await limpiarPostulaciones(CON_BLOB, AHORA);

    expect(resultado.simulacro).toBe(true);
    expect(resultado.caducadas).toBe(1);
    expect(resultado.archivosBorrados).toBe(0);
    expect(borradas).toHaveLength(0);
    expect(enElStore.size).toBe(2);
  });

  /*
   * Se exige el valor exacto '1'. Una variable que alguien dejo a medias al
   * copiar el entorno no puede encender un borrado irreversible.
   */
  it.each(['0', '', 'si', 'true', 'SI', ' 1'])(
    'EMPLEOS_RETENCION_ACTIVA=%j sigue siendo simulacro',
    async (valor) => {
      guardar('EMP-20250101-AAAAAA', haceMeses(12));

      const resultado = await limpiarPostulaciones(
        { ...CON_BLOB, EMPLEOS_RETENCION_ACTIVA: valor },
        AHORA,
      );

      expect(resultado.simulacro).toBe(true);
      expect(borradas).toHaveLength(0);
    },
  );

  it('el simulacro dice qué identificadores se llevaría por delante', async () => {
    guardar('EMP-20250101-AAAAAA', haceMeses(12));
    guardar('EMP-20260901-BBBBBB', haceMeses(0, 20));

    const resultado = await limpiarPostulaciones(CON_BLOB, AHORA);

    expect(resultado.ids).toEqual(['EMP-20250101-AAAAAA']);
  });

  it('los identificadores no llevan ningún dato personal', async () => {
    guardar('EMP-20250101-AAAAAA', haceMeses(12));
    const resultado = await limpiarPostulaciones(CON_BLOB, AHORA);
    expect(resultado.ids.every((id) => /^EMP-\d{8}-[A-Z2-9]{6}$/.test(id))).toBe(true);
  });
});

describe('con el borrado encendido', () => {
  const ACTIVA = { ...CON_BLOB, EMPLEOS_RETENCION_ACTIVA: '1' };

  it('borra lo que pasó de seis meses', async () => {
    guardar('EMP-20250101-AAAAAA', haceMeses(7));

    const resultado = await limpiarPostulaciones(ACTIVA, AHORA);

    expect(resultado.simulacro).toBe(false);
    expect(resultado.caducadas).toBe(1);
    expect(resultado.archivosBorrados).toBe(2);
    expect(enElStore.size).toBe(0);
  });

  it('no toca lo que todavía está dentro del plazo', async () => {
    guardar('EMP-20260801-BBBBBB', haceMeses(5));

    const resultado = await limpiarPostulaciones(ACTIVA, AHORA);

    expect(resultado.caducadas).toBe(0);
    expect(borradas).toHaveLength(0);
    expect(enElStore.size).toBe(2);
  });

  /*
   * O se borra la carpeta entera o no se borra: un `registro.json` sin su hoja
   * de vida sigue teniendo el nombre y el telefono del candidato, ocupa sitio y
   * ya no sirve para nada. Es peor que no haber borrado.
   */
  it('borra la carpeta entera de cada postulación, no archivos sueltos', async () => {
    guardar('EMP-20250101-AAAAAA', haceMeses(8));

    await limpiarPostulaciones(ACTIVA, AHORA);

    expect(borradas).toHaveLength(2);
    expect(borradas.some((r) => r.endsWith('.pdf'))).toBe(true);
    expect(borradas.some((r) => r.endsWith('registro.json'))).toBe(true);
  });

  it('la edad de una postulación es la de su archivo más reciente', async () => {
    // El registro se escribe un instante después que la hoja de vida; si se
    // mirara el más viejo, una postulación justo en el límite se borraría antes
    // de tiempo.
    const id = 'EMP-20260329-CCCCCC';
    enElStore.set(`empleos/${id}/11111111-2222-3333-4444-555555555555.pdf`, haceMeses(6, 2));
    enElStore.set(`empleos/${id}/registro.json`, haceMeses(5));

    const resultado = await limpiarPostulaciones(ACTIVA, AHORA);

    expect(resultado.caducadas).toBe(0);
  });

  it('EMPLEOS_RETENCION_MESES cambia el plazo sin tocar código', async () => {
    guardar('EMP-20260801-BBBBBB', haceMeses(2));

    const resultado = await limpiarPostulaciones(
      { ...ACTIVA, EMPLEOS_RETENCION_MESES: '1' },
      AHORA,
    );

    expect(resultado.meses).toBe(1);
    expect(resultado.caducadas).toBe(1);
  });

  it('un valor absurdo de EMPLEOS_RETENCION_MESES cae al de por defecto', async () => {
    guardar('EMP-20260801-BBBBBB', haceMeses(2));

    const resultado = await limpiarPostulaciones(
      { ...ACTIVA, EMPLEOS_RETENCION_MESES: 'pronto' },
      AHORA,
    );

    expect(resultado.meses).toBe(MESES_RETENCION_POR_DEFECTO);
    expect(resultado.caducadas).toBe(0);
  });

  it('solo mira dentro de empleos/: no toca las PQRS', async () => {
    guardar('EMP-20250101-AAAAAA', haceMeses(12));
    enElStore.set('pqrs/PQRS-20250101-AAAAAA/soporte.pdf', haceMeses(12));

    await limpiarPostulaciones(ACTIVA, AHORA);

    expect(borradas.every((r) => r.startsWith('empleos/'))).toBe(true);
    expect(enElStore.has('pqrs/PQRS-20250101-AAAAAA/soporte.pdf')).toBe(true);
  });

  it('con el store vacío no hace nada y lo dice', async () => {
    const resultado = await limpiarPostulaciones(ACTIVA, AHORA);
    expect(resultado).toMatchObject({ revisadas: 0, caducadas: 0, archivosBorrados: 0 });
  });
});

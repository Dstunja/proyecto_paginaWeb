/**
 * Pruebas del respaldo en el navegador (src/lib/empleos/vacantes-vivas.ts): qué
 * respuesta de Control360 se considera de fiar para esconder tarjetas. Ante la
 * duda, null = no se esconde nada.
 */
import { describe, expect, it } from 'vitest';
import { slugsAbiertos } from './vacantes-vivas';

describe('slugsAbiertos', () => {
  it('devuelve los slugs de la versión 1', () => {
    const r = slugsAbiertos({ version: 1, vacantes: [{ slug: 'facturacion' }, { slug: ' logistica ' }] });
    expect(r && [...r]).toEqual(['facturacion', 'logistica']);
  });

  it('una lista vacía es válida: no hay ninguna abierta', () => {
    expect(slugsAbiertos({ version: 1, vacantes: [] })?.size).toBe(0);
  });

  it('cualquier otra forma no es de fiar', () => {
    expect(slugsAbiertos(null)).toBeNull();
    expect(slugsAbiertos({ ok: false, message: 'Demasiadas solicitudes.' })).toBeNull();
    expect(slugsAbiertos({ version: 2, vacantes: [] })).toBeNull();
    expect(slugsAbiertos({ version: 1, vacantes: [{ cargo: 'sin slug' }] })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  caidaExcesiva,
  hoyEnColombia,
  ofertaPublicable,
  parsearFecha,
  periodoDe,
  productoPublicable,
} from './vigencia.ts';

describe('hoyEnColombia', () => {
  it('a las 03:00 UTC todavía es el día anterior en Bogotá', () => {
    expect(hoyEnColombia(new Date('2026-09-17T03:00:00Z'))).toBe('2026-09-16');
  });
  it('a las 05:00 UTC ya cambió el día en Bogotá', () => {
    expect(hoyEnColombia(new Date('2026-09-17T05:00:00Z'))).toBe('2026-09-17');
  });
});

describe('parsearFecha', () => {
  it('acepta ISO, colombiano día/mes/año y el número de serie de Sheets', () => {
    expect(parsearFecha('2026-09-30')).toBe('2026-09-30');
    expect(parsearFecha('2026-9-5')).toBe('2026-09-05');
    expect(parsearFecha('30/09/2026')).toBe('2026-09-30');
    expect(parsearFecha('5-9-2026')).toBe('2026-09-05');
    expect(parsearFecha('2026-09-30T00:00:00')).toBe('2026-09-30');
    // 46295 días desde 1899-12-30 = 2026-09-30.
    expect(parsearFecha('46295')).toBe('2026-09-30');
  });

  it('rechaza fechas inexistentes, texto y celdas vacías', () => {
    expect(parsearFecha('2026-02-31')).toBeNull();
    expect(parsearFecha('31/13/2026')).toBeNull();
    expect(parsearFecha('mañana')).toBeNull();
    expect(parsearFecha('')).toBeNull();
    expect(parsearFecha('12/2026')).toBeNull();
  });
});

describe('productoPublicable', () => {
  const hoy = '2026-09-16';
  it('publica el propio día de "Vigente hasta" y oculta al día siguiente', () => {
    expect(productoPublicable({ activo: true, vigenteHasta: '2026-09-16' }, hoy)).toBe(true);
    expect(productoPublicable({ activo: true, vigenteHasta: '2026-09-15' }, hoy)).toBe(false);
    expect(productoPublicable({ activo: true, vigenteHasta: null }, hoy)).toBe(true);
  });
  it('Activo = No oculta aunque la fecha sea futura', () => {
    expect(productoPublicable({ activo: false, vigenteHasta: '2030-01-01' }, hoy)).toBe(false);
  });
});

describe('ofertaPublicable', () => {
  const hoy = '2026-09-16';
  it('respeta Activa, "Cierra el" inclusivo y "Publicada el" futura', () => {
    expect(ofertaPublicable({ activa: true, publicadaEl: null, cierraEl: '2026-09-16' }, hoy)).toBe(true);
    expect(ofertaPublicable({ activa: true, publicadaEl: null, cierraEl: '2026-09-15' }, hoy)).toBe(false);
    expect(ofertaPublicable({ activa: true, publicadaEl: '2026-09-17', cierraEl: null }, hoy)).toBe(false);
    expect(ofertaPublicable({ activa: true, publicadaEl: '2026-09-16', cierraEl: null }, hoy)).toBe(true);
    expect(ofertaPublicable({ activa: false, publicadaEl: null, cierraEl: null }, hoy)).toBe(false);
  });
});

describe('periodoDe', () => {
  it('nombra el mes en español con mayúscula inicial', () => {
    expect(periodoDe('2026-09-16')).toBe('Septiembre 2026');
    expect(periodoDe('2027-01-01')).toBe('Enero 2027');
  });
});

describe('caidaExcesiva', () => {
  it('salta cuando se pierde más del 30 % y no cuando no hay build anterior', () => {
    expect(caidaExcesiva(null, 5)).toBe(false);
    expect(caidaExcesiva(0, 5)).toBe(false);
    expect(caidaExcesiva(600, 420)).toBe(false);
    expect(caidaExcesiva(600, 419)).toBe(true);
    expect(caidaExcesiva(600, 700)).toBe(false);
  });
});

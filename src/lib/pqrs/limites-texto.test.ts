/**
 * Pruebas de src/lib/pqrs/limites-texto.ts.
 *
 * Lo que de verdad cuidan es que el CONTADOR del navegador y la VALIDACIÓN del
 * servidor no se contradigan: si el contador dijera «10 de 1500» y el servidor
 * contara 9, la persona volvería a recibir el error a ciegas, que es justo lo
 * que se quería evitar. Por eso se contrastan con las funciones de validación
 * reales, no con una copia de sus reglas.
 */
import { describe, expect, it } from 'vitest';
import { validarAdministrativa } from './administrativa';
import {
  LIMITES_TEXTO,
  ayudaMinimo,
  estadoLongitud,
  longitudComoServidor,
  textoContador,
} from './limites-texto';
import { validarSolicitud } from './solicitud';

const { descripcion, mensajeAdministrativo } = LIMITES_TEXTO;

/** Textos en el borde y con lo que el servidor descarta al contar. */
const CASOS = [
  '',
  '   ',
  'Hola',
  '123456789',
  '1234567890',
  '  1234567890  ',
  '12345\n6789',
  '12345\n67890',
  'factura\t123',
  '😀😀😀😀😀',
  'Necesito una copia de la factura del mes pasado.',
];

function administrativaAcepta(mensaje: string): boolean {
  const resultado = validarAdministrativa({
    nombre: 'Cristian Amaya',
    telefono: '3106232429',
    correo: '',
    mensaje,
  });
  return resultado.ok;
}

function comercialAcepta(texto: string): boolean {
  const resultado = validarSolicitud({
    tipo: 'Queja',
    nombre: 'Cristian Amaya',
    telefono: '3106232429',
    correo: 'persona@ejemplo.com',
    municipio: 'Tunja',
    descripcion: texto,
    autorizacion: true,
    sessionId: '11111111-2222-4333-8444-555555555555',
    turnstileToken: 'token',
    adjuntos: [],
  });
  return resultado.ok;
}

describe('el contador cuenta como el servidor', () => {
  it('los mínimos que se enseñan son los que aplica el servidor', () => {
    expect(descripcion.min).toBe(10);
    expect(mensajeAdministrativo.min).toBe(10);
    expect(ayudaMinimo(mensajeAdministrativo)).toBe('Mínimo 10 caracteres.');
  });

  it.each(CASOS)('administrativa: «%s» se acepta en el servidor si y solo si el contador lo da por bueno', (texto) => {
    expect(administrativaAcepta(texto)).toBe(estadoLongitud(texto, mensajeAdministrativo).ok);
  });

  it.each(CASOS)('comercial: «%s» se acepta en el servidor si y solo si el contador lo da por bueno', (texto) => {
    expect(comercialAcepta(texto)).toBe(estadoLongitud(texto, descripcion).ok);
  });

  it('el máximo también coincide', () => {
    const justo = 'x'.repeat(mensajeAdministrativo.max);
    const pasado = 'x'.repeat(mensajeAdministrativo.max + 1);
    expect(administrativaAcepta(justo)).toBe(true);
    expect(estadoLongitud(justo, mensajeAdministrativo).ok).toBe(true);
    expect(administrativaAcepta(pasado)).toBe(false);
    expect(estadoLongitud(pasado, mensajeAdministrativo).sobran).toBe(1);
  });
});

describe('longitudComoServidor', () => {
  it('no cuenta los espacios de los extremos', () => {
    expect(longitudComoServidor('  hola  ')).toBe(4);
  });

  it('no cuenta los saltos de línea ni los tabuladores, como el servidor', () => {
    expect(longitudComoServidor('hola\nmundo')).toBe(9);
    expect(longitudComoServidor('hola\tmundo')).toBe(9);
  });
});

describe('textoContador', () => {
  it('sin nada escrito enseña el mínimo', () => {
    expect(textoContador('', mensajeAdministrativo)).toBe('Mínimo 10 caracteres.');
    expect(textoContador('   ', mensajeAdministrativo)).toBe('Mínimo 10 caracteres.');
  });

  it('dice cuántos faltan, en singular y en plural', () => {
    expect(textoContador('Hola', mensajeAdministrativo)).toBe('Faltan 6 caracteres (mínimo 10).');
    expect(textoContador('123456789', mensajeAdministrativo)).toBe('Falta 1 carácter (mínimo 10).');
  });

  it('al llegar al mínimo cuenta sobre el máximo', () => {
    expect(textoContador('1234567890', mensajeAdministrativo)).toBe('10 de 1500 caracteres.');
  });

  it('si se pasa, dice cuántos sobran', () => {
    expect(textoContador('x'.repeat(1502), mensajeAdministrativo)).toBe(
      'Sobran 2 caracteres (máximo 1500).',
    );
  });
});

describe('mensajes del servidor', () => {
  it('el error del mensaje corto dice el mínimo', () => {
    const resultado = validarAdministrativa({
      nombre: 'Cristian Amaya',
      telefono: '3106232429',
      correo: '',
      mensaje: 'Hola',
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.errores).toContain('Cuéntanos brevemente qué necesitas, en al menos 10 caracteres.');
  });

  it('el error de la descripción corta dice el mínimo', () => {
    expect(comercialAcepta('Hola')).toBe(false);
    const resultado = validarSolicitud({
      tipo: 'Queja',
      nombre: 'Cristian Amaya',
      telefono: '3106232429',
      correo: 'persona@ejemplo.com',
      municipio: 'Tunja',
      descripcion: 'Hola',
      autorizacion: true,
      sessionId: '11111111-2222-4333-8444-555555555555',
      turnstileToken: 'token',
      adjuntos: [],
    });
    if (resultado.ok) throw new Error('debería rechazar');
    expect(resultado.errores.join(' ')).toContain('al menos 10 caracteres');
  });
});

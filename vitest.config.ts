import { defineConfig } from 'vitest/config';

// Las pruebas son de los módulos de servidor de la PQRS (src/lib/pqrs/), que
// están escritos a propósito sin dependencias del DOM ni de Astro: corren en
// Node tal cual. Lo que se ve en pantalla se comprueba aparte, con un navegador
// de verdad, en scripts/verificar-pqrs.mjs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});

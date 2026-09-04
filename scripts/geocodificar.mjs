/**
 * Geocodificación de los municipios y de la sede, con Nominatim (OpenStreetMap).
 *
 *   npm run geocodificar
 *
 * Nominatim es gratuito y no pide API key, pero sí exige identificarse y no
 * pasar de una consulta por segundo. Por eso este script:
 *
 *   - guarda todo en src/data/coordenadas.json (caché) y solo consulta lo que
 *     falta, así una recompilación normal no genera ni una petición;
 *   - espera 1,1 s entre consultas;
 *   - manda un User-Agent con el correo de contacto del proyecto.
 *
 * Si una coordenada queda mal, se puede corregir a mano en el JSON: el script
 * respeta lo que ya esté guardado (para volver a pedirla, borra esa entrada).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_CACHE = join(raiz, 'src', 'data', 'coordenadas.json');
const AGENTE = 'dstunja-web/1.0 (practicaspasantiasdst@gmail.com)';

const DEPARTAMENTO_CON_TILDE = {
  Boyaca: 'Boyacá',
  Santander: 'Santander',
  Cundinamarca: 'Cundinamarca',
};

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lee los municipios reales desde src/data/clientes-municipio.ts. */
function leerMunicipios() {
  const fuente = readFileSync(join(raiz, 'src', 'data', 'clientes-municipio.ts'), 'utf8');
  const filas = [...fuente.matchAll(/municipio: "([^"]+)", departamento: "([^"]+)"/g)];
  return filas
    .map(([, municipio, departamento]) => ({ municipio, departamento }))
    .filter(({ departamento }) => departamento in DEPARTAMENTO_CON_TILDE);
}

async function consultar(parametros) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ format: 'jsonv2', limit: '1', ...parametros }).toString();

  const respuesta = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  if (!respuesta.ok) throw new Error(`Nominatim respondió ${respuesta.status}`);
  const datos = await respuesta.json();
  return datos[0] ?? null;
}

/**
 * Busca la cabecera de un municipio. Primero con consulta estructurada
 * (más precisa), y si no aparece, con texto libre.
 */
async function geocodificarMunicipio(municipio, departamento) {
  const estado = DEPARTAMENTO_CON_TILDE[departamento];

  let resultado = await consultar({ city: municipio, state: estado, country: 'Colombia' });
  if (!resultado) {
    await espera(1100);
    resultado = await consultar({ q: `${municipio}, ${estado}, Colombia` });
  }
  if (!resultado) return null;

  // Comprobación mínima: debe caer dentro del recuadro de Colombia.
  const lat = Number(resultado.lat);
  const lng = Number(resultado.lon);
  const enColombia = lat > -4.3 && lat < 13.5 && lng > -79.1 && lng < -66.8;
  const departamentoOk = (resultado.display_name ?? '').includes(estado);

  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    fuente: resultado.display_name,
    revisar: !enColombia || !departamentoOk,
  };
}

const cache = existsSync(RUTA_CACHE) ? JSON.parse(readFileSync(RUTA_CACHE, 'utf8')) : {};

// ---- Sede principal -------------------------------------------------------
if (!cache.__sede__) {
  const intentos = [
    { q: 'Carrera 2 Este 58-79, Tunja, Boyacá, Colombia' },
    { street: 'Carrera 2 Este 58-79', city: 'Tunja', state: 'Boyacá', country: 'Colombia' },
    { q: 'Carrera 2 Este, Tunja, Boyacá, Colombia' },
  ];

  for (const intento of intentos) {
    const resultado = await consultar(intento);
    await espera(1100);
    if (resultado) {
      cache.__sede__ = {
        lat: Number(Number(resultado.lat).toFixed(6)),
        lng: Number(Number(resultado.lon).toFixed(6)),
        fuente: resultado.display_name,
        consulta: JSON.stringify(intento),
      };
      console.log('sede ->', resultado.display_name);
      break;
    }
  }
  if (!cache.__sede__) console.warn('No se pudo geocodificar la dirección de la sede.');
}

// ---- Municipios -----------------------------------------------------------
const municipios = leerMunicipios();
const faltantes = municipios.filter(({ municipio }) => !cache[municipio]);
console.log(`${municipios.length} municipios; faltan por geocodificar: ${faltantes.length}`);

for (const [i, { municipio, departamento }] of faltantes.entries()) {
  try {
    const resultado = await geocodificarMunicipio(municipio, departamento);
    if (resultado) {
      cache[municipio] = { departamento, ...resultado };
      console.log(
        `${String(i + 1).padStart(3)}/${faltantes.length} ${municipio.padEnd(22)} ${resultado.lat}, ${resultado.lng}${resultado.revisar ? '  <-- REVISAR' : ''}`,
      );
    } else {
      console.warn(`${String(i + 1).padStart(3)}/${faltantes.length} ${municipio.padEnd(22)} SIN RESULTADO`);
    }
  } catch (error) {
    console.error(`${municipio}: ${error.message}`);
  }

  writeFileSync(RUTA_CACHE, JSON.stringify(cache, null, 2) + '\n');
  await espera(1100); // política de uso de Nominatim: máximo 1 consulta por segundo
}

const revisar = Object.entries(cache).filter(([, v]) => v.revisar).map(([k]) => k);
console.log(`\nGuardado en src/data/coordenadas.json (${Object.keys(cache).length} entradas).`);
if (revisar.length) console.log('Revisar a mano:', revisar.join(', '));

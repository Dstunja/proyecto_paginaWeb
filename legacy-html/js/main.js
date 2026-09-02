// ---- Menú móvil ----
const navToggle = document.querySelector('.nav-toggle');
const mainNav = document.querySelector('.main-nav');
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// ---- Buscador de cobertura por municipio ----
// EDITAR AQUI: lista real de los 87 municipios cubiertos.
const MUNICIPIOS = [
  'Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Villa de Leyva',
  'Nobsa', 'Moniquirá', 'Ramiriquí', 'Garagoa', 'Puerto Boyacá', 'Samacá',
  'Bucaramanga', 'Barrancabermeja', 'Floridablanca', 'Girón', 'San Gil',
  'Socorro', 'Zapatoca', 'Piedecuesta',
  'Zipaquirá', 'Chocontá'
];

const finderInput = document.getElementById('finder-input');
const finderBtn = document.getElementById('finder-btn');
const finderResult = document.getElementById('finder-result');
const muniList = document.getElementById('muni-list');

function renderMuniList(filter = '') {
  if (!muniList) return;
  const term = filter.trim().toLowerCase();
  const items = MUNICIPIOS.filter(m => m.toLowerCase().includes(term));
  muniList.innerHTML = items.map(m => `<span>${m}</span>`).join('');
}
renderMuniList();

function checkCoverage() {
  if (!finderInput || !finderResult) return;
  const value = finderInput.value.trim();
  if (!value) {
    finderResult.textContent = 'Escribe el nombre de tu municipio.';
    finderResult.className = '';
    return;
  }
  const found = MUNICIPIOS.some(m => m.toLowerCase() === value.toLowerCase());
  if (found) {
    finderResult.textContent = `Sí, cubrimos ${value}. Un asesor puede contactarte.`;
    finderResult.className = 'ok';
  } else {
    finderResult.textContent = `Por ahora no tenemos cobertura confirmada en "${value}". Escríbenos y lo validamos.`;
    finderResult.className = 'no';
  }
  renderMuniList(value);
}

if (finderBtn) finderBtn.addEventListener('click', checkCoverage);
if (finderInput) {
  finderInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkCoverage();
  });
  finderInput.addEventListener('input', () => renderMuniList(finderInput.value));
}

// ---- Botón Pideky ----
// EDITAR AQUI: reemplazar con la URL real de la app/web de Pideky cuando exista.
const pidekyBtn = document.getElementById('pideky-open');
if (pidekyBtn) {
  pidekyBtn.addEventListener('click', (e) => {
    const realUrl = pidekyBtn.getAttribute('data-url');
    if (!realUrl || realUrl === '#') {
      e.preventDefault();
      alert('Falta configurar el enlace real de Pideky en data-url del botón (js/main.js / index.html).');
    }
  });
}

// ---- Misión / Visión: tabs accesibles ----
// Funcionan con clic y con teclado (flechas, Home, End). No dependen de :hover,
// por lo que también funcionan en móvil.
document.querySelectorAll('[data-mv-tabs]').forEach((root) => {
  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  if (!tabs.length) return;

  function select(index, focus = true) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (panel) panel.hidden = !selected;
    });
    if (focus) tabs[index].focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, false));
    tab.addEventListener('keydown', (e) => {
      const keys = {
        ArrowRight: i + 1, ArrowDown: i + 1,
        ArrowLeft: i - 1, ArrowUp: i - 1,
        Home: 0, End: tabs.length - 1
      };
      if (!(e.key in keys)) return;
      e.preventDefault();
      select((keys[e.key] + tabs.length) % tabs.length);
    });
  });
});

// ---- Mapa de cobertura ----
// La API key NO se escribe en el HTML. Se lee de window.DST_CONFIG, que define
// js/config.js (archivo generado en el despliegue desde variables de entorno y
// listado en .gitignore). Si no hay config, se usa OpenStreetMap, que no
// necesita key. Ver js/config.example.js.
(function initCoverageMap() {
  const host = document.getElementById('coverage-map');
  if (!host) return;

  const cfg = window.DST_CONFIG || {};
  const query = cfg.MAP_QUERY || 'Distribuciones Santiago de Tunja, Tunja, Boyacá, Colombia';
  const key = cfg.GOOGLE_MAPS_EMBED_KEY || '';
  const note = document.getElementById('coverage-map-note');

  const frame = document.createElement('iframe');
  frame.title = 'Mapa de cobertura de Distribuciones Santiago de Tunja';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer-when-downgrade';

  const useGoogle = cfg.MAPS_PROVIDER === 'google' && Boolean(key);
  host.classList.add(useGoogle ? 'is-google' : 'is-osm');

  if (useGoogle) {
    frame.src = 'https://www.google.com/maps/embed/v1/place'
      + '?key=' + encodeURIComponent(key)
      + '&q=' + encodeURIComponent(query)
      + '&zoom=' + (cfg.MAP_ZOOM || 8);
  } else {
    // Sin key: recuadro sobre Boyacá, Santander y Cundinamarca con marca en Tunja.
    const bbox = cfg.MAP_BBOX || '-74.55,5.35,-72.85,6.85';
    const marker = cfg.MAP_MARKER || '5.5353,-73.3678';
    frame.src = 'https://www.openstreetmap.org/export/embed.html'
      + '?bbox=' + encodeURIComponent(bbox)
      + '&layer=mapnik&marker=' + encodeURIComponent(marker);
    if (note) {
      note.innerHTML = 'Cartografía &copy; <a href="https://www.openstreetmap.org/copyright"'
        + ' target="_blank" rel="noopener">OpenStreetMap</a>';
    }
  }

  host.appendChild(frame);
})();

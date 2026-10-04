// Edición de la app. El MISMO código sirve dos productos:
//   - 'completo' (app.tradinverso.com): las tres estrategias, cuentas CFD y de
//     futuros, Contabilidad y Psicotrading entero.
//   - 'nasdaq' (journal.tradinverso.com): solo la estrategia Nasdaq, solo
//     cuentas de futuros, Contabilidad con candado, y con sus propias listas
//     de protocolos fijos y meditaciones (protocolos-fijos.js, meditaciones.js).
// La edición la decide la web desde la que se abre, igual que el proyecto de
// Firebase (firebase.js). Fuera de esas dos webs (servidor local) se puede
// elegir con ?edicion=nasdaq o ?edicion=completo; queda recordada en ese
// navegador. Sin nada, 'completo'.
//
// Este archivo no importa nada: lo usan firebase.js, el router, el sidebar y
// las vistas, y tiene que poder cargarse antes que todos ellos.

const EDITIONS = {
  completo: {
    id: 'completo',
    nombre: 'Trading Journal',
    version: 'v.2.5',
    sheets: ['ZONAS', 'LIQUIDEZ', 'NASDAQ'],
    cuentaTipos: ['CFD', 'Futuros'],
    // Contabilidad: true = la vista real; 'candado' = en el menú con candado y
    // solo una captura desenfocada (views/vista-candado.js); false = fuera.
    contabilidad: true,
    // Ítem "Estrategias" con candado cuando la edición tiene una sola estrategia
    // (vista-candado.js); la completa tiene la sección real.
    estrategiasCandado: false,
    meditaciones: true,
    // Logo grande (login, pantalla de carga), favicons de la pestaña y, si la
    // edición tiene marca propia, la imagen pequeña del menú (sin ella, el globo).
    logo: 'assets/logo.png',
    favicons: { 32: 'assets/favicon-tab-32.png', 192: 'assets/favicon-tab-192.png' },
    appleIcon: 'assets/icon-192.png',
    marca: null,
    // A dónde llevan los candados (lo que es del programa completo). La
    // completa no tiene candados.
    upgradeUrl: null,
  },
  nasdaq: {
    id: 'nasdaq',
    nombre: 'Nasdaq Journal',
    version: 'v.1.0',
    sheets: ['NASDAQ'],
    cuentaTipos: ['Futuros'],
    contabilidad: 'candado',
    estrategiasCandado: true,
    meditaciones: true,   // solo la pre-operativa abierta (meditaciones.js)
    logo: 'assets/nasdaq/logo.png',
    favicons: { 32: 'assets/nasdaq/favicon-32.png', 192: 'assets/nasdaq/favicon-192.png' },
    appleIcon: 'assets/nasdaq/icon-192.png',
    marca: 'assets/nasdaq/marca.png',
    // Sin enlace: el candado solo pide contactar con el equipo (decisión de
    // David). Si se pone una URL, el aviso del candado añade un botón a ella.
    upgradeUrl: null,
  },
};

const HOST_EDITION = {
  'app.tradinverso.com': 'completo',
  'journal.tradinverso.com': 'nasdaq',
};

const STORAGE_KEY = 'tradinverso_edicion';

function detect() {
  const fija = HOST_EDITION[location.hostname];
  if (fija) return fija;
  try {
    const q = new URLSearchParams(location.search).get('edicion');
    if (q && EDITIONS[q]) localStorage.setItem(STORAGE_KEY, q);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && EDITIONS[saved]) return saved;
  } catch (e) { /* sin localStorage: edición por defecto */ }
  return 'completo';
}

export const EDITION = EDITIONS[detect()];
export const IS_NASDAQ = EDITION.id === 'nasdaq';

// Estrategias de esta edición, en el orden de siempre. Todo lo que antes
// recorría ['ZONAS', 'LIQUIDEZ', 'NASDAQ'] a mano recorre esta lista.
export const SHEETS = EDITION.sheets;
// Con una sola estrategia sobran los selectores y las pestañas de estrategia.
export const MULTI_SHEET = SHEETS.length > 1;
export const hasSheet = s => SHEETS.includes(s);

// Tipo de cuenta por defecto (y único, en la edición Nasdaq).
export const CUENTA_TIPO_DEFAULT = EDITION.cuentaTipos[0];
export const hasCuentaTipo = t => EDITION.cuentaTipos.includes(t);

// Rutas que esta edición no tiene: el router las manda al Dashboard (enlaces
// viejos, marcadores). Riesgo CFD lo resuelve state.riesgoActivo.
const SHEET_ROUTES = {
  ZONAS: ['#/zonas', '#/bt-zonas'],
  LIQUIDEZ: ['#/liquidez', '#/bt-liquidez'],
  NASDAQ: ['#/nasdaq', '#/bt-nasdaq'],
};
export const HIDDEN_ROUTES = new Set([
  ...Object.keys(SHEET_ROUTES).filter(s => !hasSheet(s)).flatMap(s => SHEET_ROUTES[s]),
  // Con una sola estrategia su análisis va dentro del Dashboard (dashboard.js).
  ...(MULTI_SHEET ? [] : SHEETS.map(s => SHEET_ROUTES[s][0])),
  ...(EDITION.contabilidad === false ? ['#/contabilidad'] : []),
  ...(EDITION.estrategiasCandado ? [] : ['#/estrategias']),
  ...(EDITION.meditaciones ? [] : ['#/meditaciones']),
]);

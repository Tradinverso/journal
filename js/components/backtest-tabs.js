// Barra de pestañas de la sección Backtesting: las 3 estrategias, cada una con
// su histórico de backtests. Mismo patrón que strategy-tabs (enlaces de
// navegación, la activa con el color de su estrategia).

import { STRATEGIES } from '../utils/strategy-config.js';
import { EDITION, hasSheet } from '../edition.js';
import { abrirCandado } from './candado.js';

// Orden de siempre: las 3 estrategias, NO TOMADOS (trades que se escaparon,
// aparte para que no contaminen la validación de cada estrategia) e IMPORTAR
// (rejilla para volcar Sheets/CSV).
const TODAS = {
  ZONAS: '#/bt-zonas',
  LIQUIDEZ: '#/bt-liquidez',
  NASDAQ: '#/bt-nasdaq',
  NO_TOMADOS: '#/bt-no-tomados',
  IMPORTAR: '#/bt-importar',
};

// Rutas que existen en esta edición (edition.js). Están todas en BACKTEST_ROUTES
// para que el sidebar marque activo el ítem "Backtesting" también en No tomados
// e Importar (match usa Object.values).
export const BACKTEST_ROUTES = Object.fromEntries(Object.entries(TODAS)
  .filter(([k]) => !STRATEGIES[k] || hasSheet(k)));

// Edición Nasdaq: las estrategias que no tiene salen igualmente, con candado
// (como el ítem "Estrategias" del menú); al pulsarlas, el aviso del programa
// completo. Un solo listener para todas las vistas que pintan estas pestañas.
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-bt-candado]');
  if (b) abrirCandado(`Backtesting · ${STRATEGIES[b.dataset.btCandado].label}`, 'backtesting');
});

export function backtestTabs(active) {
  const EXTRA = { IMPORTAR: '⬆ Importar', NO_TOMADOS: '✗ No tomados' };
  return `
    <div class="rg-tabs gestion-tabs strat-tabs">
      ${Object.keys(TODAS).map(k => {
        const meta = STRATEGIES[k] || { label: EXTRA[k] || k };
        if (!BACKTEST_ROUTES[k]) {
          return EDITION.estrategiasCandado
            ? `<button type="button" class="rg-tab" data-bt-candado="${k}" style="opacity:.6;" title="Disponible en el programa completo">${meta.label} 🔒</button>`
            : '';
        }
        const on = active === k;
        return `<a class="rg-tab ${on ? 'active' : ''}" href="${BACKTEST_ROUTES[k]}"
                   ${on && meta.color ? `style="--tab-accent:${meta.color};"` : ''}>${meta.label}</a>`;
      }).join('')}
    </div>`;
}

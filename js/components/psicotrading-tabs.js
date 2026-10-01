// Barra de pestañas que unifica la sección Psicotrading:
// Reflexiones ↔ Meditaciones ↔ Protocolos. Son enlaces de navegación (cada uno
// es su propia ruta/vista), marcando la activa. Mismo patrón que ajustes-tabs.

import { EDITION } from '../edition.js';

// Meditaciones no existe en la edición Nasdaq (edition.js).
export const PSICO_ROUTES = {
  reflexiones: '#/psicologia',
  ...(EDITION.meditaciones ? { meditaciones: '#/meditaciones' } : {}),
  protocolos: '#/protocolos',
};

export function psicotradingTabs(active) {
  const tab = (id, label) =>
    `<a class="rg-tab ${active === id ? 'active' : ''}" href="${PSICO_ROUTES[id]}">${label}</a>`;
  // strat-tabs: mismas pestañas grandes y centradas que en Estrategias.
  return `
    <div class="rg-tabs gestion-tabs strat-tabs">
      ${tab('reflexiones', '🧘 Reflexiones')}
      ${PSICO_ROUTES.meditaciones ? tab('meditaciones', '🎧 Meditaciones') : ''}
      ${tab('protocolos', '📋 Protocolos')}
    </div>`;
}

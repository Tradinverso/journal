// Aviso de los candados de la edición Nasdaq: lo que es del programa completo
// (protocolos, meditaciones) se ve, pero al pulsarlo se explica cómo acceder.
// Si EDITION.upgradeUrl tiene enlace, el aviso añade un botón a él; si no
// (decisión actual de David), solo pide contactar con el equipo.

import { openModal } from './modal.js';
import { EDITION } from '../edition.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// origen: de dónde viene el clic, para el utm_campaign del enlace (si lo hay).
export function abrirCandado(titulo, origen = '') {
  const url = EDITION.upgradeUrl
    ? EDITION.upgradeUrl + (origen ? `${EDITION.upgradeUrl.includes('?') ? '&' : '?'}utm_campaign=${encodeURIComponent(origen)}` : '')
    : null;
  openModal({
    title: `🔒 ${esc(titulo)}`,
    body: `
      <div style="line-height:1.7;">
        Esto forma parte del <strong>programa completo de Tradinverso</strong>.
        <br><br>
        Si quieres avanzar y llevar tu trading al siguiente nivel,
        <strong>contacta con el equipo</strong> para acceder.
      </div>`,
    actions: url
      ? [
          { label: 'Ahora no', onClick: close => close() },
          { label: 'Quiero acceder', variant: 'primary', onClick: close => { window.open(url, '_blank', 'noopener'); close(); } },
        ]
      : [{ label: 'Entendido', variant: 'primary', onClick: close => close() }],
  });
}

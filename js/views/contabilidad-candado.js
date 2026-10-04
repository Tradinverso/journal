// Contabilidad con candado (edición Nasdaq): no es la vista real, solo una
// captura desenfocada de cómo se ve en el programa completo (con datos de
// ejemplo) y, encima, el candado con el aviso de components/candado.js.

import { EDITION } from '../edition.js';
import { CANDADO_MENSAJE, candadoUrl } from '../components/candado.js';

export function contabilidadCandadoView(container) {
  const url = candadoUrl('contabilidad');
  container.innerHTML = `
    <div style="position:relative;border-radius:14px;overflow:hidden;height:calc(100vh - 56px);min-height:420px;">
      <img src="${EDITION.contabilidadPreview}" alt="" aria-hidden="true"
           style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top left;opacity:.85;user-select:none;pointer-events:none;">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div class="card" style="max-width:440px;text-align:center;padding:30px 28px;background:var(--card, rgba(18,26,46,.92));box-shadow:0 20px 60px rgba(0,0,0,.45);">
          <div style="font-size:40px;line-height:1;margin-bottom:14px;">🔒</div>
          <div class="card-title" style="font-size:20px;margin-bottom:6px;">Contabilidad</div>
          <div class="card-sub" style="margin-bottom:16px;">Lo que inviertes en props frente a lo que retiras: ROI, payouts, compras y calendario.</div>
          <div style="line-height:1.7;font-size:13px;">${CANDADO_MENSAJE}</div>
          ${url ? `<a class="btn primary" href="${url}" target="_blank" rel="noopener" style="margin-top:18px;display:inline-flex;">Quiero acceder</a>` : ''}
        </div>
      </div>
    </div>`;
}

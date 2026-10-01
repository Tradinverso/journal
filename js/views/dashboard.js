import { state } from '../state.js';
import { auth } from '../auth.js';
import { router } from '../router.js';
import {
  winrate, pnlPct, pnlPctReal, profitFactor, maxDrawdown, maxStreak, bestTpStreakPnl,
  equityCurve, equityCurveReal, monthlyPnl, activeDays, tradeCounts, durationStats,
  wrByHour, wrByDay, statsByGroup, longVsShort, avgRR, expectancy, planStats,
} from '../utils/calculations.js';
import { fmtPct, fmtPctNoSign, fmtNum } from '../utils/number-format-es.js';
import {
  formatDateShort, MONTHS_ES_SHORT,
} from '../utils/date-helpers.js';
import { kpiCard, kpiCardComposite } from '../components/kpi-card.js';
import { createEquity, createDonut, createBar, createHourBar, createDayBar, createLongShort } from '../components/charts.js';
import { renderHeatmap } from '../components/heatmap.js';
import { renderPills } from '../components/pills.js';
import { openModal, closeModal } from '../components/modal.js';
import { todayStatus } from '../utils/diagnostics.js';
import { storage } from '../storage.js';
import { CHECKLIST_ITEMS, currentChecklistKey, dailyChecklistKey, checklistCompleto } from '../utils/checklist-items.js';
import {
  newPeriod, monthsOf, inPeriod, clampPeriod, periodHtml, wirePeriod, prevPeriod,
} from '../components/period-filter.js';
import { SHEETS, MULTI_SHEET, hasSheet } from '../edition.js';
import { STRATEGIES } from '../utils/strategy-config.js';

const STRAT_LABELS = { ZONAS: 'Forex + Oro', LIQUIDEZ: 'EUR/USD', NASDAQ: 'NQ Futuros' };
const STRAT_CLS = { ZONAS: 'zonas', LIQUIDEZ: 'liquidez', NASDAQ: 'nasdaq' };
// Con una sola estrategia (edición Nasdaq), "Global" y "Nasdaq" son lo mismo:
// sobran las tarjetas por estrategia, la tabla de pares (siempre NQ) y las
// columnas duplicadas.

let dashPeriod = newPeriod();   // rango de meses { from, to }
let perfMode = 'sistema'; // 'sistema' | 'real'
let lastUserKey = null;   // detecta cambio de usuario (viewAs) para resetear filtros

function render(container) {
  const allTrades = state.trades;

  // Los filtros viven a nivel de módulo: al cambiar de alumno (viewAs) o si el
  // periodo filtrado ya no existe en los datos (wipe/reimport), se resetean.
  // Si no, filtrarían en silencio con el select mostrando "Todos".
  const userKey = state.viewAsUid || 'self';
  if (userKey !== lastUserKey) {
    if (lastUserKey !== null) dashPeriod = newPeriod();
    lastUserKey = userKey;
  }
  clampPeriod(dashPeriod, monthsOf(allTrades));

  if (!allTrades.length) {
    container.innerHTML = impersonationBanner() + (state.loading ? loadingState() : emptyState());
    wireImpersonation(container);
    return;
  }

  const filtered = filterTrades(allTrades, dashPeriod);
  container.innerHTML = impersonationBanner() + renderShell(allTrades, filtered);
  wireImpersonation(container);

  // Semáforo "Checklist pendiente": pulsable → abre el modal del checklist
  const chkBtn = container.querySelector('#semaforoChk');
  if (chkBtn) chkBtn.addEventListener('click', () => openChecklistModal(container));

  wirePeriod(container, dashPeriod, () => render(container), { idFrom: 'dashFrom', idTo: 'dashTo' });

  // Toggle Sistema/Real
  const perfToggleEl = container.querySelector('#perfToggle');
  if (perfToggleEl) {
    renderPills(perfToggleEl, {
      name: 'perfMode',
      options: [{ value: 'sistema', label: 'Sistema' }, { value: 'real', label: 'Real' }],
      value: perfMode,
      onChange: v => { perfMode = v; render(container); },
    });
  }

  // KPIs y tablas (HTML puro) se pintan ya.
  paintKpis(container, filtered, allTrades);
  paintStreaks(container, filtered);
  paintDurations(container, filtered);

  // Gráficos (Chart.js): en el siguiente frame, cuando el layout del contenedor
  // ya está calculado. Crearlos en el mismo tick que el innerHTML provoca que a
  // veces midan tamaño 0 y salgan en blanco hasta refrescar.
  requestAnimationFrame(() => {
    if (!container.querySelector('#equityChart')) return; // la vista cambió
    paintEquity(container, filtered);
    paintMonthly(container, allTrades);
    if (MULTI_SHEET) SHEETS.forEach(s => paintStrategy(container, s, filtered));
    paintTiming(container, filtered);
    paintDirectionAndPairs(container, filtered);
  });
}

function impersonationBanner() {
  if (!state.viewAsUid || !state.viewAsProfile) return '';
  const p = state.viewAsProfile;
  const n = state.trades.length;
  return `
    <div class="imp-banner">
      <div class="imp-banner-icon">📝</div>
      <div class="imp-banner-text">
        Editando como <strong>${escapeHtml(p.nombre || p.email)}</strong>
        <span class="meta">${n} trades · cualquier cambio se guarda en SU cuenta</span>
      </div>
      <button class="btn" id="exitImpBtn">Volver a Mis Alumnos</button>
    </div>
  `;
}

function wireImpersonation(container) {
  const btn = container.querySelector('#exitImpBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await state.exitViewAs();
    router.go('#/admin');
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function dashboardView(container) {
  render(container);
  const unsubState = state.on(() => render(container));
  return () => {
    unsubState();
  };
}

// Mientras Firestore responde, sin datos aún en memoria: no confundir con el
// vacío real ("Aún no hay trades"), que asusta si solo es una carga lenta.
function loadingState() {
  return `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <div class="sub">Cargando…</div>
      </div>
    </div>
    <div class="empty">
      <span class="spinner-sm" style="width:24px;height:24px;border-width:3px;"></span>
      <div style="margin-top:14px;">Cargando tus datos…</div>
    </div>
  `;
}

// ── Empty state ──────────────────────────────────────────────
function emptyState() {
  const userName = state.viewAsUid && state.viewAsProfile
    ? (state.viewAsProfile.nombre || state.viewAsProfile.email.split('@')[0])
    : auth.displayName();
  const userSuffix = userName ? ` <span style="color:var(--muted);font-weight:400;">·</span> <span style="color:var(--text);font-weight:500;">${escapeHtml(userName)}</span>` : '';
  const writableActions = state.readOnly ? '' : `
      <a class="btn primary" href="#/importar" style="margin-top:20px;display:inline-flex;">Importar datos</a>
      <a class="btn" href="#/nuevo" style="margin-top:20px;margin-left:8px;display:inline-flex;">Nuevo trade</a>
  `;
  return `
    <div class="page-header">
      <div>
        <h1>Dashboard${userSuffix}</h1>
        <div class="sub">Sin datos aún</div>
      </div>
    </div>
    <div class="empty">
      <div class="big">📈</div>
      <div>Aún no hay trades${state.readOnly ? '' : '. Importa tu histórico desde Google Sheets o crea un trade nuevo'}.</div>
      ${writableActions}
    </div>
  `;
}

// ── Filter helpers ───────────────────────────────────────────
function filterTrades(trades, sel) {
  return trades.filter(t => inPeriod(t.date, sel));
}

// Trades del periodo ANTERIOR equivalente al filtro actual, para comparar.
// Con un rango de N meses, el "antes" son los N meses justo anteriores. Sin
// periodo acotado no hay comparación posible (no hay un antes con el que medir).
function prevPeriodTrades(allTrades, sel) {
  const prev = prevPeriod(sel, monthsOf(allTrades));
  if (!prev) return null;
  return { trades: allTrades.filter(t => inPeriod(t.date, prev.range)), ref: prev.ref };
}

// Construye la píldora de tendencia. `better` decide el color: en el DD, menos es mejor.
function trend(curr, prev, ref, { unit = 'pp', lowerIsBetter = false } = {}) {
  if (prev == null || !isFinite(curr) || !isFinite(prev)) return null;
  const delta = curr - prev;
  const txt = (delta > 0 ? '+' : '−') + fmtNum(Math.abs(delta), 1) + unit;
  return { delta, text: txt, ref, better: lowerIsBetter ? delta < 0 : delta > 0 };
}

// ── Shell HTML ───────────────────────────────────────────────
function renderShell(allTrades, filtered) {
  const months = monthsOf(allTrades);
  const dates = filtered.map(t => t.date).sort();
  const first = dates.length ? formatDateShort(dates[0]) : '';
  const last = dates.length ? formatDateShort(dates[dates.length - 1]) : '';
  const userName = state.viewAsUid && state.viewAsProfile
    ? (state.viewAsProfile.nombre || state.viewAsProfile.email.split('@')[0])
    : auth.displayName();
  return `
    <div class="page-header">
      <div>
        <h1>Dashboard${userName ? ` <span style="color:var(--muted);font-weight:400;">·</span> <span style="color:var(--text);font-weight:500;">${escapeHtml(userName)}</span>` : ''}</h1>
        <div class="sub">${filtered.length} trades · ${first} → ${last}</div>
      </div>
      <div class="page-actions">
        ${periodHtml(months, dashPeriod, { idFrom: 'dashFrom', idTo: 'dashTo' })}
        ${checklistChip()}
        ${semaforoPill(allTrades)}
      </div>
    </div>

    <div class="kpi-grid" id="kpis"></div>

    <div class="section-title-row">
      <div class="section-title" style="margin:0;">Rendimiento</div>
      <div class="perf-toggle" id="perfToggle"></div>
    </div>
    <div class="grid-2-1">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Curva de equity (P&L acumulado)</div>
            <div class="card-sub">${MULTI_SHEET ? 'Por estrategia · ' : ''}${perfMode === 'real' ? 'P&L real (riesgo aplicado)' : 'Sistema 1R normalizado'}</div>
          </div>
          ${MULTI_SHEET ? `<div style="display:flex;gap:6px;">
            <span class="strat-pill global">Global</span>
            ${SHEETS.map(k => `<span class="strat-pill ${STRAT_CLS[k]}">${STRATEGIES[k].label}</span>`).join('')}
          </div>` : ''}
        </div>
        <div class="chart-wrap" style="height:300px;"><canvas id="equityChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">P&L mensual</div>
        <div class="card-sub">${monthlyChartYear() ? 'Año ' + monthlyChartYear() : 'Todo el histórico'} · ${perfMode === 'real' ? '% riesgo real' : '% sistema 1R'}</div>
        <div class="chart-wrap" style="height:300px;"><canvas id="monthlyChart"></canvas></div>
      </div>
    </div>

    ${MULTI_SHEET ? `<div class="section-title">Por estrategia</div>
    <div class="grid-3" id="stratGrid">
      ${SHEETS.map(s => stratCardShell(s)).join('')}
    </div>` : ''}

    <div class="section-title">Timing</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Winrate por franja horaria</div>
        <div class="card-sub">Hora de apertura · Línea = nº trades</div>
        <div class="chart-wrap" style="height:200px;"><canvas id="hourChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Winrate por día de semana</div>
        <div class="card-sub">WR + nº trades por día</div>
        <div class="chart-wrap" style="height:200px;"><canvas id="dayChart"></canvas></div>
      </div>
    </div>

    <div class="section-title">Mapa de calor</div>
    <div class="card" style="margin-bottom:24px;">
      <div class="card-title">WR por día y hora</div>
      <div class="card-sub">Verde = WR alto · Rojo = WR bajo · Gris = sin trades</div>
      <div id="heatmap" style="margin-top:14px;"></div>
    </div>

    <div class="section-title">${MULTI_SHEET ? 'Dirección y pares' : 'Dirección'}</div>
    <div ${MULTI_SHEET ? 'class="grid-2"' : 'style="margin-bottom:24px;"'}>
      <div class="card">
        <div class="card-title">${MULTI_SHEET ? 'Long vs Short por estrategia' : 'Long vs Short'}</div>
        <div class="card-sub">Winrate según dirección</div>
        <div class="chart-wrap" style="height:200px;"><canvas id="lsChart"></canvas></div>
      </div>
      ${MULTI_SHEET ? `<div class="card table-card">
        <div class="card-title">Rendimiento por par</div>
        <div class="card-sub">Pares con ≥1 trade</div>
        <table class="data-table"><thead><tr>
          <th>Par</th><th>Trades</th><th>WR</th><th>P&L sist.</th><th>P&L real</th><th>PF</th><th>Señal</th>
        </tr></thead><tbody id="pairsTbody"></tbody></table>
      </div>` : ''}
    </div>

    <div class="section-title">Rachas y drawdown</div>
    <div class="card table-card" style="margin-bottom:24px;">
      <div class="card-title" style="margin-bottom:14px;">${MULTI_SHEET ? 'Rachas consecutivas y DD por estrategia y par' : 'Rachas consecutivas y DD'}</div>
      <table class="data-table"><thead><tr>
        <th>Métrica</th>
        ${streakGroups([]).map(g => `<th${g.color ? ` style="color:${g.color}"` : ''}>${g.label}</th>`).join('')}
      </tr></thead><tbody id="streakTbody"></tbody></table>
    </div>

    <div class="section-title">Duración de trades</div>
    <div class="card table-card" style="margin-bottom:24px;">
      <div class="card-title" style="margin-bottom:14px;">${MULTI_SHEET ? 'Duración media por estrategia y resultado' : 'Duración media por resultado'}</div>
      <table class="data-table"><thead><tr>
        <th>${MULTI_SHEET ? 'Estrategia' : ''}</th><th>Media</th><th>Media TP</th><th>Media SL</th><th>Máxima</th><th>Mínima</th>
      </tr></thead><tbody id="durTbody"></tbody></table>
    </div>
  `;
}

function stratCardShell(s) {
  const cls = STRAT_CLS[s];
  return `
    <div class="card" data-strat="${s}">
      <div class="card-title">${s.charAt(0) + s.slice(1).toLowerCase()}</div>
      <div class="card-sub" data-field="sub">– trades</div>
      <div class="mini-stats">
        <div><div class="mini-stat-val" data-field="wr" style="color:var(--${cls});">–</div><div class="mini-stat-lbl">Winrate</div></div>
        <div><div class="mini-stat-val" data-field="pnl" style="color:var(--green);">–</div><div class="mini-stat-lbl">P&L sist.</div></div>
        <div><div class="mini-stat-val" data-field="pnlReal" style="color:var(--green);">–</div><div class="mini-stat-lbl">P&L real</div></div>
        <div><div class="mini-stat-val" data-field="pf" style="color:var(--orange);">–</div><div class="mini-stat-lbl">Profit Factor</div></div>
      </div>
      <div class="chart-wrap" style="height:130px;"><canvas data-field="donut"></canvas></div>
    </div>
  `;
}

// ── Painters ─────────────────────────────────────────────────
function paintKpis(container, trades, allTrades) {
  const c = tradeCounts(trades);
  const decisive = c.tp + c.sl;
  const wr = winrate(trades);
  const pnl = pnlPct(trades);
  const pnlReal = pnlPctReal(trades);
  const dd = maxDrawdown(trades);
  const pf = profitFactor(trades);
  const exp = expectancy(trades);
  const rr = avgRR(trades);
  const plan = planStats(trades);
  const tpStreak = maxStreak(trades, 'TP');
  const tpStreakPct = bestTpStreakPnl(trades);
  const days = activeDays(trades);
  const avgPerDay = days > 0 ? (c.total / days).toFixed(1) : '0';

  // Comparación con el periodo anterior (solo si hay un mes/año seleccionado y
  // ese periodo anterior tiene trades: comparar contra cero no dice nada).
  const prev = allTrades ? prevPeriodTrades(allTrades, dashPeriod) : null;
  const p = prev && prev.trades.length ? prev : null;
  const tWr   = p ? trend(wr, winrate(p.trades), p.ref) : null;
  const tPnl  = p ? trend(pnl, pnlPct(p.trades), p.ref) : null;
  const tReal = p ? trend(pnlReal, pnlPctReal(p.trades), p.ref) : null;
  const tDd   = p ? trend(dd, maxDrawdown(p.trades), p.ref, { lowerIsBetter: true }) : null;
  const tPf   = p ? trend(pf, profitFactor(p.trades), p.ref, { unit: '' }) : null;
  const tExp  = p ? trend(exp.value, expectancy(p.trades).value, p.ref) : null;
  const tPlan = p ? trend(plan.pctInPlan, planStats(p.trades).pctInPlan, p.ref) : null;

  // 2 filas de 5: arriba las 5 clave, abajo las 5 secundarias.
  container.querySelector('#kpis').innerHTML = [
    kpiCard({ label: 'Winrate global', value: wr.toFixed(1) + '%', sub: `${c.tp} TP · ${c.sl} SL · ${c.be} BE`, tone: decisive > 0 && wr < 40 ? 'red' : 'blue', trend: tWr }),
    kpiCard({ label: 'P&L sistema', value: fmtPct(pnl, 1), sub: 'trades al 1%', tone: pnl >= 0 ? 'green' : 'red', trend: tPnl }),
    kpiCard({ label: 'P&L real', value: fmtPct(pnlReal, 1), sub: 'según riesgo real', tone: pnlReal >= 0 ? 'green' : 'red', trend: tReal }),
    kpiCard({ label: 'DD máximo', value: (dd > 0 ? '−' : '') + dd.toFixed(1) + '%', sub: 'equity combinada', tone: 'red', trend: tDd }),
    kpiCardComposite({ label: 'Racha TP máx', primary: tpStreak, secondary: 'TP · ' + fmtPct(tpStreakPct, 1), sub: 'consecutivos · % sistema', tone: 'green' }),
    // Mismos umbrales que la leyenda de la tabla de pares: >2 verde · 1.5-2 naranja.
    kpiCard({ label: 'Profit factor', value: decisive ? (isFinite(pf) ? fmtNum(pf) : '∞') : '–', sub: 'bruto ganado / bruto perdido', tone: !decisive ? 'blue' : pf >= 2 ? 'green' : pf >= 1.5 ? 'orange' : 'red', trend: tPf }),
    kpiCard({ label: 'Esperanza / trade', value: decisive ? fmtPct(exp.value, 2) : '–', sub: decisive ? `media TP ${fmtPct(exp.avgWin, 1)} · media SL −${fmtPctNoSign(exp.avgLoss)}` : 'sin trades decisivos', tone: exp.value >= 0 ? 'green' : 'red', trend: tExp }),
    kpiCard({ label: 'RR medio', value: rr > 0 ? '1:' + fmtNum(rr) : '–', sub: rr > 0 ? 'R media ganada en los TP' : 'sin TP todavía', tone: 'blue' }),
    kpiCard({ label: 'Adherencia al plan', value: plan.total ? plan.pctInPlan.toFixed(0) + '%' : '–', sub: plan.total ? `${plan.inPlan} dentro · ${plan.outOfPlan} fuera` : 'sin trades marcados', tone: !plan.total ? 'blue' : plan.pctInPlan >= 80 ? 'green' : plan.pctInPlan >= 60 ? 'orange' : 'red', trend: tPlan }),
    kpiCard({ label: 'Días activos', value: days, sub: `${c.total} trades · ${avgPerDay}/día`, tone: 'purple' }),
  ].join('');
}

function paintEquity(container, trades) {
  const curve = perfMode === 'real' ? equityCurveReal : equityCurve;
  // Con una sola estrategia, la curva global ES la suya: una sola línea.
  const datasets = [
    { key: 'ALL', label: MULTI_SHEET ? 'Global' : STRATEGIES[SHEETS[0]].label, data: curve(trades) },
    ...(MULTI_SHEET ? SHEETS.map(k => ({ key: k, label: STRATEGIES[k].label, data: curve(trades.filter(t => t.sheet === k)) })) : []),
  ];
  createEquity(container.querySelector('#equityChart'), datasets);
}

// Semáforo del día: ¿puede operar hoy? SOLO reglas de trading (SL, límites,
// venganza…) — el checklist va en su propio chip al lado, porque son cosas
// distintas y antes "Precaución" tapaba el "Checklist pendiente".
// Siempre evalúa HOY sobre todos los trades (el filtro mes/año no le afecta).
const SEMAFORO = {
  ok:   { dot: '🟢', label: 'Vía libre' },
  warn: { dot: '🟠', label: 'Precaución' },
  stop: { dot: '🔴', label: 'Hoy no se opera' },
};
function semaforoPill(allTrades) {
  const s = todayStatus(allTrades);
  const title = (s.reasons.length ? `Hoy: ${s.reasons.join(' · ')}` : 'Sin incidencias hoy — respeta tu plan')
    + ' · Pulsa para ver el Diagnóstico';
  const cfg = SEMAFORO[s.level];
  // Enlace al Diagnóstico: el semáforo te dice "algo pasa"; el clic te lleva al porqué.
  return `<a class="semaforo ${s.level}" href="#/diagnostico" title="${escapeHtml(title)}">${cfg.dot} ${cfg.label}</a>`;
}

// Chip del checklist: siempre visible (salvo viewAs) y siempre pulsable.
// Pendiente = gris llamando a la acción · Hecho = verde discreto.
function checklistChip() {
  if (state.viewAsUid) return '';
  const hecho = checklistCompleto();
  return `<button class="chk-chip ${hecho ? 'done' : 'pending'}" id="semaforoChk"
            title="${hecho ? 'Checklist de esta sesión completado — pulsa para verlo' : 'Pulsa para abrir el checklist pre-sesión'}">
            ${hecho ? '✓ Checklist' : '☐ Checklist pendiente'}
          </button>`;
}

// ── Checklist pre-sesión (modal) ─────────────────────────────
// El checklist ya no ocupa el dashboard: vive en la pastilla del semáforo.
// Al pulsar "Checklist pendiente" se abre este modal; al marcar los 5 puntos
// se cierra solo y el semáforo pasa a verde. El estado se guarda por TRAMO
// (currentChecklistKey): se reactiva a medianoche y en las aperturas de
// Londres y NY, porque hay quien opera dos sesiones.
function openChecklistModal(container) {
  const tramoKey = currentChecklistKey();
  const dailyKey = dailyChecklistKey();
  const tramoDone = storage.getChecklist(tramoKey);
  const dailyDone = storage.getChecklist(dailyKey);
  const marcado = (it, i) => (it.daily ? dailyDone[i] : tramoDone[i]);
  // SIEMPRE se muestran los 5 puntos. Los diarios ("he dormido bien") ya
  // respondidos hoy salen pre-marcados — nunca se ocultan: si desaparecieran,
  // el alumno no sabría por qué (pasó: se marcó tras medianoche y "no estaba").
  const body = `
    <div class="card-sub" style="margin-bottom:14px;">
      Marca los puntos antes de operar. Se reactiva cada día y en las aperturas de Londres y Nueva York.
    </div>
    <div class="checklist-items" style="flex-direction:column;gap:12px;">
      ${CHECKLIST_ITEMS.map((it, i) => `
        <label class="chk-item ${marcado(it, i) ? 'checked' : ''}">
          <input type="checkbox" data-chk="${i}" ${marcado(it, i) ? 'checked' : ''}>
          <span>${it.text}${it.daily ? ' <small style="color:var(--dim);">(una vez al día)</small>' : ''}</span>
        </label>`).join('')}
    </div>`;
  openModal({
    title: 'Checklist pre-sesión',
    body,
    actions: [{ label: 'Cerrar', onClick: close => { close(); render(container); } }],
  });
  const root = document.getElementById('modal-root');
  root.querySelectorAll('[data-chk]').forEach(input => {
    input.addEventListener('change', () => {
      const i = +input.dataset.chk;
      const esDiario = CHECKLIST_ITEMS[i].daily;
      const key = esDiario ? dailyKey : tramoKey;
      const d = storage.getChecklist(key);
      d[i] = input.checked;
      storage.setChecklist(key, d);
      input.closest('.chk-item').classList.toggle('checked', input.checked);
      if (checklistCompleto()) {
        closeModal();
        render(container);   // semáforo a verde al instante
      }
    });
  });
}

// Año que muestra el gráfico mensual, o null = todo el histórico.
// Este gráfico NUNCA se estrecha a un mes: con un mes elegido enseña el año
// entero de ese mes — una sola barra no cuenta nada.
function monthlyChartYear() {
  const { from, to } = dashPeriod;
  if (from === 'all' && to === 'all') return null;
  const yFrom = from !== 'all' ? from.substring(0, 4) : null;
  const yTo = to !== 'all' ? to.substring(0, 4) : null;
  if (yFrom && yTo) return yFrom === yTo ? yFrom : null;   // rango que cruza años → todo
  return yFrom || yTo;
}

function paintMonthly(container, allTrades) {
  const year = monthlyChartYear();
  const scoped = year ? allTrades.filter(t => t.date.startsWith(year)) : allTrades;
  const data = monthlyPnl(scoped);
  // Con varios años a la vista, la etiqueta lleva el año: si no, salen dos
  // "Ene" idénticos (2025 y 2026) imposibles de distinguir.
  const multiYear = new Set(data.map(d => d.month.split('-')[0])).size > 1;
  const labels = data.map(d => {
    const [y, m] = d.month.split('-');
    return MONTHS_ES_SHORT[+m - 1] + (multiYear ? ' ' + y.slice(2) : '');
  });
  const values = data.map(d => +(perfMode === 'real' ? d.pnlReal : d.pnl).toFixed(2));
  createBar(container.querySelector('#monthlyChart'), labels, values);
}

function paintStrategy(container, sheet, trades) {
  const sub = trades.filter(t => t.sheet === sheet);
  const card = container.querySelector(`[data-strat="${sheet}"]`);
  if (!card) return;
  const c = tradeCounts(sub);
  const subPnl = pnlPct(sub);
  const subPnlReal = pnlPctReal(sub);
  const wrEl = card.querySelector('[data-field="wr"]');
  const subWr = winrate(sub);
  wrEl.textContent = fmtPctNoSign(subWr);
  // Winrate: cian de marca siempre, rojo si < 40%.
  wrEl.style.color = (c.tp + c.sl) > 0 && subWr < 40 ? 'var(--red)' : 'var(--cyan)';
  const pnlEl = card.querySelector('[data-field="pnl"]');
  pnlEl.textContent = fmtPct(subPnl, 1);
  pnlEl.style.color = subPnl >= 0 ? 'var(--green)' : 'var(--red)';
  const pnlRealEl = card.querySelector('[data-field="pnlReal"]');
  pnlRealEl.textContent = fmtPct(subPnlReal, 1);
  pnlRealEl.style.color = subPnlReal >= 0 ? 'var(--green)' : 'var(--red)';
  const subPf = profitFactor(sub);
  card.querySelector('[data-field="pf"]').textContent = isFinite(subPf) ? fmtNum(subPf) : '∞';
  card.querySelector('[data-field="sub"]').textContent = `${sub.length} trades · ${STRAT_LABELS[sheet]}`;
  createDonut(card.querySelector('[data-field="donut"]'), c.tp, c.sl, c.be);
}

function paintTiming(container, trades) {
  createHourBar(container.querySelector('#hourChart'), wrByHour(trades));
  createDayBar(container.querySelector('#dayChart'), wrByDay(trades));
  renderHeatmap(container.querySelector('#heatmap'), trades);
}

function paintDirectionAndPairs(container, trades) {
  const ls = SHEETS.map(sheet => ({
    label: sheet.charAt(0) + sheet.slice(1).toLowerCase(),
    ...longVsShort(trades.filter(t => t.sheet === sheet)),
  }));
  createLongShort(container.querySelector('#lsChart'), ls);
  if (!container.querySelector('#pairsTbody')) return;   // sin tabla de pares

  // Pairs table — split EUR/USD by strategy when present in both ZONAS and LIQUIDEZ
  const pairKey = t => {
    let p = t.pair || '';
    if (p === 'EUR/USD' && t.sheet === 'LIQUIDEZ') return 'EUR/USD (Liquidez)';
    if (p === 'EUR/USD' && t.sheet === 'ZONAS') return 'EUR/USD (Zonas)';
    return p || '–';
  };
  const stats = statsByGroup(trades, pairKey).filter(p => p.total >= 1).sort((a, b) => b.total - a.total);
  container.querySelector('#pairsTbody').innerHTML = stats.map(p => {
    const wrColor = p.wr >= 50 ? 'var(--green)' : 'var(--red)';
    const pnlColor = p.pnl >= 0 ? 'var(--green)' : 'var(--red)';
    const pnlRealColor = p.pnlReal >= 0 ? 'var(--green)' : 'var(--red)';
    const pfColor = p.pf >= 2.0 ? 'var(--green)' : p.pf >= 1.5 ? 'var(--orange)' : 'var(--red)';
    const signal = p.wr >= 50 ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">!</span>';
    return `<tr>
      <td>${escapeHtml(p.key)}</td>
      <td>${p.total}</td>
      <td style="color:${wrColor}">${p.wr.toFixed(0)}%</td>
      <td style="color:${pnlColor}">${fmtPct(p.pnl, 1)}</td>
      <td style="color:${pnlRealColor}">${fmtPct(p.pnlReal, 1)}</td>
      <td style="color:${pfColor};font-weight:500;">${isFinite(p.pf) ? p.pf.toFixed(2) : '∞'}</td>
      <td>${signal}</td>
    </tr>`;
  }).join('') + `<tr style="border-top:1px solid var(--border);">
    <td colspan="7" style="color:var(--muted);font-size:10px;font-family:var(--mono);line-height:1.8;">
      PF: <span style="color:var(--green);font-weight:600;">&gt;2.0 muy bueno</span> ·
      <span style="color:var(--orange);font-weight:600;">1.5–2.0 bueno</span> ·
      <span style="color:var(--red);font-weight:600;">&lt;1.5 mejorable</span>
    </td>
  </tr>`;
}

// Columnas de la tabla de rachas: Global, cada estrategia y los pares de Zonas.
// Con una sola estrategia, solo una columna con su nombre (sería = Global).
function streakGroups(trades) {
  if (!MULTI_SHEET) return [{ label: STRATEGIES[SHEETS[0]].label, color: `var(--${STRAT_CLS[SHEETS[0]]})`, trades }];
  const zonasPair = p => trades.filter(t => t.sheet === 'ZONAS' && t.pair === p);
  return [
    { label: 'Global', trades },
    ...['LIQUIDEZ', 'NASDAQ', 'ZONAS'].filter(hasSheet).map(k => ({
      label: STRATEGIES[k].label, color: `var(--${STRAT_CLS[k]})`, trades: trades.filter(t => t.sheet === k),
    })),
    ...(hasSheet('ZONAS') ? [
      { label: 'GBP/USD', color: 'var(--pair-gbp)', trades: zonasPair('GBP/USD') },
      { label: 'EUR/USD', color: 'var(--pair-eur)', trades: zonasPair('EUR/USD') },
      { label: 'XAU/USD', color: 'var(--pair-gold)', trades: zonasPair('XAU/USD') },
    ] : []),
  ];
}

function paintStreaks(container, trades) {
  const groups = streakGroups(trades).map(g => g.trades);
  const tpStreak = groups.map(g => maxStreak(g, 'TP'));
  const tpStreakPct = groups.map(g => bestTpStreakPnl(g));
  const slStreak = groups.map(g => maxStreak(g, 'SL'));
  const dd = groups.map(g => maxDrawdown(g));

  const rows = [
    { label: 'Racha máx TP consecutivos', vals: tpStreak.map(v => v + ' TP'), color: 'var(--green)' },
    { label: '% acumulado racha TP', vals: tpStreakPct.map(v => fmtPct(v, 1)), color: 'var(--green)' },
    { label: 'Racha máx SL consecutivos', vals: slStreak.map(v => v + ' SL'), color: 'var(--red)' },
    { label: 'DD máximo acumulado', vals: dd.map(v => (v > 0 ? '−' : '') + v.toFixed(1) + '%'), color: 'var(--red)' },
  ];
  container.querySelector('#streakTbody').innerHTML = rows.map(r => `
    <tr>
      <td style="color:var(--muted);font-family:var(--mono);font-size:11px;">${r.label}</td>
      ${r.vals.map((v, i) => `<td style="color:${r.color};font-weight:${i === 0 ? '600' : '500'};">${v}</td>`).join('')}
    </tr>
  `).join('');
}

function paintDurations(container, trades) {
  // Con una sola estrategia, su fila sería igual a la Global: solo la Global.
  const rows = MULTI_SHEET
    ? SHEETS.map(k => [k, durationStats(trades.filter(t => t.sheet === k)), STRAT_CLS[k]])
    : [];
  const global = durationStats(trades);
  container.querySelector('#durTbody').innerHTML = rows.map(([name, d, cls]) => `
    <tr>
      <td><span class="strat-pill ${cls}">${name}</span></td>
      <td>${d.avg} min</td>
      <td style="color:var(--green)">${d.tp} min</td>
      <td style="color:var(--red)">${d.sl} min</td>
      <td>${d.max} min</td>
      <td>${d.min} min</td>
    </tr>
  `).join('') + `
    <tr style="background:var(--hover);">
      <td><strong>Global</strong></td>
      <td><strong>${global.avg} min</strong></td>
      <td style="color:var(--green)"><strong>${global.tp} min</strong></td>
      <td style="color:var(--red)"><strong>${global.sl} min</strong></td>
      <td>${global.max} min</td>
      <td>${global.min} min</td>
    </tr>
  `;
}


// Dashboard marketing Hoffman Cable : rendu et interactions.
import { demoData } from './demo.js';
import { buildInsights, delta, opportunities } from './insights.js';
import { fmt, frDate, frRange } from './format.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, area = localStorage) { try { return area.getItem(k); } catch { return null; } },
  set(k, v, area = localStorage) { try { v == null ? area.removeItem(k) : area.setItem(k, v); } catch { /* stockage indisponible */ } },
};

const BRAND = '#7a1620';
const CMP = '#9a9a9a';
const INK3 = 'rgba(18,18,18,0.55)';
const GRID = 'rgba(18,18,18,0.07)';

const state = {
  period: store.get('hc.period') || 'week',
  cmp: store.get('hc.cmp') || 'prev',
  mode: 'demo',
  key: store.get('hc.key', sessionStorage),
  metric: 'revenue',
  data: null,
  liveAvailable: false,
};
const charts = {};
let timer = null;

/* ---------- Chargement ---------- */

async function load({ fresh = false } = {}) {
  $('#main').classList.add('loading');
  $('#errors').innerHTML = '';
  try {
    if (state.mode === 'live') {
      const res = await fetch(`/api/data?range=${state.period}${fresh ? '&fresh=1' : ''}`, { headers: { 'x-dashboard-key': state.key || '' } });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) { setMode('demo'); store.set('hc.key', null, sessionStorage); openLogin('Mot de passe refusé.'); return; }
      if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
      state.data = body;
    } else {
      state.data = demoData(state.period);
    }
    render();
  } catch (e) {
    $('#errors').innerHTML = `<div class="error-note"><strong>Impossible de charger les données réelles.</strong> ${esc(e.message)}</div>`;
    if (state.mode === 'live') { setMode('demo'); state.data = demoData(state.period); render(); }
  } finally {
    $('#main').classList.remove('loading');
  }
}

function setMode(mode) {
  state.mode = mode;
  const badge = $('#mode-badge');
  badge.textContent = mode === 'live' ? 'Données réelles' : 'Démo';
  badge.className = `mode ${mode}`;
  $('#mode-btn').textContent = mode === 'live' ? 'Revenir à la démo' : 'Données réelles';
  $('#demo-note').hidden = mode === 'live';
  clearInterval(timer);
  if (mode === 'live') timer = setInterval(() => load(), 5 * 60 * 1000);
}

/* ---------- Petits composants ---------- */

const KPI_DEFS = {
  revenue: { label: 'Chiffre d\'affaires', f: fmt.eur, tag: 'Shopify', series: 'revenue', lead: true },
  orders: { label: 'Commandes', f: fmt.int, tag: 'Shopify', series: 'orders', lead: true },
  aov: { label: 'Panier moyen', f: fmt.eur, tag: 'Shopify' },
  convRate: { label: 'Taux de conversion', f: (v) => fmt.pct(v, 2), tag: 'Shopify / GA4' },
  sessions: { label: 'Sessions', f: fmt.int, tag: 'GA4', series: 'sessions' },
  organicSessions: { label: 'Sessions SEO', f: fmt.int, tag: 'GA4' },
  gscClicks: { label: 'Clics Google', f: fmt.int, tag: 'Search Console', series: 'clicks' },
  gscPosition: { label: 'Position moyenne', f: (v) => fmt.dec(v), tag: 'Search Console', inverse: true, abs: true, series: 'position' },
  gscImpressions: { label: 'Impressions', f: fmt.int, tag: 'Search Console', series: 'impressions' },
  gscCtr: { label: 'CTR Google', f: (v) => fmt.pct(v, 2), tag: 'Search Console' },
  refundRate: { label: 'Taux de remboursement', f: fmt.pct, tag: 'Shopify', inverse: true },
  newCustomers: { label: 'Nouveaux clients', f: fmt.int, tag: 'Shopify' },
  users: { label: 'Utilisateurs', f: fmt.int, tag: 'GA4', series: 'users' },
  engagementRate: { label: 'Taux d\'engagement', f: fmt.pct, tag: 'GA4' },
  avgSessionDuration: { label: 'Durée moyenne', f: fmt.duration, tag: 'GA4' },
  pagesPerSession: { label: 'Pages / session', f: (v) => fmt.dec(v), tag: 'GA4' },
  cartAbandon: { label: 'Abandon panier', f: (v) => fmt.pct(v, 0), tag: 'GA4', inverse: true },
};

function deltaBadge(k, def) {
  const cmp = state.cmp;
  if (!k || k.cur == null || k[cmp] == null || !k[cmp]) return '<span class="delta flat">n.d.</span>';
  let txt, good;
  if (def.abs) {
    const diff = k.cur - k[cmp];
    good = def.inverse ? diff < 0 : diff > 0;
    txt = `${diff > 0 ? '+' : '−'}${fmt.dec(Math.abs(diff))}`;
    if (Math.abs(diff) < 0.05) return `<span class="delta flat">= ${fmt.dec(0)}</span>`;
  } else {
    const d = delta(k, cmp);
    if (Math.abs(d) < 0.5) return '<span class="delta flat">= 0 %</span>';
    good = def.inverse ? d < 0 : d > 0;
    txt = `${d > 0 ? '+' : '−'}${fmt.pct(Math.abs(d), Math.abs(d) < 10 ? 1 : 0)}`;
  }
  const arrow = txt.startsWith('+') ? '▲' : '▼';
  return `<span class="delta ${good ? 'up' : 'down'}"><span aria-hidden="true">${arrow}</span>${txt}</span>`;
}

function sparkline(values) {
  const v = (values || []).filter((x) => x != null);
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 100},${28 - ((x - min) / span) * 24}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${BRAND}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}

function tile(key) {
  const def = KPI_DEFS[key];
  const k = state.data.kpi[key];
  const cmpVal = k?.[state.cmp];
  const series = def.series ? state.data.series.cur?.[def.series] : null;
  return `<div class="card kpi${def.lead ? ' lead' : ''}">
    <div class="label"><span>${def.label}</span><span class="tag">${def.tag}</span></div>
    <div class="value num">${def.f(k?.cur)}</div>
    <div class="foot">${deltaBadge(k, def)}<span class="num">${state.cmp === 'yoy' ? 'N-1' : 'avant'} : ${def.f(cmpVal)}</span></div>
    ${series ? sparkline(series) : ''}
  </div>`;
}

function table(el, cols, rows, { highlight } = {}) {
  if (!rows.length) { el.innerHTML = '<tbody><tr><td class="muted">Aucune donnée sur la période.</td></tr></tbody>'; return; }
  el.innerHTML = `<thead><tr>${cols.map((c) => `<th class="${c.r ? 'r' : ''}" scope="col">${c.h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((row) => `<tr class="${highlight?.(row) ? 'hl' : ''}">${cols.map((c) => `<td class="${c.r ? 'r' : ''}">${c.v(row)}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

const pos = (p) => `<span class="pos ${p <= 3 ? 'top3' : p <= 10 ? 'p1' : ''}">${fmt.dec(p)}</span>`;
const diffCell = (cur, prev) => {
  if (prev == null) return '<span class="muted">—</span>';
  const d = cur - prev;
  if (!d) return '<span class="muted">=</span>';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${fmt.int(Math.abs(d))}</span>`;
};
const pctDelta = (cur, prev) => {
  if (!prev) return '<span class="muted">—</span>';
  const d = ((cur - prev) / prev) * 100;
  if (Math.abs(d) < 0.5) return '<span class="muted">=</span>';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${fmt.pct(Math.abs(d), 0)}</span>`;
};
const shortUrl = (u) => esc(String(u).replace(/^https?:\/\/[^/]+/, '') || '/');

/* ---------- Graphiques ---------- */

function externalTooltip(fmtVal) {
  return (ctx) => {
    const { chart, tooltip } = ctx;
    const box = chart.canvas.parentNode;
    let tip = box.querySelector('.tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; box.appendChild(tip); }
    if (tooltip.opacity === 0) { tip.style.opacity = 0; return; }
    const i = tooltip.dataPoints[0].dataIndex;
    const cur = state.data.series.cur.dates[i];
    const cmpSeries = state.data.series[state.cmp];
    const cmpDate = cmpSeries?.dates?.[i];
    tip.innerHTML = `<div class="t">${frDate(cur, { weekday: 'short', day: 'numeric', month: 'short' })}</div>` +
      tooltip.dataPoints.map((p) => `<div class="row"><span><i class="${p.datasetIndex ? 'cmp' : ''}"></i>${p.datasetIndex ? frDate(cmpDate, { day: 'numeric', month: 'short', year: '2-digit' }) : 'Période'}</span><b class="num">${fmtVal(p.raw)}</b></div>`).join('');
    const x = Math.min(tooltip.caretX + 12, box.clientWidth - tip.offsetWidth - 4);
    tip.style.left = `${Math.max(0, x)}px`;
    tip.style.top = `${Math.max(0, tooltip.caretY - tip.offsetHeight - 10)}px`;
    tip.style.opacity = 1;
  };
}

function lineChart(id, metric, fmtVal, { reverse = false } = {}) {
  const s = state.data.series;
  const cur = s.cur?.[metric];
  const cmp = s[state.cmp]?.[metric];
  const labels = (s.cur?.dates || []).map((d) => frDate(d));
  const isDay = state.data.range.key === 'day';
  const datasets = [{
    label: 'Période', data: cur || [], borderColor: BRAND, backgroundColor: BRAND, borderWidth: 2, tension: 0.25,
    pointRadius: (cur || []).map((_, i, a) => (isDay && i === a.length - 1 ? 5 : 0)), pointHoverRadius: 5,
    pointBorderColor: '#fff', pointBorderWidth: 2, spanGaps: true,
  }];
  if (cmp) datasets.push({ label: 'Comparaison', data: cmp, borderColor: CMP, borderDash: [5, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25, spanGaps: true });

  charts[id]?.destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: false, external: externalTooltip(fmtVal) } },
      scales: {
        x: { grid: { display: false }, border: { color: 'rgba(18,18,18,0.2)' }, ticks: { color: INK3, maxRotation: 0, autoSkipPadding: 18, font: { family: 'Assistant', size: 12 } } },
        y: { reverse, beginAtZero: !reverse, grid: { color: GRID }, border: { display: false }, ticks: { color: INK3, maxTicksLimit: 5, font: { family: 'Assistant', size: 12 }, callback: (v) => fmt.compact(v) } },
      },
    },
  });
}

function legendHtml() {
  const r = state.data.range;
  if (r.key === 'day') return `<span><i></i>14 derniers jours (point = ${frDate(r.cur.start)})</span>`;
  const other = state.cmp === 'yoy' ? r.yoy : r.prev;
  return `<span><i></i>${frRange(r.cur)}</span><span><i class="cmp"></i>${state.cmp === 'yoy' ? 'N-1' : 'Période précédente'} : ${frRange(other)}</span>`;
}

const METRICS = [
  ['revenue', 'Chiffre d\'affaires', fmt.eur], ['orders', 'Commandes', fmt.int], ['sessions', 'Sessions', fmt.int],
  ['users', 'Utilisateurs', fmt.int], ['clicks', 'Clics SEO', fmt.int], ['impressions', 'Impressions SEO', fmt.int],
];

function renderMainChart() {
  const tabs = $('#metric-tabs');
  tabs.innerHTML = METRICS.map(([k, l]) => `<button class="tab" role="tab" type="button" data-m="${k}" aria-selected="${k === state.metric}">${l}</button>`).join('');
  const [, , f] = METRICS.find((m) => m[0] === state.metric);
  $('#main-legend').innerHTML = legendHtml();
  lineChart('main-chart', state.metric, f);
}

/* ---------- Rendu ---------- */

function render() {
  const d = state.data;
  const r = d.range;
  const other = state.cmp === 'yoy' ? r.yoy : r.prev;

  document.querySelectorAll('#period button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === state.period));
  document.querySelectorAll('#compare button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === state.cmp));
  $('#range-label').innerHTML = `<b>${esc(r.desc)}</b> · ${frRange(r.cur)}`;
  $('#cmp-hint').textContent = `Comparé à ${state.cmp === 'yoy' ? 'N-1' : 'la période précédente'} : ${frRange(other)}`;
  $('#evo-hint').textContent = r.key === 'day' ? 'Vue jour : contexte des 14 derniers jours' : 'Courbe pleine = période, pointillés = comparaison';
  $('#updated').textContent = `Mis à jour à ${new Date(d.generatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  const active = $('#active-now');
  active.hidden = d.activeNow == null;
  active.textContent = `${fmt.int(d.activeNow)} visiteur${d.activeNow > 1 ? 's' : ''} en ce moment`;

  $('#kpis').innerHTML = ['revenue', 'orders', 'aov', 'convRate', 'sessions', 'organicSessions', 'gscClicks', 'gscPosition'].map(tile).join('');

  // Insights
  const ins = buildInsights(d, state.cmp);
  const ICO = { good: '↑', bad: '↓', warn: '!', info: 'i' };
  $('#insights').innerHTML = ins.length ? ins.map((i) => `<div class="insight ${i.level}"><span class="ico" aria-hidden="true">${ICO[i.level]}</span><div><h4>${esc(i.title)}</h4><p>${esc(i.detail)}</p></div></div>`).join('')
    : '<p class="muted">Rien de notable sur cette période : les indicateurs sont stables.</p>';

  renderMainChart();

  // Canaux
  const totalSessions = d.channels.reduce((a, c) => a + c.sessions, 0) || 1;
  const maxShare = Math.max(...d.channels.map((c) => c.sessions), 1);
  table($('#channels'), [
    { h: 'Canal', v: (c) => esc(c.name === 'Organic Search' ? 'Organic Search (SEO)' : c.name) },
    { h: 'Sessions', r: 1, v: (c) => `<span class="share" style="width:${Math.round((c.sessions / maxShare) * 60)}px"></span>${fmt.int(c.sessions)}` },
    { h: 'Part', r: 1, v: (c) => fmt.pct((c.sessions / totalSessions) * 100, 0) },
    { h: 'vs préc.', r: 1, v: (c) => pctDelta(c.sessions, c.sessionsPrev) },
    { h: 'Achats', r: 1, v: (c) => fmt.int(c.purchases) },
    { h: 'Conv.', r: 1, v: (c) => fmt.pct(c.sessions ? (c.purchases / c.sessions) * 100 : 0, 2) },
    { h: 'CA', r: 1, v: (c) => fmt.eur0(c.revenue) },
  ], d.channels, { highlight: (c) => c.name === 'Organic Search' });

  // Entonnoir
  const k = d.kpi;
  const steps = [['Sessions', k.sessions.cur], ['Ajouts au panier', k.addToCarts.cur], ['Paiements commencés', k.checkouts.cur], ['Achats', k.purchases.cur]];
  const top = steps[0][1] || 1;
  $('#funnel').innerHTML = steps.map(([l, v], i) => {
    const rate = i ? (steps[i - 1][1] ? (v / steps[i - 1][1]) * 100 : 0) : null;
    return `<div class="step"><span>${l}</span><div class="bar" title="${fmt.pct((v / top) * 100, 1)} des sessions"><div style="width:${Math.max(0.5, (v / top) * 100)}%"></div></div><b class="val num">${fmt.int(v)}</b>${rate != null ? `<span class="rate">${fmt.pct(rate, 1)} de l'étape précédente</span>` : ''}</div>`;
  }).join('') + `<p class="muted" style="margin:6px 0 0;font-size:13px">Abandon panier : <b>${fmt.pct(k.cartAbandon.cur, 0)}</b> ${deltaBadge(k.cartAbandon, KPI_DEFS.cartAbandon)}</p>`;

  // SEO
  $('#seo-kpis').innerHTML = ['gscClicks', 'gscImpressions', 'gscCtr', 'gscPosition'].map(tile).join('');
  $('#seo-legend').innerHTML = legendHtml();
  lineChart('seo-chart', 'clicks', fmt.int);
  table($('#opps'), [
    { h: 'Requête', v: (q) => esc(q.query) },
    { h: 'Pos.', r: 1, v: (q) => pos(q.position) },
    { h: 'Impr.', r: 1, v: (q) => fmt.int(q.impressions) },
    { h: 'CTR', r: 1, v: (q) => fmt.pct(q.ctr) },
    { h: 'Gain potentiel', r: 1, v: (q) => `<b>+${fmt.int(q.potential)} clics</b>` },
  ], opportunities(d.queries).slice(0, 8));
  table($('#queries'), [
    { h: 'Requête', v: (q) => esc(q.query) },
    { h: 'Clics', r: 1, v: (q) => fmt.int(q.clicks) },
    { h: 'vs préc.', r: 1, v: (q) => diffCell(q.clicks, q.clicksPrev) },
    { h: 'Impr.', r: 1, v: (q) => fmt.int(q.impressions) },
    { h: 'CTR', r: 1, v: (q) => fmt.pct(q.ctr) },
    { h: 'Pos.', r: 1, v: (q) => pos(q.position) },
  ], d.queries.slice(0, 12));
  table($('#pages'), [
    { h: 'Page', v: (p) => `<span class="page" title="${esc(p.page)}">${shortUrl(p.page)}</span>` },
    { h: 'Clics', r: 1, v: (p) => fmt.int(p.clicks) },
    { h: 'Impr.', r: 1, v: (p) => fmt.int(p.impressions) },
    { h: 'CTR', r: 1, v: (p) => fmt.pct(p.ctr) },
    { h: 'Pos.', r: 1, v: (p) => pos(p.position) },
  ], d.pages.slice(0, 12));

  // E-commerce
  $('#shop-kpis').innerHTML = ['revenue', 'orders', 'aov', 'refundRate'].map(tile).join('');
  table($('#products'), [
    { h: 'Produit', v: (p) => esc(p.title) },
    { h: 'Qté', r: 1, v: (p) => fmt.int(p.qty) },
    { h: 'CA', r: 1, v: (p) => fmt.eur0(p.revenue) },
  ], d.products.slice(0, 10));
  const nw = k.newCustomers.cur || 0, rt = k.returningCustomers.cur || 0, tot = nw + rt;
  $('#customers').innerHTML = tot ? `
    <div class="value num" style="font-size:30px">${fmt.pct((rt / tot) * 100, 0)} <span class="muted" style="font-size:15px">de clients récurrents</span></div>
    <div class="stack" role="img" aria-label="${nw} nouveaux, ${rt} récurrents"><div class="a" style="width:${(nw / tot) * 100}%"></div><div class="b" style="width:${(rt / tot) * 100}%"></div></div>
    <div class="stack-legend"><span><i style="background:${BRAND}"></i>Nouveaux : <b class="num">${fmt.int(nw)}</b> ${deltaBadge(k.newCustomers, KPI_DEFS.newCustomers)}</span><span><i style="background:#121212"></i>Récurrents : <b class="num">${fmt.int(rt)}</b></span></div>
    <p class="muted" style="font-size:13px;margin:14px 0 0">Clients identifiés uniquement (hors commandes invité).</p>`
    : '<p class="muted">Aucune commande client sur la période.</p>';

  // Audience
  $('#aud-kpis').innerHTML = ['users', 'engagementRate', 'avgSessionDuration', 'pagesPerSession'].map(tile).join('');
  const DEV = { desktop: 'Ordinateur', mobile: 'Mobile', tablet: 'Tablette' };
  table($('#devices'), [
    { h: 'Appareil', v: (x) => esc(DEV[x.name] || x.name) },
    { h: 'Sessions', r: 1, v: (x) => fmt.int(x.sessions) },
    { h: 'vs préc.', r: 1, v: (x) => pctDelta(x.sessions, x.sessionsPrev) },
    { h: 'Achats', r: 1, v: (x) => fmt.int(x.purchases) },
    { h: 'Conv.', r: 1, v: (x) => fmt.pct(x.sessions ? (x.purchases / x.sessions) * 100 : 0, 2) },
  ], d.devices);
  table($('#landing'), [
    { h: 'Page d\'entrée', v: (p) => `<span class="page" title="${esc(p.page)}">${shortUrl(p.page)}</span>` },
    { h: 'Sessions', r: 1, v: (p) => fmt.int(p.sessions) },
    { h: 'Engag.', r: 1, v: (p) => fmt.pct(p.engagementRate, 0) },
    { h: 'Achats', r: 1, v: (p) => fmt.int(p.purchases) },
  ], d.landingPages.slice(0, 10));

  // Sources
  const NAMES = { ga4: 'Google Analytics 4', gsc: 'Search Console', shopify: 'Shopify' };
  const LBL = { ok: 'connecté', error: 'erreur', off: 'non configuré' };
  $('#sources').innerHTML = Object.entries(d.sources).map(([key, s]) => `<li class="st ${s.status}" title="${esc(s.message || '')}">${NAMES[key]} : ${d.mode === 'demo' ? 'démo' : LBL[s.status]}</li>`).join('');
  const errs = Object.entries(d.sources).filter(([, s]) => s.status === 'error');
  if (errs.length) $('#errors').innerHTML = errs.map(([key, s]) => `<div class="error-note"><strong>${NAMES[key]} :</strong> ${esc(s.message)}</div>`).join('');
}

/* ---------- Connexion aux données réelles ---------- */

function openLogin(msg = '') {
  $('#login-err').textContent = msg;
  $('#pwd').value = '';
  $('#login').showModal();
}

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  state.key = $('#pwd').value;
  store.set('hc.key', state.key, sessionStorage);
  $('#login').close();
  setMode('live');
  load({ fresh: true });
});
$('#login-cancel').addEventListener('click', () => $('#login').close());

$('#mode-btn').addEventListener('click', () => {
  if (state.mode === 'live') { setMode('demo'); store.set('hc.key', null, sessionStorage); state.key = null; load(); return; }
  if (!state.liveAvailable) {
    $('#errors').innerHTML = '<div class="error-note"><strong>Données réelles non configurées.</strong> Ajoute DASHBOARD_PASSWORD et les accès GA4 / Search Console / Shopify dans les variables d\'environnement Vercel (voir README).</div>';
    return;
  }
  openLogin();
});

/* ---------- Filtres ---------- */

$('#period').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v || v === state.period) return;
  state.period = v; store.set('hc.period', v); load();
});
$('#compare').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v || v === state.cmp) return;
  state.cmp = v; store.set('hc.cmp', v); render();
});
$('#metric-tabs').addEventListener('click', (e) => {
  const m = e.target.closest('button')?.dataset.m;
  if (!m) return;
  state.metric = m; renderMainChart();
});
$('#refresh').addEventListener('click', () => load({ fresh: true }));

/* ---------- Démarrage ---------- */

(async function init() {
  if (typeof Chart !== 'undefined') Chart.defaults.font.family = 'Assistant, system-ui, sans-serif';
  try {
    const st = await fetch('/api/status').then((r) => (r.ok ? r.json() : null));
    state.liveAvailable = Boolean(st?.liveAvailable);
  } catch { state.liveAvailable = false; }
  if (state.liveAvailable && state.key) setMode('live'); else setMode('demo');
  load();
})();

// Générateur de données de démonstration réalistes pour hoffmancables.shop.
// Produit exactement les mêmes structures que les connecteurs réels, puis passe par normalize().
// Déterministe : une même date donne toujours les mêmes chiffres.
import { buildRange, daysBetween } from './periods.js';
import { normalize } from './normalize.js';

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = hash(seed);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const between = (r, lo, hi) => lo + r() * (hi - lo);

const LAUNCH = Date.UTC(2026, 2, 1); // ouverture de la boutique Shopify (hypothèse démo)
const memo = new Map();

function day(iso) {
  if (memo.has(iso)) return memo.get(iso);
  const r = rng(`hc-${iso}`);
  const t = new Date(`${iso}T12:00:00Z`);
  const months = (t - LAUNCH) / (30 * 864e5);
  const growth = Math.max(0.22, 0.55 + months * 0.06); // montée en puissance du SEO
  const wd = [0.45, 1.05, 1.1, 1.08, 1.04, 0.95, 0.55][t.getUTCDay()]; // B2B : creux le week-end
  const august = t.getUTCMonth() === 7 ? 0.6 : 1;
  const sessions = Math.round(150 * growth * wd * august * between(r, 0.85, 1.15));
  const users = Math.round(sessions * between(r, 0.74, 0.82));
  const purchases = Math.max(0, Math.round(sessions * between(r, 0.008, 0.02)));
  const aov = between(r, 150, 235);
  const impressions = Math.round(4200 * growth * (0.6 + wd * 0.4) * between(r, 0.88, 1.12));
  const ctr = between(r, 0.016, 0.024);
  const d = {
    sessions, users,
    newUsers: Math.round(users * between(r, 0.62, 0.72)),
    engagementRate: between(r, 0.52, 0.64),
    avgSessionDuration: between(r, 115, 170),
    pageViews: Math.round(sessions * between(r, 2.7, 3.5)),
    addToCarts: Math.round(sessions * between(r, 0.06, 0.09)),
    purchases,
    revenue: purchases * aov,
    orders: purchases + (r() < 0.3 ? 1 : 0), // Shopify voit un peu plus que GA4 (consentement cookies)
    aov,
    impressions,
    clicks: Math.round(impressions * ctr),
    position: between(r, 15.5, 19) - Math.min(4, growth * 1.4),
    refunded: r() < 0.06 ? aov * 0.5 : 0,
  };
  d.checkouts = Math.max(d.purchases, Math.round(d.addToCarts * between(r, 0.38, 0.52)));
  d.shopRevenue = d.revenue + (d.orders - d.purchases) * aov;
  memo.set(iso, d);
  return d;
}

const sumOver = (p, f) => daysBetween(p.start, p.end).reduce((acc, d) => acc + f(day(d)), 0);
const tri = (range, f) => ({ cur: f(range.cur), prev: f(range.prev), yoy: f(range.yoy) });

const CHANNELS = [
  ['Organic Search', 0.55, 0.018], ['Direct', 0.22, 0.016], ['Organic Shopping', 0.06, 0.012],
  ['Referral', 0.08, 0.01], ['Organic Social', 0.04, 0.004], ['Unassigned', 0.05, 0.002],
];
const DEVICES = [['desktop', 0.63, 1.25], ['mobile', 0.34, 0.55], ['tablet', 0.03, 0.8]];

const QUERIES = [
  ['câble u1000 r2v', 1, 6.2], ['cable ar2v', 0.8, 7.9], ['h07rn-f au mètre', 0.75, 5.1],
  ['câble électrique au mètre', 0.7, 11.4], ['cosse tubulaire cuivre', 0.55, 8.6],
  ['baes brio+', 0.5, 4.3], ['câble cr1-c1', 0.45, 9.8], ['liycy', 0.42, 12.6],
  ['h07v-k 6mm2', 0.4, 6.9], ['câble aluminium u1000 ar2v 4x35', 0.36, 3.4],
  ['manchon à butée cuivre', 0.3, 10.2], ['câble sans halogène lszh', 0.3, 14.8],
  ['fibre optique unitube', 0.26, 17.5], ['piquet de terre cuivre', 0.25, 8.1],
  ['h05vv-f 3g1.5', 0.24, 13.3], ['cable arvfv', 0.22, 6.4], ['gaine thermorétractable plf', 0.2, 18.9],
  ['différence r2v et ar2v', 0.19, 4.8], ['section câble selon ampérage', 0.18, 21.6],
  ['câble s/ftp cat 7', 0.16, 15.2],
];
const PAGES = [
  ['/', 0.18], ['/products/cable-electrique-cuivre-rigide-u-1000-r2v', 0.14],
  ['/products/cable-electrique-aluminium-rigide-u-1000-ar2v', 0.11], ['/collections/cosses', 0.07],
  ['/products/cable-souple-h07rn-f', 0.08], ['/blogs/le-guide-du-cable/difference-r2v-ar2v', 0.07],
  ['/collections/eclairage-de-securite-baes', 0.05], ['/products/cable-resistant-au-feu-cr1-c1', 0.05],
  ['/blogs/le-guide-du-cable/choisir-section-cable', 0.05], ['/products/cable-de-commande-liycy', 0.04],
];
const PRODUCTS = [
  ['Câble U-1000 R2V cuivre (au mètre)', 0.21, 0.62], ['Câble U-1000 AR2V aluminium (au mètre)', 0.17, 2.4],
  ['Câble souple H07RN-F (au mètre)', 0.12, 1.3], ['BAES BRIO+ 45 lm', 0.09, 46],
  ['Câble CR1-C1 résistant au feu', 0.08, 2.1], ['Cosses tubulaires cuivre CNF (lot)', 0.07, 12],
  ['Câble LiYCY blindé (au mètre)', 0.06, 1.4], ['Fil H07V-K (au mètre)', 0.05, 0.38],
  ['Piquet de terre cuivre 1,5 m', 0.04, 24], ['Panneau de brassage 19" Cat 6A', 0.03, 92],
];

function demoGA4(range) {
  const k = (f) => tri(range, (p) => sumOver(p, f));
  const avg = (f) => tri(range, (p) => sumOver(p, (d) => f(d) * d.sessions) / Math.max(1, sumOver(p, (d) => d.sessions)));
  const series = (p) => {
    const days = daysBetween(p.start, p.end);
    return {
      dates: days, sessions: days.map((d) => day(d).sessions), users: days.map((d) => day(d).users),
      revenue: days.map((d) => day(d).revenue), orders: days.map((d) => day(d).purchases),
    };
  };
  const split = (list, p, salt) => {
    const total = sumOver(p, (d) => d.sessions);
    const purchases = sumOver(p, (d) => d.purchases);
    const revenue = sumOver(p, (d) => d.revenue);
    const r = rng(`${salt}-${p.start}-${p.end}`);
    const rows = list.map(([name, share, w]) => {
      const sh = share * between(r, 0.85, 1.15);
      return { name, sessions: Math.round(total * sh), weight: sh * w * between(r, 0.7, 1.3) };
    });
    const wsum = rows.reduce((a, b) => a + b.weight, 0) || 1;
    return rows.map((x) => ({ ...x, purchases: Math.round(purchases * x.weight / wsum), revenue: revenue * x.weight / wsum, engagementRate: between(r, 45, 70) }));
  };
  const ch = split(CHANNELS, range.cur, 'ch'), chp = split(CHANNELS, range.prev, 'ch');
  const dv = split(DEVICES, range.cur, 'dv'), dvp = split(DEVICES, range.prev, 'dv');
  const rl = rng(`lp-${range.cur.start}`);
  const curSessions = sumOver(range.cur, (d) => d.sessions);
  const curPurch = sumOver(range.cur, (d) => d.purchases);
  const curRev = sumOver(range.cur, (d) => d.revenue);
  return {
    kpi: {
      sessions: k((d) => d.sessions), users: k((d) => d.users), newUsers: k((d) => d.newUsers),
      engagementRate: avg((d) => d.engagementRate * 100), avgSessionDuration: avg((d) => d.avgSessionDuration),
      pageViews: k((d) => d.pageViews), addToCarts: k((d) => d.addToCarts), checkouts: k((d) => d.checkouts),
      purchases: k((d) => d.purchases), purchaseRevenue: k((d) => d.revenue),
    },
    series: { cur: series(range.chart), prev: range.key === 'day' ? null : series(range.prev), yoy: range.key === 'day' ? null : series(range.yoy) },
    channels: ch.map((c, i) => ({ name: c.name, sessions: c.sessions, sessionsPrev: chp[i].sessions, purchases: c.purchases, revenue: c.revenue, engagementRate: c.engagementRate })),
    devices: dv.map((c, i) => ({ name: c.name, sessions: c.sessions, sessionsPrev: dvp[i].sessions, purchases: c.purchases, purchasesPrev: dvp[i].purchases, revenue: c.revenue })),
    landingPages: PAGES.map(([page, share]) => {
      const sh = share * between(rl, 0.8, 1.2);
      const conv = page.includes('/blogs/') ? between(rl, 0, 0.004) : between(rl, 0.008, 0.03);
      const sessions = Math.round(curSessions * sh);
      const purchases = Math.min(curPurch, Math.round(sessions * conv));
      return { page, sessions, purchases, revenue: curPurch ? curRev * purchases / curPurch : 0, engagementRate: between(rl, 40, 75) };
    }).sort((a, b) => b.sessions - a.sessions),
    activeNow: Math.floor(between(rng(String(Math.floor(Date.now() / 60000))), 1, 7)),
  };
}

function demoGSC(range) {
  const t = (p) => {
    const clicks = sumOver(p, (d) => d.clicks), impressions = sumOver(p, (d) => d.impressions);
    return { clicks, impressions, ctr: impressions ? clicks / impressions * 100 : 0, position: sumOver(p, (d) => d.position * d.impressions) / Math.max(1, impressions) };
  };
  const tt = { cur: t(range.cur), prev: t(range.prev), yoy: t(range.yoy) };
  const k = (n) => ({ cur: tt.cur[n], prev: tt.prev[n], yoy: tt.yoy[n] });
  const series = (p) => {
    const days = daysBetween(p.start, p.end);
    return { dates: days, clicks: days.map((d) => day(d).clicks), impressions: days.map((d) => day(d).impressions), position: days.map((d) => day(d).position) };
  };
  const wsum = QUERIES.reduce((a, q) => a + q[1], 0);
  const queriesFor = (p, salt) => {
    const r = rng(`q-${salt}-${p.start}`);
    const tot = t(p);
    return QUERIES.map(([query, w, pos]) => {
      const position = Math.max(1, pos * between(r, 0.8, 1.2));
      const impressions = Math.round(tot.impressions * 0.55 * (w / wsum) * between(r, 0.7, 1.3));
      const expected = position < 3 ? 0.18 : position < 6 ? 0.07 : position < 10 ? 0.03 : position < 20 ? 0.008 : 0.002;
      const clicks = Math.round(impressions * expected * between(r, 0.5, 1.4));
      return { query, clicks, impressions, ctr: impressions ? clicks / impressions * 100 : 0, position };
    });
  };
  const cur = queriesFor(range.cur, 'c'), prev = queriesFor(range.prev, 'p');
  const rp = rng(`pg-${range.cur.start}`);
  return {
    kpi: { gscClicks: k('clicks'), gscImpressions: k('impressions'), gscCtr: k('ctr'), gscPosition: k('position') },
    series: { cur: series(range.chart), prev: range.key === 'day' ? null : series(range.prev), yoy: range.key === 'day' ? null : series(range.yoy) },
    queries: cur.map((q, i) => ({ ...q, clicksPrev: prev[i].clicks, positionPrev: prev[i].position })).sort((a, b) => b.clicks - a.clicks),
    pages: PAGES.map(([page, share]) => {
      const impressions = Math.round(tt.cur.impressions * share * between(rp, 0.7, 1.3));
      const clicks = Math.round(tt.cur.clicks * share * between(rp, 0.7, 1.3));
      return { page: `https://www.hoffmancables.shop${page}`, clicks, impressions, ctr: impressions ? clicks / impressions * 100 : 0, position: between(rp, 4, 22) };
    }).sort((a, b) => b.clicks - a.clicks),
  };
}

function demoShopify(range) {
  const agg = (p) => {
    const revenue = sumOver(p, (d) => d.shopRevenue), orders = sumOver(p, (d) => d.orders);
    const refunded = sumOver(p, (d) => d.refunded);
    return { revenue, orders, aov: orders ? revenue / orders : 0, refundRate: revenue ? refunded / revenue * 100 : 0 };
  };
  const a = { cur: agg(range.cur), prev: agg(range.prev), yoy: agg(range.yoy) };
  const k = (n) => ({ cur: a.cur[n], prev: a.prev[n], yoy: a.yoy[n] });
  const series = (p) => {
    const days = daysBetween(p.start, p.end);
    return { dates: days, revenue: days.map((d) => day(d).shopRevenue), orders: days.map((d) => day(d).orders) };
  };
  const r = rng(`prod-${range.cur.start}`);
  return {
    kpi: { revenue: k('revenue'), orders: k('orders'), aov: k('aov'), refundRate: k('refundRate') },
    series: { cur: series(range.chart), prev: range.key === 'day' ? null : series(range.prev), yoy: range.key === 'day' ? null : series(range.yoy) },
    products: PRODUCTS.map(([title, share, unit]) => {
      const revenue = a.cur.revenue * share * between(r, 0.75, 1.25);
      return { title, revenue, qty: Math.max(1, Math.round(revenue / unit)), orders: Math.max(1, Math.round(a.cur.orders * share * 1.4)) };
    }).sort((x, y) => y.revenue - x.revenue),
  };
}

export function demoData(key) {
  const range = buildRange(key);
  const ok = { status: 'ok' };
  return normalize({
    mode: 'demo', range,
    ga4: demoGA4(range), gsc: demoGSC(range), shopify: demoShopify(range),
    sources: { ga4: ok, gsc: ok, shopify: ok },
  });
}

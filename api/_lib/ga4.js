// Google Analytics 4 — Data API v1beta (batchRunReports + realtime).
import { googlePost } from './google.js';
import { daysBetween } from '../../assets/periods.js';

const MAIN_METRICS = [
  'sessions', 'totalUsers', 'newUsers', 'engagementRate', 'averageSessionDuration',
  'screenPageViews', 'addToCarts', 'checkouts', 'ecommercePurchases', 'purchaseRevenue',
];

const dr = (r, name) => ({ startDate: r.start, endDate: r.end, name });
const metrics = (...names) => names.map((name) => ({ name }));
const isoFromGa = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

// Transforme un rapport GA4 en lignes { dims: {nom: valeur}, m: {nom: nombre} }.
function rows(report, list = report.rows) {
  const dh = (report.dimensionHeaders || []).map((h) => h.name);
  const mh = (report.metricHeaders || []).map((h) => h.name);
  return (list || []).map((r) => ({
    dims: Object.fromEntries(dh.map((n, i) => [n, r.dimensionValues?.[i]?.value])),
    m: Object.fromEntries(mh.map((n, i) => [n, Number(r.metricValues?.[i]?.value || 0)])),
  }));
}

export async function fetchGA4(range) {
  const pid = process.env.GA4_PROPERTY_ID;
  const base = `https://analyticsdata.googleapis.com/v1beta/properties/${pid}`;
  const main = [dr(range.cur, 'cur'), dr(range.prev, 'prev'), dr(range.yoy, 'yoy')];
  if (range.key === 'day') main.push(dr(range.chart, 'chart'));
  const cp = [dr(range.cur, 'cur'), dr(range.prev, 'prev')];

  const [batch, realtime] = await Promise.all([
    googlePost(`${base}:batchRunReports`, {
      requests: [
        { dateRanges: main, dimensions: [{ name: 'date' }], metrics: metrics(...MAIN_METRICS), metricAggregations: ['TOTAL'], limit: 2000 },
        { dateRanges: cp, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: metrics('sessions', 'ecommercePurchases', 'purchaseRevenue', 'engagementRate') },
        { dateRanges: cp, dimensions: [{ name: 'deviceCategory' }], metrics: metrics('sessions', 'ecommercePurchases', 'purchaseRevenue') },
        {
          dateRanges: [dr(range.cur, 'cur')], dimensions: [{ name: 'landingPage' }],
          metrics: metrics('sessions', 'ecommercePurchases', 'purchaseRevenue', 'engagementRate'),
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 15,
        },
      ],
    }),
    googlePost(`${base}:runRealtimeReport`, { metrics: [{ name: 'activeUsers' }] }).catch(() => null),
  ]);

  const [mainR, chanR, devR, landR] = batch.reports;

  // Totaux par période
  const totals = {};
  for (const t of rows(mainR, mainR.totals)) totals[t.dims.dateRange || 'cur'] = t.m;
  const pick = (name) => ({ cur: totals.cur?.[name] ?? 0, prev: totals.prev?.[name] ?? 0, yoy: totals.yoy?.[name] ?? 0 });

  // Séries quotidiennes (jours sans données remplis à 0)
  const byRange = { cur: {}, prev: {}, yoy: {}, chart: {} };
  for (const r of rows(mainR)) byRange[r.dims.dateRange || 'cur'][isoFromGa(r.dims.date)] = r.m;
  const series = (rangeName, period) => {
    const map = byRange[rangeName];
    const days = daysBetween(period.start, period.end);
    return {
      dates: days,
      sessions: days.map((d) => map[d]?.sessions ?? 0),
      users: days.map((d) => map[d]?.totalUsers ?? 0),
      revenue: days.map((d) => map[d]?.purchaseRevenue ?? 0),
      orders: days.map((d) => map[d]?.ecommercePurchases ?? 0),
    };
  };

  const twoRanges = (report, key) => {
    const acc = {};
    for (const r of rows(report)) {
      const name = r.dims[key] || '(non défini)';
      acc[name] ||= { name, cur: {}, prev: {} };
      acc[name][r.dims.dateRange || 'cur'] = r.m;
    }
    return Object.values(acc);
  };

  return {
    kpi: {
      sessions: pick('sessions'),
      users: pick('totalUsers'),
      newUsers: pick('newUsers'),
      engagementRate: mapVal(pick('engagementRate'), (v) => v * 100),
      avgSessionDuration: pick('averageSessionDuration'),
      pageViews: pick('screenPageViews'),
      addToCarts: pick('addToCarts'),
      checkouts: pick('checkouts'),
      purchases: pick('ecommercePurchases'),
      purchaseRevenue: pick('purchaseRevenue'),
    },
    series: {
      cur: series(range.key === 'day' ? 'chart' : 'cur', range.chart),
      prev: range.key === 'day' ? null : series('prev', range.prev),
      yoy: range.key === 'day' ? null : series('yoy', range.yoy),
    },
    channels: twoRanges(chanR, 'sessionDefaultChannelGroup').map((c) => ({
      name: c.name,
      sessions: c.cur.sessions || 0, sessionsPrev: c.prev.sessions || 0,
      purchases: c.cur.ecommercePurchases || 0, revenue: c.cur.purchaseRevenue || 0,
      engagementRate: (c.cur.engagementRate || 0) * 100,
    })).sort((a, b) => b.sessions - a.sessions),
    devices: twoRanges(devR, 'deviceCategory').map((c) => ({
      name: c.name,
      sessions: c.cur.sessions || 0, sessionsPrev: c.prev.sessions || 0,
      purchases: c.cur.ecommercePurchases || 0, purchasesPrev: c.prev.ecommercePurchases || 0,
      revenue: c.cur.purchaseRevenue || 0,
    })).sort((a, b) => b.sessions - a.sessions),
    landingPages: rows(landR).map((r) => ({
      page: r.dims.landingPage, sessions: r.m.sessions, purchases: r.m.ecommercePurchases,
      revenue: r.m.purchaseRevenue, engagementRate: r.m.engagementRate * 100,
    })),
    activeNow: realtime ? Number(realtime.rows?.[0]?.metricValues?.[0]?.value || 0) : null,
  };
}

function mapVal(o, f) {
  return { cur: f(o.cur), prev: f(o.prev), yoy: f(o.yoy) };
}

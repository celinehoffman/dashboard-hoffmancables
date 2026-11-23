// Google Search Console — Search Analytics API.
import { googlePost } from './google.js';
import { daysBetween } from '../../assets/periods.js';

function query(body) {
  const site = encodeURIComponent(process.env.GSC_SITE_URL);
  return googlePost(`https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
    dataState: 'all', ...body,
  });
}

const q = (r, dimensions, rowLimit = 1000) => query({ startDate: r.start, endDate: r.end, dimensions, rowLimit });

// Somme des clics / impressions, CTR recalculé, position pondérée par les impressions.
function sum(rows) {
  let clicks = 0, impressions = 0, posW = 0;
  for (const r of rows) { clicks += r.clicks; impressions += r.impressions; posW += r.position * r.impressions; }
  return { clicks, impressions, ctr: impressions ? (clicks / impressions) * 100 : 0, position: impressions ? posW / impressions : 0 };
}

export async function fetchGSC(range) {
  const daily = range.key === 'day'
    ? [q(range.chart, ['date']), Promise.resolve(null)]
    : [q(range.cur, ['date']), q(range.prev, ['date'])];
  const [d1, d2, dYoy, qCur, qPrev, pCur] = await Promise.all([
    ...daily,
    q(range.yoy, ['date']),
    q(range.cur, ['query'], 250),
    q(range.prev, ['query'], 2500),
    q(range.cur, ['page'], 25),
  ]);

  const byDate = {};
  for (const res of [d1, d2, dYoy]) for (const r of res?.rows || []) byDate[r.keys[0]] = r;
  const inRange = (p) => daysBetween(p.start, p.end).map((d) => byDate[d]).filter(Boolean);
  const t = { cur: sum(inRange(range.cur)), prev: sum(inRange(range.prev)), yoy: sum(inRange(range.yoy)) };
  const k = (name) => ({ cur: t.cur[name], prev: t.prev[name], yoy: t.yoy[name] });

  const seriesOf = (p) => {
    const days = daysBetween(p.start, p.end);
    return {
      dates: days,
      clicks: days.map((d) => byDate[d]?.clicks ?? 0),
      impressions: days.map((d) => byDate[d]?.impressions ?? 0),
      position: days.map((d) => (byDate[d] ? byDate[d].position : null)),
    };
  };

  const prevMap = Object.fromEntries((qPrev.rows || []).map((r) => [r.keys[0], r]));
  return {
    kpi: { gscClicks: k('clicks'), gscImpressions: k('impressions'), gscCtr: k('ctr'), gscPosition: k('position') },
    series: {
      cur: seriesOf(range.chart),
      prev: range.key === 'day' ? null : seriesOf(range.prev),
      yoy: range.key === 'day' ? null : seriesOf(range.yoy),
    },
    queries: (qCur.rows || []).map((r) => ({
      query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr * 100, position: r.position,
      clicksPrev: prevMap[r.keys[0]]?.clicks ?? 0, positionPrev: prevMap[r.keys[0]]?.position ?? null,
    })),
    pages: (pCur.rows || []).map((r) => ({
      page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr * 100, position: r.position,
    })),
  };
}

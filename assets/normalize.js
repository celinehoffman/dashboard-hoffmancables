// Fusionne les réponses GA4 / Search Console / Shopify en un seul objet lu par le dashboard.
// Utilisé à l'identique par l'API (données réelles) et par le générateur de démo.

const EMPTY = { cur: null, prev: null, yoy: null };

export function normalize({ mode, range, ga4, gsc, shopify, sources }) {
  const g = ga4?.kpi || {};
  const s = shopify?.kpi || {};
  const c = gsc?.kpi || {};

  // Source de vérité du CA : Shopify si branché, sinon GA4.
  const revenue = s.revenue || g.purchaseRevenue || EMPTY;
  const orders = s.orders || g.purchases || EMPTY;
  const ratio = (a, b, mult = 1) => {
    const f = (x, y) => (x == null || y == null || !y ? null : (x / y) * mult);
    return { cur: f(a?.cur, b?.cur), prev: f(a?.prev, b?.prev), yoy: f(a?.yoy, b?.yoy) };
  };

  const kpi = {
    revenue,
    orders,
    aov: s.aov || ratio(revenue, orders),
    convRate: g.sessions ? ratio(orders, g.sessions, 100) : EMPTY,
    sessions: g.sessions || EMPTY,
    users: g.users || EMPTY,
    newUsers: g.newUsers || EMPTY,
    engagementRate: g.engagementRate || EMPTY,
    avgSessionDuration: g.avgSessionDuration || EMPTY,
    pagesPerSession: g.pageViews ? ratio(g.pageViews, g.sessions) : EMPTY,
    addToCarts: g.addToCarts || EMPTY,
    checkouts: g.checkouts || EMPTY,
    purchases: g.purchases || EMPTY,
    cartAbandon: g.addToCarts ? ratio(
      { cur: g.addToCarts.cur - g.purchases.cur, prev: g.addToCarts.prev - g.purchases.prev, yoy: g.addToCarts.yoy - g.purchases.yoy },
      g.addToCarts, 100) : EMPTY,
    gscClicks: c.gscClicks || EMPTY,
    gscImpressions: c.gscImpressions || EMPTY,
    gscCtr: c.gscCtr || EMPTY,
    gscPosition: c.gscPosition || EMPTY,
    organicSessions: organic(ga4),
    newCustomers: s.newCustomers || EMPTY,
    returningCustomers: s.returningCustomers || EMPTY,
    refundRate: s.refundRate || EMPTY,
  };

  const mergeSeries = (which) => {
    const gs = ga4?.series?.[which];
    const ss = shopify?.series?.[which];
    const cs = gsc?.series?.[which];
    const base = gs || ss || cs;
    if (!base) return null;
    return {
      dates: base.dates,
      sessions: gs?.sessions || null,
      users: gs?.users || null,
      revenue: ss?.revenue || gs?.revenue || null,
      orders: ss?.orders || gs?.orders || null,
      clicks: cs?.clicks || null,
      impressions: cs?.impressions || null,
      position: cs?.position || null,
    };
  };

  return {
    mode,
    generatedAt: new Date().toISOString(),
    range,
    sources,
    kpi,
    activeNow: ga4?.activeNow ?? null,
    series: { cur: mergeSeries('cur'), prev: mergeSeries('prev'), yoy: mergeSeries('yoy') },
    channels: ga4?.channels || [],
    devices: ga4?.devices || [],
    landingPages: ga4?.landingPages || [],
    queries: gsc?.queries || [],
    pages: gsc?.pages || [],
    products: shopify?.products || [],
  };
}

function organic(ga4) {
  const ch = ga4?.channels?.find((c) => c.name === 'Organic Search');
  return ch ? { cur: ch.sessions, prev: ch.sessionsPrev, yoy: null } : EMPTY;
}

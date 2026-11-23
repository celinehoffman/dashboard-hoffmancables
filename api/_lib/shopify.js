// Shopify — Admin GraphQL API (commandes).
// Deux modes d'authentification :
//  - SHOPIFY_ADMIN_TOKEN (shpat_…) : jeton d'une ancienne « custom app » créée dans l'admin ;
//  - SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET : app du Dev Dashboard installée sur la boutique
//    (client credentials grant, jeton valable 24 h, renouvelé automatiquement).
import { daysBetween, TZ } from '../../assets/periods.js';

const API_VERSION = '2025-10';
let cached = null;

const shopDomain = () => {
  const s = process.env.SHOPIFY_STORE_DOMAIN || '';
  return s.includes('.') ? s.replace(/^https?:\/\//, '').replace(/\/$/, '') : `${s}.myshopify.com`;
};

async function shopifyToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch(`https://${shopDomain()}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Shopify OAuth : ${json.error_description || json.error || res.status}`);
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in || 86_400) * 1000 };
  return cached.token;
}

const ORDERS = `query Orders($q: String!, $after: String) {
  orders(first: 50, after: $after, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      createdAt cancelledAt test
      totalPriceSet { shopMoney { amount } }
      totalRefundedSet { shopMoney { amount } }
      lineItems(first: 10) { nodes { title quantity originalTotalSet { shopMoney { amount } } } }
    }
  }
}`;

async function gql(query, variables) {
  const res = await fetch(`https://${shopDomain()}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'x-shopify-access-token': await shopifyToken(), 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) throw new Error(`Shopify : ${json.errors?.[0]?.message || json.errors || res.status}`);
  return json.data;
}

async function ordersBetween(p) {
  const out = [];
  let after = null;
  const q = `created_at:>=${p.start} created_at:<=${p.end}T23:59:59`;
  for (let page = 0; page < 40; page++) {
    const { orders } = await gql(ORDERS, { q, after });
    out.push(...orders.nodes.filter((o) => !o.test && !o.cancelledAt));
    if (!orders.pageInfo.hasNextPage) break;
    after = orders.pageInfo.endCursor;
  }
  return out;
}

const paris = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const amount = (s) => Number(s?.shopMoney?.amount || 0);

// Confidentialité : on ne lit aucune donnée client (nom, e-mail, historique).
// Seul le scope read_orders est nécessaire.
function aggregate(orders) {
  let revenue = 0, refunded = 0;
  for (const o of orders) {
    revenue += amount(o.totalPriceSet);
    refunded += amount(o.totalRefundedSet);
  }
  const n = orders.length;
  return { revenue, orders: n, aov: n ? revenue / n : 0, refundRate: revenue ? (refunded / revenue) * 100 : 0 };
}

export async function fetchShopify(range) {
  const sets = range.key === 'day'
    ? await Promise.all([ordersBetween(range.chart), ordersBetween(range.yoy)])
    : await Promise.all([ordersBetween(range.cur), ordersBetween(range.prev), ordersBetween(range.yoy)]);
  const all = sets.flat();
  const dayOf = (o) => paris.format(new Date(o.createdAt));
  const within = (p) => all.filter((o) => { const d = dayOf(o); return d >= p.start && d <= p.end; });

  const cur = aggregate(within(range.cur));
  const prev = aggregate(within(range.prev));
  const yoy = aggregate(within(range.yoy));
  const k = (name) => ({ cur: cur[name], prev: prev[name], yoy: yoy[name] });

  const seriesOf = (p) => {
    const days = daysBetween(p.start, p.end);
    const rev = Object.fromEntries(days.map((d) => [d, 0]));
    const cnt = Object.fromEntries(days.map((d) => [d, 0]));
    for (const o of within(p)) { const d = dayOf(o); rev[d] += amount(o.totalPriceSet); cnt[d] += 1; }
    return { dates: days, revenue: days.map((d) => rev[d]), orders: days.map((d) => cnt[d]) };
  };

  const products = {};
  for (const o of within(range.cur)) {
    for (const li of o.lineItems.nodes) {
      products[li.title] ||= { title: li.title, qty: 0, revenue: 0, orders: 0 };
      products[li.title].qty += li.quantity;
      products[li.title].revenue += amount(li.originalTotalSet);
      products[li.title].orders += 1;
    }
  }

  return {
    kpi: { revenue: k('revenue'), orders: k('orders'), aov: k('aov'), refundRate: k('refundRate') },
    series: {
      cur: seriesOf(range.chart),
      prev: range.key === 'day' ? null : seriesOf(range.prev),
      yoy: range.key === 'day' ? null : seriesOf(range.yoy),
    },
    products: Object.values(products).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  };
}

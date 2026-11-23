// GET /api/data?range=day|week|month  (en-tête x-dashboard-key obligatoire)
// Renvoie les données réelles fusionnées. Le mode démo est géré côté navigateur.
import crypto from 'node:crypto';
import { buildRange } from '../assets/periods.js';
import { normalize } from '../assets/normalize.js';
import { fetchGA4 } from './_lib/ga4.js';
import { fetchGSC } from './_lib/gsc.js';
import { fetchShopify } from './_lib/shopify.js';
import { configured } from './_lib/config.js';

const cache = new Map(); // range -> { at, body }
const TTL = 5 * 60 * 1000;

function authorized(req) {
  const expected = process.env.DASHBOARD_PASSWORD;
  const given = req.headers['x-dashboard-key'];
  if (!expected || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'private, no-store');
  if (!process.env.DASHBOARD_PASSWORD) {
    return res.status(503).json({ error: 'Données réelles non activées : DASHBOARD_PASSWORD absent sur Vercel.' });
  }
  if (!authorized(req)) return res.status(401).json({ error: 'Mot de passe incorrect.' });

  const key = ['day', 'week', 'month'].includes(req.query.range) ? req.query.range : 'week';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL && req.query.fresh !== '1') return res.status(200).json(hit.body);

  const range = buildRange(key);
  const on = configured();
  const run = (flag, fn) => (flag ? fn(range) : Promise.resolve(null));
  const [ga4, gsc, shopify] = await Promise.allSettled([
    run(on.ga4, fetchGA4), run(on.gsc, fetchGSC), run(on.shopify, fetchShopify),
  ]);

  const status = (flag, r) => (!flag ? { status: 'off' }
    : r.status === 'fulfilled' ? { status: 'ok' } : { status: 'error', message: String(r.reason?.message || r.reason) });

  const body = normalize({
    mode: 'live',
    range,
    ga4: ga4.value, gsc: gsc.value, shopify: shopify.value,
    sources: { ga4: status(on.ga4, ga4), gsc: status(on.gsc, gsc), shopify: status(on.shopify, shopify) },
  });
  cache.set(key, { at: Date.now(), body });
  return res.status(200).json(body);
}

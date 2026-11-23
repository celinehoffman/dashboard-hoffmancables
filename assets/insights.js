// Insights automatiques : règles simples et lisibles appliquées aux données fusionnées.
import { fmt } from './format.js';

export const delta = (k, cmp) => {
  if (!k || k.cur == null || k[cmp] == null || !k[cmp]) return null;
  return ((k.cur - k[cmp]) / Math.abs(k[cmp])) * 100;
};

// CTR moyen attendu selon la position (courbe moyenne e-commerce, en %).
export const expectedCtr = (pos) => (pos <= 1.5 ? 28 : pos <= 2.5 ? 15 : pos <= 3.5 ? 10 : pos <= 5 ? 6 : pos <= 10 ? 2.5 : pos <= 20 ? 0.8 : 0.3);

// Requêtes « à portée de main » : positions 4 à 20, clics gagnables en passant dans le top 3.
export function opportunities(queries) {
  return queries
    .filter((q) => q.position >= 4 && q.position <= 20 && q.impressions >= 20)
    .map((q) => ({ ...q, potential: Math.max(0, Math.round(q.impressions * 0.1 - q.clicks)) }))
    .filter((q) => q.potential > 0)
    .sort((a, b) => b.potential - a.potential);
}

const ORDER = { bad: 0, warn: 1, good: 2, info: 3 };

export function buildInsights(data, cmp) {
  const out = [];
  const k = data.kpi;
  const cmpLabel = cmp === 'yoy' ? 'l\'an dernier' : 'la période précédente';
  const threshold = data.range.key === 'day' ? 25 : 15;

  // 1. Grandes variations des KPIs clés
  const watch = [
    ['revenue', 'Chiffre d\'affaires', fmt.eur], ['orders', 'Commandes', fmt.int], ['convRate', 'Taux de conversion', fmt.pct],
    ['sessions', 'Sessions', fmt.int], ['gscClicks', 'Clics Google (SEO)', fmt.int], ['aov', 'Panier moyen', fmt.eur],
  ];
  for (const [key, label, f] of watch) {
    const d = delta(k[key], cmp);
    if (d == null || Math.abs(d) < threshold) continue;
    out.push({
      level: d > 0 ? 'good' : 'bad',
      title: `${label} ${d > 0 ? 'en hausse' : 'en baisse'} de ${fmt.pct(Math.abs(d), 0)}`,
      detail: `${f(k[key].cur)} contre ${f(k[key][cmp])} sur ${cmpLabel}.`,
    });
  }

  // 2. Position moyenne Google
  if (k.gscPosition.cur && k.gscPosition[cmp]) {
    const diff = k.gscPosition.cur - k.gscPosition[cmp];
    if (Math.abs(diff) >= 1.5) {
      out.push({
        level: diff < 0 ? 'good' : 'bad',
        title: `Position moyenne Google : ${diff < 0 ? 'gain' : 'perte'} de ${fmt.dec(Math.abs(diff))} place${Math.abs(diff) >= 2 ? 's' : ''}`,
        detail: `Position ${fmt.dec(k.gscPosition.cur)} contre ${fmt.dec(k.gscPosition[cmp])} sur ${cmpLabel}.`,
      });
    }
    // 3. CTR qui baisse alors que la position tient : problème de title / meta description
    const dCtr = delta(k.gscCtr, cmp);
    if (dCtr != null && dCtr < -15 && Math.abs(diff) < 1) {
      out.push({ level: 'warn', title: `Le CTR Google baisse de ${fmt.pct(-dCtr, 0)} à position stable`, detail: 'Les pages sont vues mais moins cliquées : revoir les balises title et meta description des pages principales.' });
    }
  }

  // 4. Écart de conversion mobile / ordinateur
  const dev = Object.fromEntries(data.devices.map((d) => [d.name, d]));
  const cr = (d) => (d && d.sessions ? (d.purchases / d.sessions) * 100 : null);
  const m = cr(dev.mobile), dk = cr(dev.desktop);
  if (m != null && dk && dev.mobile.sessions >= 30 && m < dk * 0.6) {
    out.push({ level: 'warn', title: `Conversion mobile ${fmt.dec(dk / Math.max(m, 0.01), 1)}× plus faible que sur ordinateur`, detail: `${fmt.pct(m)} sur mobile contre ${fmt.pct(dk)} sur ordinateur, pour ${fmt.pct(dev.mobile.sessions / Math.max(1, k.sessions.cur) * 100, 0)} du trafic. Tester le tunnel d'achat sur téléphone.` });
  }

  // 5. Canal qui bouge le plus
  const moved = data.channels.filter((c) => c.sessionsPrev >= 10)
    .map((c) => ({ ...c, d: ((c.sessions - c.sessionsPrev) / c.sessionsPrev) * 100 }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  if (moved && Math.abs(moved.d) >= 20) {
    out.push({ level: moved.d > 0 ? 'good' : 'warn', title: `Canal ${moved.name} : ${moved.d > 0 ? '+' : '−'}${fmt.pct(Math.abs(moved.d), 0)} de sessions`, detail: `${fmt.int(moved.sessions)} sessions contre ${fmt.int(moved.sessionsPrev)} sur la période précédente.` });
  }

  // 6. Opportunités SEO
  const opp = opportunities(data.queries);
  if (opp.length) {
    const top = opp.slice(0, 3);
    out.push({ level: 'info', title: `${opp.length} requête${opp.length > 1 ? 's' : ''} à portée du top 3 Google`, detail: `Priorité : ${top.map((q) => `« ${q.query} » (pos. ${fmt.dec(q.position)})`).join(', ')}. Gain estimé : +${fmt.int(top.reduce((a, q) => a + q.potential, 0))} clics.` });
  }

  // 7. Requêtes qui gagnent / perdent le plus
  const movers = data.queries.filter((q) => q.clicksPrev != null).map((q) => ({ ...q, d: q.clicks - q.clicksPrev })).sort((a, b) => a.d - b.d);
  const loser = movers[0], winner = movers[movers.length - 1];
  if (winner && winner.d >= 5) out.push({ level: 'good', title: `Requête en progression : « ${winner.query} »`, detail: `+${fmt.int(winner.d)} clics, position ${fmt.dec(winner.position)}.` });
  if (loser && loser.d <= -5) out.push({ level: 'bad', title: `Requête en recul : « ${loser.query} »`, detail: `${fmt.int(loser.d)} clics, position ${fmt.dec(loser.position)}${loser.positionPrev ? ` (avant ${fmt.dec(loser.positionPrev)})` : ''}.` });

  // 8. Pages d'entrée avec trafic mais sans vente
  const total = k.sessions.cur || 0;
  const leak = data.landingPages.find((p) => p.sessions >= Math.max(15, total * 0.05) && p.purchases === 0 && !p.page.includes('/blogs/'));
  if (leak) out.push({ level: 'warn', title: `${leak.page} attire du trafic sans vendre`, detail: `${fmt.int(leak.sessions)} sessions d'entrée, 0 commande. Vérifier prix, stock et appel à l'action.` });

  // 9. Abandon panier
  if (k.cartAbandon.cur != null && k.addToCarts.cur >= 10 && k.cartAbandon.cur > 85) {
    out.push({ level: 'warn', title: `${fmt.pct(k.cartAbandon.cur, 0)} des paniers sont abandonnés`, detail: 'Pistes : frais de port affichés tôt, paiement par virement / mandat pour les pros, relance panier par email.' });
  }

  // 10. Remboursements
  if (k.refundRate.cur != null && k.refundRate.cur > 5) out.push({ level: 'warn', title: `Taux de remboursement à ${fmt.pct(k.refundRate.cur)}`, detail: 'Au-dessus de 5 % : regarder les produits concernés (erreur de section, de longueur ?).' });

  // 11. Concentration produit
  const revTotal = data.products.reduce((a, p) => a + p.revenue, 0);
  if (data.products[0] && revTotal && data.products[0].revenue / revTotal > 0.35) {
    out.push({ level: 'info', title: `${data.products[0].title} pèse ${fmt.pct(data.products[0].revenue / revTotal * 100, 0)} du CA`, detail: 'Forte dépendance à un produit : sécuriser son stock et son référencement.' });
  }

  // 12. Poids du SEO dans le trafic
  if (k.organicSessions.cur && total) {
    out.push({ level: 'info', title: `Le SEO apporte ${fmt.pct(k.organicSessions.cur / total * 100, 0)} des sessions`, detail: 'Canal principal de la boutique tant que les autres leviers inbound ne sont pas lancés.' });
  }

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]).slice(0, 9);
}

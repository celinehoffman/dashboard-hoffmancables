// Calcul des périodes, partagé entre le navigateur et les fonctions Vercel.
// Toutes les dates sont des chaînes AAAA-MM-JJ dans le fuseau Europe/Paris.

export const TZ = 'Europe/Paris';

export const PERIODS = {
  day: { label: 'Jour', len: 1, desc: 'Hier' },
  week: { label: 'Semaine', len: 7, desc: '7 derniers jours' },
  month: { label: 'Mois', len: 30, desc: '30 derniers jours' },
};

export function parisDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function daysBetween(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

// key : day | week | month. La période se termine hier (dernière journée complète).
// N-1 = décalage de 364 jours pour comparer les mêmes jours de la semaine.
export function buildRange(key, today = parisDate()) {
  const p = PERIODS[key] || PERIODS.week;
  const end = addDays(today, -1);
  const start = addDays(end, -(p.len - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(p.len - 1));
  const cur = { start, end };
  const prev = { start: prevStart, end: prevEnd };
  const yoy = { start: addDays(start, -364), end: addDays(end, -364) };
  // En vue « Jour », la courbe montre les 14 derniers jours pour donner du contexte.
  const chart = key === 'day' ? { start: addDays(end, -13), end } : cur;
  return { key: PERIODS[key] ? key : 'week', label: p.label, desc: p.desc, cur, prev, yoy, chart };
}

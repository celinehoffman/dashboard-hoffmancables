// Formats français.
const nf = (opts) => new Intl.NumberFormat('fr-FR', opts);
const eur0 = nf({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = nf({ style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const safe = (f) => (v, ...a) => (v == null || Number.isNaN(v) ? '—' : f(v, ...a));

export const fmt = {
  int: safe((v) => nf({ maximumFractionDigits: 0 }).format(v)),
  dec: safe((v, d = 1) => nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v)),
  pct: safe((v, d = 1) => `${nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v)} %`),
  eur: safe((v) => (Math.abs(v) >= 1000 ? eur0.format(v) : eur2.format(v))),
  eur0: safe((v) => eur0.format(v)),
  duration: safe((v) => `${Math.floor(v / 60)} min ${String(Math.round(v % 60)).padStart(2, '0')} s`),
  compact: safe((v) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v)),
};

export function frDate(iso, opts = { day: 'numeric', month: 'short' }) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

export function frRange(r) {
  if (!r) return '';
  return r.start === r.end ? frDate(r.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${frDate(r.start)} → ${frDate(r.end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

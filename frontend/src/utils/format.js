const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// 24500 -> ₹24,500   |   1234567 -> ₹12,34,567 (Indian grouping)
export const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

// Short axis labels: 1500 -> 1.5k, 250000 -> 2.5L, 12000000 -> 1.2Cr
export function formatCompact(value) {
  const abs = Math.abs(value);
  const trim = (n) => String(Number(n.toFixed(1)));
  if (abs >= 1e7) return `${trim(value / 1e7)}Cr`;
  if (abs >= 1e5) return `${trim(value / 1e5)}L`;
  if (abs >= 1e3) return `${trim(value / 1e3)}k`;
  return String(value);
}

// Dates are 'YYYY-MM-DD' strings. They are formatted in UTC so the day never shifts with the timezone.
const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const formatDate = (iso) =>
  iso ? parse(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
export const formatShortDate = (iso) =>
  iso ? parse(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
export const formatMonthYear = (iso) =>
  iso ? parse(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';

export const initialsOf = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

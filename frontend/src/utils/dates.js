// Local-date helpers that produce 'YYYY-MM-DD' strings (no UTC conversion, so no off-by-one errors).
const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());

export const PERIOD_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

export function getPresetRange(preset) {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { startDate: toISODate(now), endDate: toISODate(now) };
    case 'this_week': {
      const mondayOffset = (now.getDay() + 6) % 7; // Monday = start of week
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }
    default:
      return { startDate: '', endDate: '' }; // 'all' / 'custom' start empty
  }
}

// A "period" is { preset, startDate, endDate }.
export const makePeriod = (preset) => ({ preset, ...getPresetRange(preset) });

const intFmt = new Intl.NumberFormat('en-US');
const compactFmt = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const formatInt = (v) => (isNum(v) ? intFmt.format(Math.round(v)) : '—');
export const formatCompact = (v) => (isNum(v) ? compactFmt.format(v) : '—');
export const formatPct = (v, digits = 1) => (isNum(v) ? `${v.toFixed(digits)}%` : '—');
export const formatMinutes = (v, digits = 1) => (isNum(v) ? `${v.toFixed(digits)} min` : '—');

/** "2026-07" -> "Jul 2026" */
export function formatMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(month ?? '');
  if (!match) return month ?? '';
  return new Date(Date.UTC(+match[1], +match[2] - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "2026-07-04" -> "Jul 4" */
export function formatDay(date) {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date ?? '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** camelCase / snake_case field name -> "Title case" label. */
export function humanize(field) {
  const known = {
    onTimePct: 'On-time %',
    onTimeDepPct: 'On-time departures %',
    avgArrDelay: 'Avg arrival delay (min)',
    avgDepDelay: 'Avg departure delay (min)',
    cancelPct: 'Cancelled %',
    divertPct: 'Diverted %',
    nasMin: 'NAS (min)',
    carrierMin: 'Carrier (min)',
    weatherMin: 'Weather (min)',
    securityMin: 'Security (min)',
    lateAircraftMin: 'Late aircraft (min)',
    totalDelayMin: 'Total delay (min)',
  };
  if (known[field]) return known[field];
  const words = String(field)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Generic cell formatter used by tables when a column has no explicit format. */
export function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (isNum(value)) return Number.isInteger(value) ? formatInt(value) : value.toFixed(2);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

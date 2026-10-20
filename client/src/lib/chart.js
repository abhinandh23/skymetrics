import { humanize } from './format.js';

/**
 * Decide how to draw an arbitrary result set (used by "Ask your data").
 * The model's hints are respected when they are consistent with the data; otherwise
 * the function falls back to simple, predictable rules.
 */

export const MAX_BARS = 30;
export const MAX_PIE_SLICES = 8;
export const MAX_SERIES = 3;

const TIME_FIELD = /^(month|date|day|week)$/i;
const TIME_VALUE = /^\d{4}-\d{2}(-\d{2})?$/;
const PREFERRED_X = ['month', 'date', 'route', 'airline', 'airport', 'origin', 'dest'];

const isNumeric = (rows, field) =>
  rows.every((r) => r[field] === null || r[field] === undefined || typeof r[field] === 'number') &&
  rows.some((r) => typeof r[field] === 'number');

const isCategory = (rows, field) =>
  rows.every((r) => ['string', 'number'].includes(typeof r[field]) || r[field] === null);

export const isTimeField = (rows, field) =>
  TIME_FIELD.test(field) ||
  (rows.length > 0 && rows.every((r) => TIME_VALUE.test(String(r[field]))));

/**
 * @param {{ rows: object[], chartType?: string, xField?: string | null, yFields?: string[] | null }} input
 * @returns {{ type: 'empty' | 'table' | 'stat' | 'bar' | 'line' | 'pie', xField?: string, yFields?: string[], rows?: object[] }}
 *   `rows` is set when the data was reshaped for charting.
 */
export function pickChart({ rows, chartType, xField, yFields }) {
  if (!rows?.length) return { type: 'empty' };
  const fields = Object.keys(rows[0]);
  const numeric = fields.filter((f) => isNumeric(rows, f));

  // One wide row whose hinted columns are parts of something (e.g. share per cause):
  // pivot the columns into label/value rows so they can be compared.
  const hinted = (yFields ?? []).filter((f) => numeric.includes(f));
  if (rows.length === 1 && hinted.length >= 2 && chartType !== 'table') {
    const pivoted = hinted
      .slice(0, MAX_PIE_SLICES)
      .map((f) => ({ label: humanize(f), value: rows[0][f] }));
    const pie = chartType === 'pie' && pivoted.every((r) => (r.value ?? 0) >= 0);
    return { type: pie ? 'pie' : 'bar', xField: 'label', yFields: ['value'], rows: pivoted };
  }

  if (rows.length === 1 && numeric.length >= 1 && fields.length <= 3) {
    return { type: 'stat', yFields: numeric.slice(0, 2) };
  }
  if (chartType === 'table') return { type: 'table' };

  const stringFields = fields.filter((f) => !numeric.includes(f) && isCategory(rows, f));
  const x =
    (xField && fields.includes(xField) && isCategory(rows, xField) ? xField : null) ??
    PREFERRED_X.find((f) => stringFields.includes(f)) ??
    stringFields[0] ??
    null;
  if (!x) return { type: 'table' };

  let ys = (yFields ?? []).filter((f) => f !== x && numeric.includes(f));
  if (!ys.length) ys = numeric.filter((f) => f !== x).slice(0, 1);
  if (!ys.length) return { type: 'table' };
  ys = sameScale(rows, ys).slice(0, MAX_SERIES);

  const time = isTimeField(rows, x);
  if (chartType === 'pie') {
    const ok =
      ys.length === 1 && rows.length <= MAX_PIE_SLICES && rows.every((r) => (r[ys[0]] ?? 0) >= 0);
    return ok
      ? { type: 'pie', xField: x, yFields: ys }
      : { type: 'bar', xField: x, yFields: ys.slice(0, 1) };
  }
  if (chartType === 'line' || (time && chartType !== 'bar')) {
    return rows.length >= 2 ? { type: 'line', xField: x, yFields: ys } : { type: 'table' };
  }
  if (rows.length > MAX_BARS) return { type: 'table' };
  return { type: 'bar', xField: x, yFields: ys };
}

/**
 * Keep only series whose magnitudes are comparable with the first one (within 10x),
 * so we never need a second y-axis.
 */
function sameScale(rows, fields) {
  const maxAbs = (f) => Math.max(...rows.map((r) => Math.abs(r[f] ?? 0)));
  const base = maxAbs(fields[0]) || 1;
  return fields.filter((f, i) => {
    if (i === 0) return true;
    const ratio = maxAbs(f) / base;
    return ratio >= 0.1 && ratio <= 10;
  });
}

/** Fixed color slot for a series index; callers cap series counts, so slots never cycle. */
export const seriesColor = (index) => `var(--series-${Math.min(index, 7) + 1})`;

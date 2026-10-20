import { useMemo, useState } from 'react';
import { formatValue, humanize } from '../lib/format.js';

/**
 * @typedef {object} Column
 * @property {string} key
 * @property {string} [label]
 * @property {(value: unknown, row: object) => import('react').ReactNode} [format]
 * @property {boolean} [numeric]
 */

/**
 * Sortable table. Sorting is client-side unless `onSort` is provided (server-side sorting).
 * @param {{ rows: object[], columns?: Column[], sort?: string, onSort?: (sort: string) => void, caption?: string, highlight?: (row: object) => boolean }} props
 */
export function DataTable({ rows, columns, sort: controlledSort, onSort, caption, highlight }) {
  const cols = useMemo(
    () =>
      columns ??
      Object.keys(rows[0] ?? {}).map((key) => ({
        key,
        numeric: rows.some((r) => typeof r[key] === 'number'),
      })),
    [columns, rows],
  );
  const [localSort, setLocalSort] = useState('');
  const sort = onSort ? controlledSort : localSort;
  const desc = sort?.startsWith('-');
  const sortKey = sort?.replace(/^-/, '');

  const sorted = useMemo(() => {
    if (onSort || !sortKey) return rows;
    return [...rows].sort((a, b) => {
      const [x, y] = [a[sortKey], b[sortKey]];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const cmp =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return desc ? -cmp : cmp;
    });
  }, [rows, onSort, sortKey, desc]);

  const toggle = (key) => {
    const next = sortKey === key && !desc ? `-${key}` : key;
    (onSort ?? setLocalSort)(next);
  };

  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line text-left text-ink-2">
            {cols.map((c) => {
              const active = sortKey === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
                  className={`px-3 py-2 font-medium whitespace-nowrap ${c.numeric ? 'text-right' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    {c.label ?? humanize(c.key)}
                    <span aria-hidden="true" className="text-xs">
                      {active ? (desc ? '▼' : '▲') : ''}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="tabular">
          {sorted.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-line last:border-0 ${highlight?.(row) ? 'bg-accent/10' : ''}`}
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 whitespace-nowrap ${c.numeric ? 'text-right' : ''}`}
                >
                  {c.format ? c.format(row[c.key], row) : formatValue(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

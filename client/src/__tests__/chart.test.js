import { describe, expect, test } from 'vitest';
import { MAX_BARS, pickChart, seriesColor } from '../lib/chart.js';

const routes = [
  { route: 'JFK-LAX', avgArrDelay: 25, flights: 300 },
  { route: 'ATL-JFK', avgArrDelay: 5, flights: 200 },
];

describe('pickChart', () => {
  test('empty results', () => {
    expect(pickChart({ rows: [] })).toEqual({ type: 'empty' });
  });

  test('follows a consistent bar hint', () => {
    expect(
      pickChart({ rows: routes, chartType: 'bar', xField: 'route', yFields: ['avgArrDelay'] }),
    ).toEqual({
      type: 'bar',
      xField: 'route',
      yFields: ['avgArrDelay'],
    });
  });

  test('ignores hinted fields that do not exist or are not numeric', () => {
    const choice = pickChart({
      rows: routes,
      chartType: 'bar',
      xField: 'nope',
      yFields: ['route', 'missing'],
    });
    expect(choice).toEqual({ type: 'bar', xField: 'route', yFields: ['avgArrDelay'] });
  });

  test('drops series on a different scale instead of adding a second axis', () => {
    const rows = [
      { airline: 'AA', onTimePct: 80, flights: 90000 },
      { airline: 'DL', onTimePct: 88, flights: 120000 },
    ];
    expect(
      pickChart({ rows, chartType: 'bar', yFields: ['onTimePct', 'flights'] }).yFields,
    ).toEqual(['onTimePct']);
  });

  test('time-like x values become a line chart', () => {
    const rows = [
      { month: '2026-06', onTimePct: 80 },
      { month: '2026-07', onTimePct: 78 },
    ];
    expect(pickChart({ rows, chartType: 'bar' }).type).toBe('bar');
    expect(pickChart({ rows }).type).toBe('line');
  });

  test('pie only for small, non-negative part-to-whole data', () => {
    const shares = [
      { cause: 'weather', minutes: 10 },
      { cause: 'carrier', minutes: 30 },
    ];
    expect(pickChart({ rows: shares, chartType: 'pie' }).type).toBe('pie');
    const many = Array.from({ length: 9 }, (_, i) => ({ cause: `c${i}`, minutes: i }));
    expect(pickChart({ rows: many, chartType: 'pie' }).type).toBe('bar');
    expect(
      pickChart({ rows: [...shares, { cause: 'x', minutes: -1 }], chartType: 'pie' }).type,
    ).toBe('bar');
  });

  test('single numeric row becomes a stat tile', () => {
    expect(pickChart({ rows: [{ busyAirports: 42 }], chartType: 'bar' })).toEqual({
      type: 'stat',
      yFields: ['busyAirports'],
    });
  });

  test('falls back to a table', () => {
    expect(pickChart({ rows: routes, chartType: 'table' }).type).toBe('table');
    expect(
      pickChart({
        rows: [
          { a: 'x', b: 'y' },
          { a: 'z', b: 'w' },
        ],
      }).type,
    ).toBe('table');
    const lots = Array.from({ length: MAX_BARS + 1 }, (_, i) => ({ route: `R${i}`, v: i }));
    expect(pickChart({ rows: lots, chartType: 'bar' }).type).toBe('table');
    expect(
      pickChart({
        rows: [
          { month: '2026-06', v: 1 },
          { month: '2026-07', v: 'n/a' },
        ],
      }).type,
    ).toBe('table');
  });

  test('series colors never cycle past the eighth slot', () => {
    expect(seriesColor(0)).toBe('var(--series-1)');
    expect(seriesColor(12)).toBe('var(--series-8)');
  });
});

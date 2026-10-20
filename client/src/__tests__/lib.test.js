import { describe, expect, test } from 'vitest';
import {
  formatDay,
  formatInt,
  formatMinutes,
  formatMonth,
  formatPct,
  formatValue,
  humanize,
} from '../lib/format.js';
import { rollupBy, sumCausesByAirline } from '../lib/rollup.js';

describe('format', () => {
  test('numbers and missing values', () => {
    expect(formatInt(1234567.4)).toBe('1,234,567');
    expect(formatPct(81.234)).toBe('81.2%');
    expect(formatMinutes(-3.25, 0)).toBe('-3 min');
    expect(formatPct(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue(2.5)).toBe('2.50');
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });

  test('dates', () => {
    expect(formatMonth('2026-07')).toBe('Jul 2026');
    expect(formatMonth('July')).toBe('July');
    expect(formatDay('2026-06-04')).toBe('Jun 4');
    expect(formatDay('bad')).toBe('bad');
  });

  test('humanize', () => {
    expect(humanize('onTimePct')).toBe('On-time %');
    expect(humanize('totalFlightsByCarrier')).toBe('Total flights by carrier');
    expect(humanize('rows_read')).toBe('Rows read');
  });
});

describe('rollupBy', () => {
  test('weights on-time % by completed flights and rates by total flights', () => {
    const rows = [
      {
        airline: 'AA',
        flights: 100,
        completed: 90,
        cancelled: 10,
        diverted: 0,
        onTimePct: 80,
        avgArrDelay: 10,
      },
      {
        airline: 'AA',
        flights: 300,
        completed: 270,
        cancelled: 20,
        diverted: 10,
        onTimePct: 60,
        avgArrDelay: 20,
      },
    ];
    const [aa] = rollupBy(rows, 'airline');
    expect(aa.flights).toBe(400);
    expect(aa.onTimePct).toBe(65); // (80*90 + 60*270) / 360
    expect(aa.avgArrDelay).toBe(17.5);
    expect(aa.cancelPct).toBe(7.5);
    expect(aa.divertPct).toBe(2.5);
  });

  test('sums delay causes per airline', () => {
    const rows = [
      {
        airline: 'DL',
        flights: 1,
        carrierMin: 5,
        weatherMin: 1,
        nasMin: 0,
        securityMin: 0,
        lateAircraftMin: 4,
        totalDelayMin: 10,
      },
      {
        airline: 'DL',
        flights: 2,
        carrierMin: 1,
        weatherMin: 1,
        nasMin: 1,
        securityMin: 1,
        lateAircraftMin: 1,
        totalDelayMin: 5,
      },
    ];
    expect(sumCausesByAirline(rows)[0]).toMatchObject({
      flights: 3,
      carrierMin: 6,
      totalDelayMin: 15,
    });
  });
});

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Combine monthly KPI rows for the same key into one row.
 * On-time % and delays are weighted by completed flights; rates by total flights.
 * @param {object[]} rows
 * @param {string} key
 * @param {{ onTimeField?: string, delayFields?: string[] }} [options]
 */
export function rollupBy(
  rows,
  key,
  { onTimeField = 'onTimePct', delayFields = ['avgArrDelay', 'avgDepDelay'] } = {},
) {
  const groups = new Map();
  for (const row of rows) {
    const g = groups.get(row[key]) ?? {
      [key]: row[key],
      flights: 0,
      completed: 0,
      cancelled: 0,
      diverted: 0,
      _w: {},
    };
    if (row.airlineName) g.airlineName = row.airlineName;
    g.flights += row.flights ?? 0;
    g.completed += row.completed ?? 0;
    g.cancelled += row.cancelled ?? 0;
    g.diverted += row.diverted ?? 0;
    for (const f of [onTimeField, ...delayFields]) {
      if (typeof row[f] === 'number') g._w[f] = (g._w[f] ?? 0) + row[f] * (row.completed ?? 0);
    }
    groups.set(row[key], g);
  }
  return [...groups.values()].map(({ _w, ...g }) => {
    const out = {
      ...g,
      cancelPct: g.flights ? round2((100 * g.cancelled) / g.flights) : null,
      divertPct: g.flights ? round2((100 * g.diverted) / g.flights) : null,
    };
    for (const [f, total] of Object.entries(_w))
      out[f] = g.completed ? round2(total / g.completed) : null;
    return out;
  });
}

export const CAUSE_FIELDS = [
  'carrierMin',
  'lateAircraftMin',
  'nasMin',
  'weatherMin',
  'securityMin',
];

/** Sum delay-cause minutes per airline across months. */
export function sumCausesByAirline(rows) {
  const groups = new Map();
  for (const row of rows) {
    const g = groups.get(row.airline) ?? {
      airline: row.airline,
      airlineName: row.airlineName,
      flights: 0,
      totalDelayMin: 0,
      ...Object.fromEntries(CAUSE_FIELDS.map((f) => [f, 0])),
    };
    g.flights += row.flights ?? 0;
    g.totalDelayMin += row.totalDelayMin ?? 0;
    for (const f of CAUSE_FIELDS) g[f] += row[f] ?? 0;
    groups.set(row.airline, g);
  }
  return [...groups.values()];
}

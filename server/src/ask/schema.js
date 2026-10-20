/**
 * The only collections and fields that natural-language questions may query.
 * This object is the single source of truth for both the LLM prompt and the validator.
 */
const COMMON_COUNTS = {
  flights: 'int, total scheduled flights',
  completed: 'int, flights that were neither cancelled nor diverted',
  cancelled: 'int, cancelled flights',
  diverted: 'int, diverted flights',
  cancelPct: 'double, cancelled / flights * 100',
  divertPct: 'double, diverted / flights * 100',
};

const ARRIVAL_METRICS = {
  onTimePct: 'double 0-100, share of completed flights arriving < 15 min late',
  avgArrDelay: 'double, mean arrival delay in minutes (negative = early), completed flights',
  avgDepDelay: 'double, mean departure delay in minutes, non-cancelled flights',
};

export const ASK_COLLECTIONS = {
  carrier_monthly: {
    description: 'One document per airline per month.',
    fields: {
      month: 'string "YYYY-MM"',
      airline: 'string, 2-char carrier code (e.g. "AA")',
      ...COMMON_COUNTS,
      ...ARRIVAL_METRICS,
    },
  },
  airport_monthly: {
    description: 'One document per origin airport per month (departure performance).',
    fields: {
      month: 'string "YYYY-MM"',
      airport: 'string, 3-letter IATA origin airport code (e.g. "ATL")',
      ...COMMON_COUNTS,
      onTimeDepPct: 'double 0-100, share of departed flights leaving < 15 min late',
      avgDepDelay: 'double, mean departure delay in minutes',
    },
  },
  route_monthly: {
    description:
      'One document per origin-destination pair per month (only routes with >= 50 flights).',
    fields: {
      month: 'string "YYYY-MM"',
      origin: 'string, 3-letter IATA code',
      dest: 'string, 3-letter IATA code',
      route: 'string "ORIGIN-DEST" (e.g. "JFK-LAX")',
      distance: 'double, average distance in miles',
      ...COMMON_COUNTS,
      ...ARRIVAL_METRICS,
    },
  },
  delay_causes_monthly: {
    description: 'One document per airline per month with total delay minutes by cause.',
    fields: {
      month: 'string "YYYY-MM"',
      airline: 'string, 2-char carrier code',
      flights: 'int, total flights',
      carrierMin: 'double, minutes of delay caused by the airline',
      weatherMin: 'double, minutes of delay caused by extreme weather',
      nasMin: 'double, minutes of delay caused by the National Airspace System',
      securityMin: 'double, minutes of delay caused by security',
      lateAircraftMin: 'double, minutes of delay caused by a late-arriving aircraft',
      totalDelayMin: 'double, sum of all cause minutes',
    },
  },
  carrier_daily: {
    description: 'One document per airline per day.',
    fields: {
      date: 'string "YYYY-MM-DD"',
      month: 'string "YYYY-MM"',
      airline: 'string, 2-char carrier code',
      ...COMMON_COUNTS,
      ...ARRIVAL_METRICS,
    },
  },
};

export const ASK_COLLECTION_NAMES = Object.keys(ASK_COLLECTIONS);

/** @param {string} collection */
export const fieldsOf = (collection) => new Set(Object.keys(ASK_COLLECTIONS[collection].fields));

/** Compact text description used in the LLM prompt. */
export function describeSchema() {
  return Object.entries(ASK_COLLECTIONS)
    .map(([name, { description, fields }]) => {
      const lines = Object.entries(fields).map(([f, d]) => `    - ${f}: ${d}`);
      return `- ${name}: ${description}\n${lines.join('\n')}`;
    })
    .join('\n');
}

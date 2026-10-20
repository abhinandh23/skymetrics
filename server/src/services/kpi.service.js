import { getDb } from '../db/mongo.js';
import { airlineName } from './airlines.js';

const col = (name) => getDb().collection(name);

/** Fields each list endpoint may sort by (prefix with "-" for descending). */
export const SORTABLE = {
  carrier_monthly: ['month', 'airline', 'flights', 'onTimePct', 'avgArrDelay', 'cancelPct'],
  airport_monthly: ['month', 'airport', 'flights', 'onTimeDepPct', 'avgDepDelay', 'cancelPct'],
  route_monthly: ['month', 'route', 'flights', 'onTimePct', 'avgArrDelay', 'cancelPct', 'distance'],
  delay_causes_monthly: ['month', 'airline', 'totalDelayMin', 'flights'],
};

/** @param {string | undefined} sort @param {Record<string, 1 | -1>} fallback */
function toSort(sort, fallback) {
  if (!sort) return fallback;
  const desc = sort.startsWith('-');
  return { [desc ? sort.slice(1) : sort]: desc ? -1 : 1, _id: 1 };
}

/** Build an equality filter from the provided keys, skipping undefined values. */
function filterOf(values) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
}

async function paginate(collection, filter, { page, limit, sort }) {
  const cursor = col(collection)
    .find(filter, { projection: { _id: 0 } })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  const [data, total] = await Promise.all([
    cursor.toArray(),
    col(collection).countDocuments(filter),
  ]);
  return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
}

const withAirlineName = (row) => ({ ...row, airlineName: airlineName(row.airline) });

export async function listCarriers({ month, airline, page, limit, sort }) {
  const result = await paginate('carrier_monthly', filterOf({ month, airline }), {
    page,
    limit,
    sort: toSort(sort, { month: 1, airline: 1 }),
  });
  return { ...result, data: result.data.map(withAirlineName) };
}

export async function listAirports({ month, airport, minFlights, page, limit, sort }) {
  const filter = filterOf({ month, airport });
  if (minFlights) filter.flights = { $gte: minFlights };
  return paginate('airport_monthly', filter, {
    page,
    limit,
    sort: toSort(sort, { flights: -1 }),
  });
}

export async function listRoutes({ month, origin, dest, airport, minFlights, page, limit, sort }) {
  const filter = filterOf({ month, origin, dest });
  if (airport) filter.$or = [{ origin: airport }, { dest: airport }];
  if (minFlights) filter.flights = { $gte: minFlights };
  return paginate('route_monthly', filter, {
    page,
    limit,
    sort: toSort(sort, { flights: -1 }),
  });
}

export async function listDelayCauses({ month, airline }) {
  const data = await col('delay_causes_monthly')
    .find(filterOf({ month, airline }), { projection: { _id: 0 } })
    .sort({ month: 1, totalDelayMin: -1 })
    .toArray();
  return { data: data.map(withAirlineName) };
}

/**
 * Flight-weighted roll-up: on-time % and average arrival delay are weighted by completed
 * flights, rates by total flights, so large and small carriers combine correctly.
 */
const ROLLUP_GROUP = {
  flights: { $sum: '$flights' },
  completed: { $sum: '$completed' },
  cancelled: { $sum: '$cancelled' },
  diverted: { $sum: '$diverted' },
  onTimeWeighted: { $sum: { $multiply: [{ $ifNull: ['$onTimePct', 0] }, '$completed'] } },
  arrDelayWeighted: { $sum: { $multiply: [{ $ifNull: ['$avgArrDelay', 0] }, '$completed'] } },
};

const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

function finishRollup({
  _id,
  flights,
  completed,
  cancelled,
  diverted,
  onTimeWeighted,
  arrDelayWeighted,
}) {
  return {
    key: _id,
    flights,
    completed,
    cancelled,
    diverted,
    onTimePct: completed ? round(onTimeWeighted / completed) : null,
    avgArrDelay: completed ? round(arrDelayWeighted / completed) : null,
    cancelPct: flights ? round((100 * cancelled) / flights) : null,
    divertPct: flights ? round((100 * diverted) / flights) : null,
  };
}

export async function overview({ month, airline }) {
  const monthlyFilter = filterOf({ month, airline });
  const [totals, byMonth, daily, runs] = await Promise.all([
    col('carrier_monthly')
      .aggregate([{ $match: monthlyFilter }, { $group: { _id: null, ...ROLLUP_GROUP } }])
      .toArray(),
    col('carrier_monthly')
      .aggregate([
        { $match: monthlyFilter },
        { $group: { _id: '$month', ...ROLLUP_GROUP } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    col('carrier_daily')
      .aggregate([
        { $match: monthlyFilter },
        { $group: { _id: '$date', ...ROLLUP_GROUP } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    col('pipeline_runs')
      .find({}, { projection: { _id: 0 } })
      .sort({ startedAt: -1 })
      .limit(1)
      .toArray(),
  ]);

  const summary = totals[0] ? finishRollup(totals[0]) : null;
  if (summary) delete summary.key;
  return {
    filters: { month: month ?? null, airline: airline ?? null },
    summary,
    monthly: byMonth.map(finishRollup).map(({ key, ...rest }) => ({ month: key, ...rest })),
    daily: daily.map(finishRollup).map(({ key, ...rest }) => ({ date: key, ...rest })),
    lastRun: runs[0] ?? null,
  };
}

export async function filterOptions() {
  const [months, airlines, airports] = await Promise.all([
    col('carrier_monthly').distinct('month'),
    col('carrier_monthly').distinct('airline'),
    col('airport_monthly')
      .aggregate([
        { $group: { _id: '$airport', flights: { $sum: '$flights' } } },
        { $sort: { flights: -1 } },
        { $limit: 100 },
      ])
      .toArray(),
  ]);
  return {
    months: months.sort(),
    airlines: airlines.sort().map((code) => ({ code, name: airlineName(code) })),
    airports: airports.map((a) => a._id).sort(),
  };
}

import { useState } from 'react';
import { kpiApi } from '../api/endpoints.js';
import { Card } from '../components/Card.jsx';
import { HBarChart } from '../components/charts/HBarChart.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterBar } from '../components/FilterBar.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { Empty, ErrorMessage, Loading } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useFilterOptions } from '../hooks/useFilterOptions.js';
import { useFilters } from '../hooks/useFilters.js';
import { usePageParams } from '../hooks/usePagedQuery.js';
import { formatInt, formatMinutes, formatMonth, formatPct, humanize } from '../lib/format.js';

const PAGE_SIZE = 25;
const MIN_FLIGHTS = ['50', '200', '500', '1000'];
const FORMATS = {
  flights: formatInt,
  onTimePct: (v) => formatPct(v),
  avgArrDelay: (v) => formatMinutes(v),
  cancelPct: (v) => formatPct(v, 2),
  distance: (v) => `${formatInt(v)} mi`,
};

export function RoutesPage() {
  const { month } = useFilters();
  const { data: options } = useFilterOptions();
  const { get, set } = usePageParams({
    sort: '-avgArrDelay',
    page: '1',
    airport: '',
    minFlights: '200',
  });
  const [airportInput, setAirportInput] = useState(get('airport'));
  const effectiveMonth = month || options.months.at(-1) || '';
  const sort = get('sort');
  const page = Number(get('page'));
  const airport = get('airport');
  const minFlights = get('minFlights');

  const { data, error, loading } = useApi(
    (signal) =>
      effectiveMonth
        ? kpiApi.routes(
            { month: effectiveMonth, sort, page, limit: PAGE_SIZE, airport, minFlights },
            { signal },
          )
        : Promise.resolve(null),
    [effectiveMonth, sort, page, airport, minFlights],
  );

  const metric = sort.replace(/^-/, '');
  const chartMetric = FORMATS[metric] && metric !== 'distance' ? metric : 'avgArrDelay';
  const rows = data?.data ?? [];

  const applyAirport = (e) => {
    e.preventDefault();
    const code = airportInput.trim().toUpperCase();
    if (code === '' || /^[A-Z]{3}$/.test(code)) set({ airport: code, page: '1' });
  };

  return (
    <>
      <PageHeader
        title="Routes"
        description={`Origin–destination pairs with at least 50 flights · ${formatMonth(effectiveMonth)}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar showAirline={false} fallbackMonth={effectiveMonth} />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            Min. flights
            <select
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
              value={minFlights}
              onChange={(e) => set({ minFlights: e.target.value, page: '1' })}
            >
              {MIN_FLIGHTS.map((n) => (
                <option key={n} value={n}>
                  {formatInt(Number(n))}
                </option>
              ))}
            </select>
          </label>
          <form onSubmit={applyAirport} className="flex items-center gap-2 text-sm text-ink-2">
            <label htmlFor="route-airport">Airport</label>
            <input
              id="route-airport"
              value={airportInput}
              onChange={(e) => setAirportInput(e.target.value)}
              placeholder="e.g. JFK"
              maxLength={3}
              className="w-20 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm uppercase placeholder:normal-case"
            />
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2"
            >
              Apply
            </button>
          </form>
        </div>
      </PageHeader>
      {loading && !data && <Loading />}
      {error && <ErrorMessage message={error} />}
      {data && !rows.length && <Empty />}
      {rows.length > 0 && (
        <div className="space-y-4">
          <Card title={`${humanize(chartMetric)} · top 10 on this page`}>
            <HBarChart
              data={rows.slice(0, 10)}
              categoryKey="route"
              valueKey={chartMetric}
              label={humanize(chartMetric)}
              valueFormat={FORMATS[chartMetric]}
            />
          </Card>
          <Card title="Routes">
            <DataTable
              caption="Route KPIs"
              rows={rows}
              sort={sort}
              onSort={(s) => set({ sort: s, page: '1' })}
              columns={[
                { key: 'route', label: 'Route' },
                { key: 'flights', label: 'Flights', numeric: true, format: FORMATS.flights },
                { key: 'onTimePct', label: 'On-time %', numeric: true, format: FORMATS.onTimePct },
                {
                  key: 'avgArrDelay',
                  label: 'Avg arr. delay',
                  numeric: true,
                  format: FORMATS.avgArrDelay,
                },
                {
                  key: 'cancelPct',
                  label: 'Cancelled %',
                  numeric: true,
                  format: FORMATS.cancelPct,
                },
                { key: 'distance', label: 'Distance', numeric: true, format: FORMATS.distance },
              ]}
            />
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onPage={(p) => set({ page: String(p) })}
            />
          </Card>
        </div>
      )}
    </>
  );
}

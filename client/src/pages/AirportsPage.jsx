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

const PAGE_SIZE = 20;
const MIN_FLIGHTS = ['0', '500', '1000', '5000'];
const FORMATS = {
  flights: formatInt,
  onTimeDepPct: (v) => formatPct(v),
  avgDepDelay: (v) => formatMinutes(v),
  cancelPct: (v) => formatPct(v, 2),
};

export function AirportsPage() {
  const { month } = useFilters();
  const { data: options } = useFilterOptions();
  const { get, set } = usePageParams({ sort: '-flights', page: '1', minFlights: '1000' });
  const effectiveMonth = month || options.months.at(-1) || '';
  const sort = get('sort');
  const page = Number(get('page'));
  const minFlights = get('minFlights');

  const { data, error, loading } = useApi(
    (signal) =>
      effectiveMonth
        ? kpiApi.airports(
            { month: effectiveMonth, sort, page, limit: PAGE_SIZE, minFlights },
            { signal },
          )
        : Promise.resolve(null),
    [effectiveMonth, sort, page, minFlights],
  );

  const metric = FORMATS[sort.replace(/^-/, '')] ? sort.replace(/^-/, '') : 'flights';
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Airports"
        description={`Departure performance by origin airport · ${formatMonth(effectiveMonth)}`}
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
        </div>
      </PageHeader>
      {loading && !data && <Loading />}
      {error && <ErrorMessage message={error} />}
      {data && !rows.length && <Empty />}
      {rows.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card
            title={`${humanize(metric)} · this page`}
            subtitle="Sort the table to change the chart"
          >
            <HBarChart
              data={rows}
              categoryKey="airport"
              valueKey={metric}
              label={humanize(metric)}
              valueFormat={FORMATS[metric]}
            />
          </Card>
          <Card title="Airports">
            <DataTable
              caption="Airport KPIs"
              rows={rows}
              sort={sort}
              onSort={(s) => set({ sort: s, page: '1' })}
              columns={[
                { key: 'airport', label: 'Airport' },
                { key: 'flights', label: 'Flights', numeric: true, format: formatInt },
                {
                  key: 'onTimeDepPct',
                  label: 'On-time dep. %',
                  numeric: true,
                  format: FORMATS.onTimeDepPct,
                },
                {
                  key: 'avgDepDelay',
                  label: 'Avg dep. delay',
                  numeric: true,
                  format: FORMATS.avgDepDelay,
                },
                {
                  key: 'cancelPct',
                  label: 'Cancelled %',
                  numeric: true,
                  format: FORMATS.cancelPct,
                },
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

import { useMemo, useState } from 'react';
import { kpiApi } from '../api/endpoints.js';
import { Card } from '../components/Card.jsx';
import { HBarChart } from '../components/charts/HBarChart.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterBar } from '../components/FilterBar.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { Empty, ErrorMessage, Loading } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useFilters } from '../hooks/useFilters.js';
import { formatInt, formatMinutes, formatPct } from '../lib/format.js';
import { rollupBy } from '../lib/rollup.js';

const METRICS = {
  onTimePct: { label: 'On-time %', format: (v) => formatPct(v), desc: true },
  avgArrDelay: { label: 'Avg arrival delay', format: (v) => formatMinutes(v), desc: false },
  cancelPct: { label: 'Cancelled %', format: (v) => formatPct(v, 2), desc: false },
};

export function AirlinesPage() {
  const { month, airline } = useFilters();
  const [metric, setMetric] = useState('onTimePct');
  // The selected airline is highlighted rather than filtered out, so it can be compared.
  const { data, error, loading } = useApi(
    (signal) => kpiApi.carriers({ month, limit: 100 }, { signal }),
    [month],
  );

  const rows = useMemo(() => (data ? rollupBy(data.data, 'airline') : []), [data]);
  const m = METRICS[metric];
  const chartRows = useMemo(
    () => [...rows].sort((a, b) => (m.desc ? b[metric] - a[metric] : a[metric] - b[metric])),
    [rows, metric, m.desc],
  );
  const nameOf = (code) => rows.find((r) => r.airline === code)?.airlineName ?? code;

  return (
    <>
      <PageHeader title="Airlines" description="Compare carriers; pick an airline to highlight it.">
        <FilterBar />
      </PageHeader>
      {loading && !data && <Loading />}
      {error && <ErrorMessage message={error} />}
      {data && !rows.length && <Empty />}
      {rows.length > 0 && (
        <div className="space-y-6">
          <Card
            title={`${m.label} by airline`}
            subtitle={m.desc ? 'Higher is better' : 'Lower is better'}
            actions={
              <div
                role="radiogroup"
                aria-label="Metric"
                className="flex rounded-lg border border-line p-0.5 text-sm"
              >
                {Object.entries(METRICS).map(([key, def]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={metric === key}
                    onClick={() => setMetric(key)}
                    className={`rounded-md px-2.5 py-1 ${metric === key ? 'bg-accent text-accent-ink' : 'text-ink-2'}`}
                  >
                    {def.label}
                  </button>
                ))}
              </div>
            }
          >
            <HBarChart
              data={chartRows}
              categoryKey="airline"
              valueKey={metric}
              label={m.label}
              valueFormat={m.format}
              categoryFormat={nameOf}
              highlight={airline || undefined}
            />
          </Card>
          <Card title="All airlines">
            <DataTable
              caption="Airline KPIs"
              rows={rows}
              highlight={(r) => r.airline === airline}
              columns={[
                { key: 'airlineName', label: 'Airline', format: (v, r) => `${v} (${r.airline})` },
                { key: 'flights', label: 'Flights', numeric: true, format: formatInt },
                {
                  key: 'onTimePct',
                  label: 'On-time %',
                  numeric: true,
                  format: (v) => formatPct(v),
                },
                {
                  key: 'avgArrDelay',
                  label: 'Avg arr. delay',
                  numeric: true,
                  format: (v) => formatMinutes(v),
                },
                {
                  key: 'avgDepDelay',
                  label: 'Avg dep. delay',
                  numeric: true,
                  format: (v) => formatMinutes(v),
                },
                {
                  key: 'cancelPct',
                  label: 'Cancelled %',
                  numeric: true,
                  format: (v) => formatPct(v, 2),
                },
                {
                  key: 'divertPct',
                  label: 'Diverted %',
                  numeric: true,
                  format: (v) => formatPct(v, 2),
                },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}

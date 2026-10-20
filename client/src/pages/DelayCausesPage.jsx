import { useMemo, useState } from 'react';
import { kpiApi } from '../api/endpoints.js';
import { Card } from '../components/Card.jsx';
import { StackedBarChart } from '../components/charts/StackedBarChart.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterBar } from '../components/FilterBar.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { Empty, ErrorMessage, Loading } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useFilters } from '../hooks/useFilters.js';
import { formatCompact, formatInt, formatPct } from '../lib/format.js';
import { CAUSE_FIELDS, sumCausesByAirline } from '../lib/rollup.js';

const CAUSES = [
  { key: 'carrierMin', label: 'Carrier' },
  { key: 'lateAircraftMin', label: 'Late aircraft' },
  { key: 'nasMin', label: 'National Airspace System' },
  { key: 'weatherMin', label: 'Weather' },
  { key: 'securityMin', label: 'Security' },
];

/** Convert minutes to each cause's share of the airline's total delay. */
const toShares = (rows) =>
  rows.map((r) => ({
    ...r,
    ...Object.fromEntries(
      CAUSE_FIELDS.map((f) => [f, r.totalDelayMin ? (100 * r[f]) / r.totalDelayMin : 0]),
    ),
  }));

export function DelayCausesPage() {
  const { month, airline } = useFilters();
  const [mode, setMode] = useState('minutes');
  const { data, error, loading } = useApi(
    (signal) => kpiApi.delayCauses({ month, airline }, { signal }),
    [month, airline],
  );

  const rows = useMemo(
    () =>
      data ? sumCausesByAirline(data.data).sort((a, b) => b.totalDelayMin - a.totalDelayMin) : [],
    [data],
  );
  const totals = useMemo(() => {
    const t = Object.fromEntries(
      CAUSES.map((c) => [c.key, rows.reduce((s, r) => s + r[c.key], 0)]),
    );
    const all = Object.values(t).reduce((a, b) => a + b, 0);
    return { ...t, all };
  }, [rows]);
  const nameOf = (code) => rows.find((r) => r.airline === code)?.airlineName ?? code;
  const chartRows = mode === 'share' ? toShares(rows) : rows;
  const valueFormat = mode === 'share' ? (v) => formatPct(v, 0) : formatCompact;

  return (
    <>
      <PageHeader
        title="Delay causes"
        description="Minutes of arrival delay attributed to each cause (flights ≥ 15 min late)."
      >
        <FilterBar />
      </PageHeader>
      {loading && !data && <Loading />}
      {error && <ErrorMessage message={error} />}
      {data && !rows.length && <Empty />}
      {rows.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {CAUSES.map((c) => (
              <KpiCard
                key={c.key}
                label={c.label}
                value={formatPct(totals.all ? (100 * totals[c.key]) / totals.all : 0)}
                hint={`${formatCompact(totals[c.key])} min`}
              />
            ))}
          </div>
          <Card
            title="Delay minutes by airline and cause"
            actions={
              <div
                role="radiogroup"
                aria-label="Units"
                className="flex rounded-lg border border-line p-0.5 text-sm"
              >
                {[
                  ['minutes', 'Minutes'],
                  ['share', 'Share %'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={mode === key}
                    onClick={() => setMode(key)}
                    className={`rounded-md px-2.5 py-1 ${mode === key ? 'bg-accent text-accent-ink' : 'text-ink-2'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <StackedBarChart
              data={chartRows}
              categoryKey="airline"
              series={CAUSES}
              valueFormat={valueFormat}
              categoryFormat={nameOf}
            />
          </Card>
          <Card title="Table">
            <DataTable
              caption="Delay minutes by cause"
              rows={rows}
              columns={[
                { key: 'airlineName', label: 'Airline', format: (v, r) => `${v} (${r.airline})` },
                ...CAUSES.map((c) => ({
                  key: c.key,
                  label: c.label,
                  numeric: true,
                  format: formatInt,
                })),
                { key: 'totalDelayMin', label: 'Total', numeric: true, format: formatInt },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}

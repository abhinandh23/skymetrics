import { kpiApi } from '../api/endpoints.js';
import { Card } from '../components/Card.jsx';
import { TrendLine } from '../components/charts/TrendLine.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterBar } from '../components/FilterBar.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { Empty, ErrorMessage, Loading } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useFilters } from '../hooks/useFilters.js';
import {
  formatCompact,
  formatDay,
  formatInt,
  formatMinutes,
  formatMonth,
  formatPct,
} from '../lib/format.js';

export function OverviewPage() {
  const { month, airline } = useFilters();
  const { data, error, loading } = useApi(
    (signal) => kpiApi.overview({ month, airline }, { signal }),
    [month, airline],
  );

  return (
    <>
      <PageHeader title="Overview" description="On-time performance across US reporting carriers.">
        <FilterBar />
      </PageHeader>
      {loading && !data && <Loading />}
      {error && <ErrorMessage message={error} />}
      {data && !data.summary && <Empty />}
      {data?.summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Flights"
              value={formatCompact(data.summary.flights)}
              hint={`${formatInt(data.summary.flights)} scheduled`}
            />
            <KpiCard
              label="On-time arrivals"
              value={formatPct(data.summary.onTimePct)}
              hint="Arrived < 15 min late"
            />
            <KpiCard
              label="Avg arrival delay"
              value={formatMinutes(data.summary.avgArrDelay)}
              hint="Completed flights"
            />
            <KpiCard
              label="Cancelled"
              value={formatPct(data.summary.cancelPct, 2)}
              hint={`${formatInt(data.summary.cancelled)} flights`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card
              title="On-time arrivals by day"
              subtitle="% of completed flights arriving within 15 minutes"
            >
              <TrendLine
                data={data.daily}
                xKey="date"
                series={[{ key: 'onTimePct', label: 'On-time %' }]}
                valueFormat={(v) => formatPct(v, 0)}
                xFormat={formatDay}
              />
            </Card>
            <Card title="Average arrival delay by day" subtitle="Minutes; negative means early">
              <TrendLine
                data={data.daily}
                xKey="date"
                series={[{ key: 'avgArrDelay', label: 'Avg arrival delay' }]}
                valueFormat={(v) => formatMinutes(v, 0)}
                xFormat={formatDay}
              />
            </Card>
          </div>

          <Card title="By month">
            <DataTable
              caption="Monthly summary"
              rows={data.monthly}
              columns={[
                { key: 'month', label: 'Month', format: formatMonth },
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

          {data.lastRun && (
            <p className="text-xs text-ink-muted">
              Data: BTS Reporting Carrier On-Time Performance,{' '}
              {data.lastRun.months?.map(formatMonth).join(', ')} ·{' '}
              {formatInt(data.lastRun.rowsAfterCleaning)} flight records processed.
            </p>
          )}
        </div>
      )}
    </>
  );
}

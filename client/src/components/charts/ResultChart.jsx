import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { pickChart, seriesColor } from '../../lib/chart.js';
import { formatValue, humanize } from '../../lib/format.js';
import { KpiCard } from '../KpiCard.jsx';
import { axisProps, gridProps, legendProps, tooltipProps } from './chartTheme.js';
import { TrendLine } from './TrendLine.jsx';

const fmt = (v) => formatValue(v);

/**
 * Chart for an arbitrary "Ask your data" result, chosen by `pickChart`.
 * Returns null when a table alone is the better view.
 */
export function ResultChart({ rows, chartType, xField, yFields }) {
  const choice = pickChart({ rows, chartType, xField, yFields });

  if (choice.type === 'stat') {
    return (
      <div className="grid gap-3 sm:grid-cols-2" data-testid="chart-stat">
        {choice.yFields.map((f) => (
          <KpiCard key={f} label={humanize(f)} value={formatValue(rows[0][f])} />
        ))}
      </div>
    );
  }

  const series = (choice.yFields ?? []).map((key) => ({ key, label: humanize(key) }));

  if (choice.type === 'line') {
    return (
      <div data-testid="chart-line">
        <TrendLine
          data={rows}
          xKey={choice.xField}
          series={series}
          valueFormat={fmt}
          height={280}
        />
      </div>
    );
  }

  if (choice.type === 'pie') {
    const [y] = series;
    return (
      <div data-testid="chart-pie">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={rows}
              dataKey={y.key}
              nameKey={choice.xField}
              innerRadius="55%"
              outerRadius="85%"
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {rows.map((row, i) => (
                <Cell key={String(row[choice.xField])} fill={seriesColor(i)} />
              ))}
            </Pie>
            <Tooltip {...tooltipProps} formatter={(v) => [fmt(v), y.label]} />
            <Legend {...legendProps} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (choice.type === 'bar') {
    const height = Math.max(160, rows.length * (series.length * 14 + 12) + 60);
    return (
      <div data-testid="chart-bar">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
            barGap={2}
          >
            <CartesianGrid {...gridProps} horizontal={false} />
            <XAxis type="number" {...axisProps} tickFormatter={fmt} />
            <YAxis
              type="category"
              dataKey={choice.xField}
              {...axisProps}
              width={110}
              interval={0}
            />
            <Tooltip
              {...tooltipProps}
              formatter={(v, name) => [fmt(v), name]}
              cursor={{ fill: 'var(--surface-2)' }}
            />
            {series.length > 1 && <Legend {...legendProps} verticalAlign="top" height={28} />}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={seriesColor(i)}
                barSize={12}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

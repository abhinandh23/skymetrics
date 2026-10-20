import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { seriesColor } from '../../lib/chart.js';
import { axisProps, gridProps, legendProps, NAME_AXIS_WIDTH, tooltipProps } from './chartTheme.jsx';

/**
 * Horizontal stacked bars with a 2px surface gap between segments.
 * @param {{ data: object[], categoryKey: string, series: { key: string, label: string }[], valueFormat?: (v: number) => string, categoryFormat?: (v: string) => string }} props
 */
export function StackedBarChart({
  data,
  categoryKey,
  series,
  valueFormat = String,
  categoryFormat = String,
  categoryWidth = NAME_AXIS_WIDTH,
}) {
  const height = Math.max(160, data.length * 28 + 70);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
        barCategoryGap={6}
      >
        <CartesianGrid {...gridProps} horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={valueFormat} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          {...axisProps}
          width={categoryWidth}
          tickFormatter={categoryFormat}
          interval={0}
        />
        <Tooltip
          {...tooltipProps}
          formatter={(v, name) => [valueFormat(v), name]}
          labelFormatter={categoryFormat}
          cursor={{ fill: 'var(--surface-2)' }}
        />
        <Legend {...legendProps} verticalAlign="top" height={28} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="stack"
            fill={seriesColor(i)}
            stroke="var(--surface)"
            strokeWidth={2}
            barSize={16}
            radius={i === series.length - 1 ? [0, 4, 4, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

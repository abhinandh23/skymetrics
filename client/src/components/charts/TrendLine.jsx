import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { seriesColor } from '../../lib/chart.js';
import { axisProps, gridProps, legendProps, tooltipProps } from './chartTheme.js';

/**
 * Time-series line chart (one y-axis only; series must share a unit).
 * @param {{ data: object[], xKey: string, series: { key: string, label: string }[], valueFormat?: (v: number) => string, xFormat?: (v: string) => string, height?: number, yDomain?: [number | string, number | string] }} props
 */
export function TrendLine({
  data,
  xKey,
  series,
  valueFormat = String,
  xFormat = String,
  height = 240,
  yDomain,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormat} minTickGap={24} />
        <YAxis
          {...axisProps}
          axisLine={false}
          width={56}
          tickFormatter={valueFormat}
          domain={yDomain ?? ['auto', 'auto']}
        />
        <Tooltip
          {...tooltipProps}
          labelFormatter={xFormat}
          formatter={(v) => valueFormat(v)}
          cursor={{ stroke: 'var(--axis)' }}
        />
        {series.length > 1 && <Legend {...legendProps} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

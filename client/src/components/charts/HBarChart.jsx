import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { axisProps, gridProps, tooltipProps } from './chartTheme.js';

/**
 * Horizontal single-series bar chart. One color for every bar (the categories are nominal);
 * an optional `highlight` dims all other bars to emphasise one entity.
 * @param {{ data: object[], categoryKey: string, valueKey: string, label: string, valueFormat?: (v: number) => string, categoryFormat?: (v: string, row?: object) => string, highlight?: string }} props
 */
export function HBarChart({
  data,
  categoryKey,
  valueKey,
  label,
  valueFormat = String,
  categoryFormat = String,
  highlight,
}) {
  const height = Math.max(120, data.length * 26 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
        barCategoryGap={4}
      >
        <CartesianGrid {...gridProps} horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={valueFormat} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          {...axisProps}
          width={110}
          tickFormatter={categoryFormat}
          interval={0}
        />
        <Tooltip
          {...tooltipProps}
          formatter={(v) => [valueFormat(v), label]}
          labelFormatter={categoryFormat}
          cursor={{ fill: 'var(--surface-2)' }}
        />
        <Bar
          dataKey={valueKey}
          name={label}
          barSize={14}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        >
          {data.map((row) => (
            <Cell
              key={row[categoryKey]}
              fill={
                !highlight || row[categoryKey] === highlight
                  ? 'var(--series-1)'
                  : 'var(--emphasis-dim)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

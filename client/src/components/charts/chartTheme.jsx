/** Shared Recharts styling: recessive hairline grid/axes, token-based colors (light & dark). */
export const axisProps = {
  tick: { fill: 'var(--ink-muted)', fontSize: 12 },
  axisLine: { stroke: 'var(--axis)' },
  tickLine: false,
};

export const gridProps = { stroke: 'var(--grid)', strokeDasharray: '0' };

export const tooltipProps = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--ink)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--ink-2)', fontWeight: 600 },
  itemStyle: { color: 'var(--ink)' },
};

/** Legends keep series order (no alphabetical sort) and use text ink, not the series color. */
export const legendProps = {
  iconType: 'circle',
  iconSize: 8,
  itemSorter: null,
  wrapperStyle: { fontSize: 12 },
  formatter: (value) => <span style={{ color: 'var(--ink-2)' }}>{value}</span>,
};

/** Width of a category axis that shows airline names. */
export const NAME_AXIS_WIDTH = 140;

/**
 * Stat tile: one headline number with a label and optional context line.
 * @param {{ label: string, value: string, hint?: string }} props
 */
export function KpiCard({ label, value, hint }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label={label}>
      <h3 className="text-sm text-ink-2">{label}</h3>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </section>
  );
}

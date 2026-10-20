export function Loading({ label = 'Loading' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 p-6 text-sm text-ink-2"
    >
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}…
    </div>
  );
}

export function ErrorMessage({ message, children }) {
  return (
    <div role="alert" className="rounded-lg border border-critical/40 bg-critical/5 p-4 text-sm">
      <p className="font-medium text-critical">{message}</p>
      {children}
    </div>
  );
}

export function Empty({ message = 'No data for the selected filters.' }) {
  return <p className="p-6 text-center text-sm text-ink-muted">{message}</p>;
}

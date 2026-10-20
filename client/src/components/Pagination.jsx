export function Pagination({ page, totalPages, total, onPage }) {
  if (!totalPages || totalPages <= 1) return null;
  const btn =
    'rounded-lg border border-line px-3 py-1 text-sm disabled:opacity-40 hover:bg-surface-2';
  return (
    <nav
      aria-label="Pagination"
      className="mt-3 flex items-center justify-between text-sm text-ink-2"
    >
      <span>
        Page {page} of {totalPages} · {total} rows
      </span>
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className={btn}
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

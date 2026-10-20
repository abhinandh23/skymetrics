import { useFilters } from '../hooks/useFilters.js';
import { useFilterOptions } from '../hooks/useFilterOptions.js';
import { formatMonth } from '../lib/format.js';

const selectClass =
  'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:outline-2 focus:outline-accent';

/** Global month/airline filters, synced to the URL. */
export function FilterBar({ showAirline = true }) {
  const { month, airline, setFilter, setFilters } = useFilters();
  const { data } = useFilterOptions();

  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filters">
      <label className="flex items-center gap-2 text-sm text-ink-2">
        Month
        <select
          className={selectClass}
          value={month}
          onChange={(e) => setFilter('month', e.target.value)}
        >
          <option value="">All months</option>
          {data.months.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </select>
      </label>
      {showAirline && (
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Airline
          <select
            className={selectClass}
            value={airline}
            onChange={(e) => setFilter('airline', e.target.value)}
          >
            <option value="">All airlines</option>
            {data.airlines.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </label>
      )}
      {(month || (showAirline && airline)) && (
        <button
          type="button"
          className="text-sm text-accent hover:underline"
          onClick={() => setFilters({ month: '', airline: '' })}
        >
          Clear
        </button>
      )}
    </div>
  );
}

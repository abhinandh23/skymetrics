import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export const FILTER_KEYS = ['month', 'airline'];

/** Global filters (month, airline) stored in the URL so views are shareable and survive reloads. */
export function useFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(
    () => ({ month: params.get('month') ?? '', airline: params.get('airline') ?? '' }),
    [params],
  );

  /** Apply several filter changes in one URL update. */
  const setFilters = useCallback(
    (updates) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setFilter = useCallback((key, value) => setFilters({ [key]: value }), [setFilters]);

  /** Query string carrying only the global filters, for navigation links. */
  const search = useMemo(() => {
    const keep = new URLSearchParams();
    for (const key of FILTER_KEYS) if (params.get(key)) keep.set(key, params.get(key));
    const s = keep.toString();
    return s ? `?${s}` : '';
  }, [params]);

  return { ...filters, setFilter, setFilters, search };
}

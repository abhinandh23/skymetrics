import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/** Page-local query params (sort, page, ...) kept in the URL next to the global filters. */
export function usePageParams(defaults) {
  const [params, setParams] = useSearchParams();
  const get = (key) => params.get(key) ?? defaults[key] ?? '';
  const set = useCallback(
    (updates) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(updates)) {
            if (v === '' || v === undefined || v === null || v === defaults[k]) next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );
  return { get, set };
}

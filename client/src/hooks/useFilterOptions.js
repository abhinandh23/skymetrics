import { kpiApi } from '../api/endpoints.js';
import { useApi } from './useApi.js';

let cached = null;

/** Months/airlines/airports for dropdowns; fetched once per session. */
export function useFilterOptions() {
  const state = useApi(async (signal) => {
    cached ??= await kpiApi.filters({ signal });
    return cached;
  }, []);
  return { ...state, data: state.data ?? { months: [], airlines: [], airports: [] } };
}

export const resetFilterOptionsCache = () => {
  cached = null;
};

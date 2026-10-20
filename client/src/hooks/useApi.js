import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client.js';

/**
 * Run an async loader whenever its dependencies change, cancelling stale requests.
 * While a new request is in flight the previous data stays available (no flicker).
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} loader
 * @param {unknown[]} deps
 * @returns {{ data: T | null, error: string | null, loading: boolean }}
 */
export function useApi(loader, deps) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return;
        setState({ key, data: null, error: errorMessage(err) });
      });
    return () => controller.abort();
    // The serialised deps are the dependency; `loader` is a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = state.key !== key;
  return { data: state.data, error: loading ? null : state.error, loading };
}

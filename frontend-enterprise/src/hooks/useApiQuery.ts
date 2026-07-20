import { useCallback, useEffect, useRef, useState } from 'react';

export type ApiQueryResult<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  setData: (value: T | null) => void;
};

/**
 * Shared data-fetching hook: one implementation of the
 * loading / error / cancel-on-unmount / refresh cycle that pages currently
 * re-implement inline around every `api.get` call.
 *
 * Pass `null` as the fetcher to keep the query idle (e.g. while a route
 * param is missing).
 */
export function useApiQuery<T>(
  fetcher: (() => Promise<T>) | null,
  deps: readonly unknown[],
  options?: { onError?: (error: Error) => void },
): ApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;

  useEffect(() => {
    const run = fetcherRef.current;
    if (!run) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    run()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((raised) => {
        if (cancelled) return;
        const normalized = raised instanceof Error ? raised : new Error(String(raised));
        setError(normalized);
        onErrorRef.current?.(normalized);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { data, loading, error, refresh, setData };
}

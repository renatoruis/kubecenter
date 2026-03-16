"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, ApiClientError } from "@/lib/api";

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

export function useApi<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: { refreshInterval?: number },
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<T>(path, params);
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.body?.message || err.message);
      } else {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      }
    } finally {
      setLoading(false);
    }
  }, [path, JSON.stringify(params)]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (options?.refreshInterval && options.refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        void fetchData();
      }, options.refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, options?.refreshInterval]);

  return { data, error, loading, lastUpdated, refetch: fetchData };
}

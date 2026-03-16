"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, ApiClientError } from "@/lib/api";

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useApi<T>(path: string, params?: Record<string, string | number | boolean | undefined>): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<T>(path, params);
      setData(result);
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

  return { data, error, loading, refetch: fetchData };
}

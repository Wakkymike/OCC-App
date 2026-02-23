
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 10000; // Increased to 10 seconds for stability

export function useBusTracker() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const timeoutId = useRef<number | undefined>();

  const fetchBuses = useCallback(async () => {
    try {
      const res = await fetch('/api/buses');

      if (!res.ok) {
        let errorMessage = `API Error: ${res.status}`;
        if (res.status === 502) {
          errorMessage = "Data service temporarily unavailable (Bad Gateway). Retrying...";
        } else {
          try {
            const errorData = await res.json();
            if (errorData.error) errorMessage = errorData.error;
          } catch {
            errorMessage = res.statusText || `Failed to fetch bus data.`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      setBuses(data.buses || []);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLastRefreshed(new Date());
      timeoutId.current = window.setTimeout(fetchBuses, FETCH_INTERVAL);
    }
  }, []);

  useEffect(() => {
    fetchBuses();
    return () => {
      if (timeoutId.current) {
        window.clearTimeout(timeoutId.current);
      }
    };
  }, [fetchBuses]);

  return { buses, error, lastRefreshed };
}

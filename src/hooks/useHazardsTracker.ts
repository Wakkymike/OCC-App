'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Hazard } from '@/lib/types';

const FETCH_INTERVAL = 60000 * 30; // Restrictions don't change often, fetch every 30 mins

export function useHazardsTracker() {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const timeoutId = useRef<number | undefined>();

  const fetchHazards = useCallback(async () => {
    try {
      const res = await fetch('/api/hazards');

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to fetch hazard data.`);
      }

      const data = await res.json();
      setHazards(data.hazards || []);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLastRefreshed(new Date());
      timeoutId.current = window.setTimeout(fetchHazards, FETCH_INTERVAL);
    }
  }, []);

  useEffect(() => {
    fetchHazards();
    return () => {
      if (timeoutId.current) {
        window.clearTimeout(timeoutId.current);
      }
    };
  }, [fetchHazards]);

  return { hazards, error, lastRefreshed };
}

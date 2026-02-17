'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Roadwork } from '@/lib/types';

const FETCH_INTERVAL = 60000 * 5; // Fetch every 5 minutes for roadworks

export function useRoadworksTracker() {
  const [roadworks, setRoadworks] = useState<Roadwork[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const timeoutId = useRef<number | undefined>();

  const fetchRoadworks = useCallback(async () => {
    try {
      const res = await fetch('/api/roadworks');

      if (!res.ok) {
        let errorMessage = `API Error: ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          errorMessage = res.statusText || `Failed to fetch roadworks data.`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setRoadworks(data.roadworks || []);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      
      if (message.toLowerCase().includes('failed to fetch')) {
        setError('Network error: Could not connect to the roadworks data service.');
      } else {
        setError(message);
      }
      setRoadworks([]);
    } finally {
      setLastRefreshed(new Date());
      timeoutId.current = window.setTimeout(fetchRoadworks, FETCH_INTERVAL);
    }
  }, []);

  useEffect(() => {
    fetchRoadworks();
    return () => {
      if (timeoutId.current) {
        window.clearTimeout(timeoutId.current);
      }
    };
  }, [fetchRoadworks]);

  return { roadworks, error, lastRefreshed };
}

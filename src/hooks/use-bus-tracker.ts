'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000;

export function useBusTracker() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timeoutId = useRef<number | undefined>();

  const fetchBuses = useCallback(async () => {
    try {
      const res = await fetch('/api/buses');

      if (!res.ok) {
        let errorMessage = `API Error: ${res.status}`;
        try {
          // Attempt to parse a more specific error from the JSON body
          const errorData = await res.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // The error response wasn't JSON, use status text or a generic message
          errorMessage = res.statusText || `Failed to fetch bus data.`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setBuses(data.buses || []);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      
      // Provide a more user-friendly message for generic network errors
      if (message.toLowerCase().includes('failed to fetch')) {
        setError('Network error: Could not connect to the bus data service.');
      } else {
        setError(message);
      }
      setBuses([]);
    } finally {
      // Schedule the next poll, regardless of success or failure
      timeoutId.current = window.setTimeout(fetchBuses, FETCH_INTERVAL);
    }
  }, []); // useCallback has no dependencies as it's self-contained

  useEffect(() => {
    // Start the polling
    fetchBuses();

    // Cleanup function to clear the timeout when the component unmounts
    return () => {
      if (timeoutId.current) {
        window.clearTimeout(timeoutId.current);
      }
    };
  }, [fetchBuses]); // useEffect depends on the memoized fetchBuses function

  return { buses, error };
}

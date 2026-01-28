'use client';

import { useState, useEffect } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000;

export function useBusTracker() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const res = await fetch('/api/buses');
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setBuses(data.buses || []);
        setError(null);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setBuses([]);
      }
    };

    fetchBuses();
    const intervalId = window.setInterval(fetchBuses, FETCH_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  return { buses, error };
}

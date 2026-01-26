'use client';
// This hook fetches data from the API route defined in `src/app/api/buses/route.ts`

import { useState, useEffect } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000; // 5 seconds

export function useBusTracker() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch all buses from the API
  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const response = await fetch('/api/buses');
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        const newBuses: Bus[] = data.buses || [];

        setBuses(newBuses);
        setError(null);
      } catch (err: unknown) {
        console.error('Error fetching buses:', err);
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

// This hook fetches data from the API route defined in: src/app/api/buses/route.ts
import { useState, useEffect } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000; // fetch every 5 seconds

export const useBusTracker = () => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchBuses = async () => {
      try {
        const response = await fetch('/api/buses');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || `Failed to fetch bus data with status: ${response.status}`);
        }
        
        const data = await response.json();

        const busesArray = Array.isArray(data.buses) ? data.buses : [];

        if (!isMounted) return;

        setBuses(busesArray);
        setError(null);

      } catch (err: any) {
        console.error('Error fetching buses:', err);
        if (!isMounted) return;

        setError(err.message || 'Failed to fetch bus data');
        setBuses([]);
      }
    };

    fetchBuses();
    const intervalId = setInterval(fetchBuses, FETCH_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return { buses, error };
};

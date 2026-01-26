"use client";

import { useState, useEffect } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000; // 5 seconds

export const useBusTracker = () => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const response = await fetch('/api/buses');
        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
          throw new Error(data.error || 'Failed to fetch bus data');
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          console.log(`Fetched ${data.length} buses from backend`);
          setBuses(data);
          setError(null);
        } else {
          console.warn('Backend returned non-array data:', data);
          setBuses([]);
          setError(data.error || 'Bus API returned invalid data.');
        }
      } catch (err: any) {
        console.error('Error fetching buses:', err);
        setError(err.message);
        setBuses([]);
      }
    };

    fetchBuses();
    const intervalId = setInterval(fetchBuses, FETCH_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return { buses, error };
};

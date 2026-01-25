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
        if (!Array.isArray(data)) {
          console.error("Bus API response is not an array: ", data);
          throw new Error('Bus API returned invalid data.');
        }
        setBuses(data);
        setError(null);
      } catch (err: any) {
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

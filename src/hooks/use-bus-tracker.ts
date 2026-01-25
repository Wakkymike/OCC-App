"use client";

import { useState, useEffect } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 15000; // 15 seconds

export const useBusTracker = () => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const response = await fetch('/api/buses');
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch bus data');
        }
        const data: Bus[] = await response.json();
        setBuses(data);
        setError(null);
      } catch (error: any) {
        console.error('Error fetching bus data:', error);
        setError(error.message);
      }
    };

    fetchBuses(); // Initial fetch
    const intervalId = setInterval(fetchBuses, FETCH_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return buses;
};

'use client';
// This hook fetches data from the API route defined in `src/app/api/buses/route.ts`

import { useState, useEffect } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000; // 5 seconds

export function useBusTracker(searchQuery: string, searchType: keyof Bus) {
  const [allBuses, setAllBuses] = useState<Bus[]>([]);
  const [filteredBuses, setFilteredBuses] = useState<Bus[]>([]);
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
        setAllBuses(data.buses || []);
        setError(null);
      } catch (err: unknown) {
        console.error('Error fetching buses:', err);
        setError(err instanceof Error ? err.message : String(err));
        setAllBuses([]);
      }
    };

    fetchBuses();
    const intervalId = window.setInterval(fetchBuses, FETCH_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  // Filter buses based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredBuses(allBuses);
      return;
    }

    const lowercasedQuery = searchQuery.toLowerCase();
    const results = allBuses.filter(bus => {
      const propertyValue = bus[searchType];
      if (typeof propertyValue === 'string') {
          return propertyValue.toLowerCase().includes(lowercasedQuery);
      }
      return false;
    });

    setFilteredBuses(results);
  }, [searchQuery, searchType, allBuses]);

  return { buses: filteredBuses, error };
}

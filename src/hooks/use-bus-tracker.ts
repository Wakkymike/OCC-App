import { useState, useEffect } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000;

export const useBusTracker = () => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const response = await fetch('/api/buses');

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (data && Array.isArray(data.buses)) {
          setBuses(data.buses);
          if (data.buses.length === 0) {
            console.warn('API returned 0 buses.');
            setError('No active buses found.');
          } else {
            setError(null); // Clear previous errors on success
          }
        } else {
          console.warn('Received invalid data from API. Expected an object with a "buses" array.', data);
          setBuses([]);
          setError('Received invalid data from API.');
        }
      } catch (err: any) {
        console.error('Error fetching buses:', err);
        setError(err.message);
        setBuses([]);
      }
    };

    fetchBuses();
    const intervalId = setInterval(fetchBuses, FETCH_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  return { buses, error };
};

'use client';
// This hook fetches data from the API route defined in `src/app/api/buses/route.ts`

import { useState, useEffect, useRef } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000; // 5 seconds

export function useBusTracker() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previousBusesMapRef = useRef<Map<string, Bus>>(new Map());

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
        const previousBusesMap = previousBusesMapRef.current;
        const newBusesMap = new Map<string, Bus>();
        
        // A small threshold to account for GPS jitter. Approx 1.1 meters.
        const MOVEMENT_THRESHOLD = 0.00001;

        const busesWithStatus = newBuses.map(bus => {
          const markerId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}`;
          newBusesMap.set(markerId, bus);

          const prevBus = previousBusesMap.get(markerId);
          let status: 'moving' | 'stopped' = 'stopped';

          if (prevBus) {
            const latDiff = bus.position.lat - prevBus.position.lat;
            const lngDiff = bus.position.lng - prevBus.position.lng;
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

            if (distance > MOVEMENT_THRESHOLD) {
              status = 'moving';
            }
          }
          
          return { ...bus, status };
        });

        setBuses(busesWithStatus);
        previousBusesMapRef.current = newBusesMap;
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

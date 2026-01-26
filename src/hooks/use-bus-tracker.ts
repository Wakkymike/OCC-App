'use client';
// This hook fetches data from the API route defined in `src/app/api/buses/route.ts`

import { useState, useEffect, useRef } from 'react';
import type { Bus, LatLng } from '@/lib/types';

const FETCH_INTERVAL = 5000; // 5 seconds

// Helper function to calculate distance between two lat/lng points in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}


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

        const busesWithStatus: Bus[] = newBuses.map(bus => {
          const markerId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
          newBusesMap.set(markerId, bus);

          const prevBus = previousBusesMap.get(markerId);
          let status: 'moving' | 'stopped' = 'stopped';
          let speedMph: number | undefined = 0;

          if (prevBus) {
             const distanceInMeters = haversineDistance(
                prevBus.position.lat,
                prevBus.position.lng,
                bus.position.lat,
                bus.position.lng
            );

            // Speed in meters per second
            const speedMps = distanceInMeters / (FETCH_INTERVAL / 1000);
            
            // Convert to mph and round it
            speedMph = Math.round(speedMps * 2.23694);

            if (speedMph > 0) {
              status = 'moving';
            }
          }
          
          return { ...bus, status, speed: speedMph };
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

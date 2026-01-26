'use client';

import { useState, useEffect } from 'react';
import type { Bus } from '@/lib/types';

const FETCH_INTERVAL = 5000; // 5 seconds

export function useBusTracker() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timer;

    const fetchBuses = async () => {
      try {
        const apiKey = process.env.BODS_API_KEY;
        const feedId = '18880'; // Bee Network Go NW

        if (!apiKey) {
          setError('BODS_API_KEY is missing');
          setBuses([]);
          return;
        }

        const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/${feedId}/?api_key=${apiKey}`;
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`BODS API Error ${response.status}: ${text}`);
        }

        const xmlText = await response.text();

        // Parse XML
        const { XMLParser } = await import('fast-xml-parser');
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '',
          removeNSPrefix: true,
        });
        const data = parser.parse(xmlText);

        // Collect all VehicleActivity
        const deliveries = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery ?? [];
        const deliveriesArray = Array.isArray(deliveries) ? deliveries : [deliveries];

        let vehicleActivities: any[] = [];

        deliveriesArray.forEach((delivery: any) => {
          let activities = delivery?.VehicleActivity ?? [];
          if (!activities) return;
          if (!Array.isArray(activities)) activities = [activities];
          vehicleActivities.push(...activities);
        });

        // Map to Bus[]
        const mappedBuses: Bus[] = vehicleActivities
          .map((activity) => {
            const journey = activity.MonitoredVehicleJourney;
            if (!journey?.VehicleLocation?.Latitude || !journey?.VehicleLocation?.Longitude) return null;

            const lat = parseFloat(journey.VehicleLocation.Latitude);
            const lng = parseFloat(journey.VehicleLocation.Longitude);
            if (isNaN(lat) || isNaN(lng)) return null;

            return {
              fleetNumber: journey.VehicleRef ?? 'unknown',
              runningBoard: journey.BlockRef ?? 'unknown',
              service: journey.PublishedLineName ?? 'unknown',
              destination: journey.DestinationName?.replace(/_/g, ' ') ?? 'unknown',
              direction: journey.DirectionRef ?? 'unknown',
              position: { lat, lng },
            };
          })
          .filter(Boolean) as Bus[];

        setBuses(mappedBuses);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching BODS buses:', err);
        setError(err instanceof Error ? err.message : String(err));
        setBuses([]);
      }
    };

    fetchBuses();
    intervalId = setInterval(fetchBuses, FETCH_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  return { buses, error };
}

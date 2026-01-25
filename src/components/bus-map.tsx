'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import type { Bus } from '@/lib/types';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { useToast } from '@/hooks/use-toast';

// Using a data URI for the bus icon to combine background and icon into one image asset
const BusIconUri = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="%233498db" style="border: 2px solid rgba(250, 250, 250, 0.7); box-sizing: border-box;"/><g transform="translate(4 4)"><path d="M8 6v6" stroke="%23FAFAFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6v6" stroke="%23FAFAFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12h19.6" stroke="%23FAFAFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" stroke="%23FAFAFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="18" r="2" fill="none" stroke="%23FAFAFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="18" r="2" fill="none" stroke="%23FAFAFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

// Helper to calculate bearing between two points
const getBearing = (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (start.lat === end.lat && start.lng === end.lng) {
        return null; // No bearing if position hasn't changed
    }

    const startLat = (start.lat * Math.PI) / 180;
    const startLng = (start.lng * Math.PI) / 180;
    const endLat = (end.lat * Math.PI) / 180;
    const endLng = (end.lng * Math.PI) / 180;

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    const bearing = Math.atan2(y, x);
    return ((bearing * 180) / Math.PI + 360) % 360; // convert to degrees
};

interface MarkerData {
    marker: mapboxgl.Marker;
    bus: Bus;
}

export default function BusMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, MarkerData>>({});
  const { buses, error } = useBusTracker();
  const { toast } = useToast();

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-2.2426, 53.4808], // Centered on Greater Manchester area
      zoom: 10,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current = map;

    // Animation loop for smooth marker movement
    let animationFrame: number;
    const animateMarkers = () => {
        Object.values(markersRef.current).forEach(({ marker, bus }) => {
            const currentPos = marker.getLngLat();
            const targetPos = bus.position;

            // Linear interpolation for smooth movement
            const interpolatedLng = currentPos.lng + (targetPos.lng - currentPos.lng) * 0.1;
            const interpolatedLat = currentPos.lat + (targetPos.lat - currentPos.lat) * 0.1;

            marker.setLngLat([interpolatedLng, interpolatedLat]);
        });

        animationFrame = requestAnimationFrame(animateMarkers);
    }
    animateMarkers();
    
    return () => cancelAnimationFrame(animationFrame);

  }, []); // Runs once to initialize map and animation loop

  useEffect(() => {
    if (error) {
        toast({
            variant: "destructive",
            title: "Could not fetch bus data",
            description: error,
        });
    }
  }, [error, toast]);

  useEffect(() => {
    if (!mapRef.current) return;

    const currentBusIds = new Set(buses.map(bus => bus.id));
    const map = mapRef.current;
    
    // Update existing markers' target data or add new markers
    buses.forEach(bus => {
      const existing = markersRef.current[bus.id];

      if (existing) {
        const oldPos = existing.bus.position;
        const bearing = getBearing(oldPos, bus.position);
        
        // Update the target data for the animation loop
        existing.bus = bus;
        
        // Update rotation
        const el = existing.marker.getElement();
        const icon = el.querySelector('img');
        if (icon && bearing !== null) {
            (icon as HTMLElement).style.transform = `rotate(${bearing}deg)`;
        }

      } else {
        // Create new marker if it doesn't exist
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.innerHTML = `
          <div class="bus-flag">
            ${bus.service} → ${bus.destination}<br/>
            <span class="fleet-number">Fleet: ${bus.fleetNumber}</span>
          </div>
          <img src="${BusIconUri}" width="32" height="32" />
        `;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([bus.position.lng, bus.position.lat])
          .addTo(map);

        markersRef.current[bus.id] = { marker, bus };
      }
    });

    // Remove markers for buses that are no longer in the data
    Object.keys(markersRef.current).forEach(busId => {
      if (!currentBusIds.has(busId)) {
        markersRef.current[busId].marker.remove();
        delete markersRef.current[busId];
      }
    });

  }, [buses]);

  return <div ref={mapContainer} id="map" style={{ width: '100%', height: '100%' }} />;
}

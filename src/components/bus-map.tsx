'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import type { Bus } from '@/lib/types';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { useToast } from '@/hooks/use-toast';

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

// Optional: assign a color per service
const colorPalette = ['#FFD100','#FF6F00','#1E88E5','#43A047','#8E24AA','#E53935'];
const serviceColors: Record<string,string> = {};
const getServiceColor = (service: string) => {
  if (!serviceColors[service]) {
    serviceColors[service] = colorPalette[Object.keys(serviceColors).length % colorPalette.length];
  }
  return serviceColors[service];
};

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

            if (currentPos.lat === targetPos.lat && currentPos.lng === targetPos.lng) {
                return; // No need to animate if we're at the target
            }

            // Linear interpolation for smooth movement
            const interpolatedLng = currentPos.lng + (targetPos.lng - currentPos.lng) * 0.1;
            const interpolatedLat = currentPos.lat + (targetPos.lat - currentPos.lat) * 0.1;

            marker.setLngLat([interpolatedLng, interpolatedLat]);

            // Calculate bearing and rotate
            const bearing = getBearing({ lat: currentPos.lat, lng: currentPos.lng }, targetPos);
            const el = marker.getElement();
            const icon = el.querySelector('svg');
            if (icon && bearing !== null) {
                (icon as HTMLElement).style.transform = `rotate(${bearing}deg)`;
            }
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
        // Update the target data for the animation loop
        existing.bus = bus;
      } else {
        // Create new marker if it doesn't exist
        const busColor = getServiceColor(bus.service);
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.innerHTML = `
          <div class="bus-flag" style="background:${busColor};">
            ${bus.service} → ${bus.destination}<br/>
            Fleet: ${bus.fleetNumber}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 64 64">
            <rect x="8" y="16" width="48" height="32" rx="6" ry="6" fill="${busColor}" stroke="#000" stroke-width="1"/>
            <rect class="stripe" x="8" y="28" width="48" height="8" fill="#000"/>
            <rect x="16" y="20" width="8" height="8" fill="#fff"/>
            <rect x="40" y="20" width="8" height="8" fill="#fff"/>
            <circle cx="20" cy="52" r="4" fill="#333"/>
            <circle cx="44" cy="52" r="4" fill="#333"/>
          </svg>
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

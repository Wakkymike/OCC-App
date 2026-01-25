'use client';

import mapboxgl, { Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useState, useRef } from 'react';
import type { Bus } from '@/lib/types';

// Using an inline SVG for the bus icon to avoid needing a separate file
const BusIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 6v6"/>
    <path d="M16 6v6"/>
    <path d="M2 12h19.6"/>
    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
    <circle cx="7" cy="18" r="2"/>
    <circle cx="17" cy="18" r="2"/>
</svg>
`;

export default function BusMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const markers = useRef<Marker[]>([]);

  // Fetch bus data from the API route
  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const res = await fetch('/api/buses');
        if (res.ok) {
          const data: Bus[] = await res.json();
          setBuses(data);
        } else {
          console.error("Failed to fetch buses. Status:", res.status);
        }
      } catch (error) {
        console.error("Error fetching buses:", error);
      }
    };

    fetchBuses();
    const interval = setInterval(fetchBuses, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return; // initialize map only once
    
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-2.2426, 53.4808], // Centered on Greater Manchester area
      zoom: 10,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

  }, []);

  // Update markers when bus data changes
  useEffect(() => {
    if (!map.current) return;

    // Create a map of existing markers by bus ID for efficient updates
    const markerMap = new Map(markers.current.map(m => [(m.getElement() as HTMLElement).dataset.busId, m]));
    const newMarkers: Marker[] = [];
    const currentBusIds = new Set();

    buses.forEach(bus => {
      currentBusIds.add(bus.id);
      const pos: [number, number] = [bus.position.lng, bus.position.lat];

      // If marker exists, update its position
      if (markerMap.has(bus.id)) {
        const marker = markerMap.get(bus.id)!;
        marker.setLngLat(pos);
        newMarkers.push(marker);
        markerMap.delete(bus.id);
      } else {
        // Otherwise, create a new marker
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.dataset.busId = bus.id;
        el.innerHTML = `
          <div class="bus-icon-wrapper">
            ${BusIconSvg}
          </div>
          <div class="bus-flag">
            <b>${bus.service}</b> to <b>${bus.destination}</b>
            <div class="fleet-number">Fleet: ${bus.fleetNumber}</div>
          </div>
        `;

        const newMarker = new mapboxgl.Marker(el)
          .setLngLat(pos)
          .addTo(map.current!);
        
        newMarkers.push(newMarker);
      }
    });

    // Remove markers for buses that are no longer in the data
    markerMap.forEach(marker => marker.remove());

    // Update the markers ref
    markers.current = newMarkers;

  }, [buses]);

  return <div ref={mapContainer} id="map" style={{ width: '100%', height: '100%' }} />;
}

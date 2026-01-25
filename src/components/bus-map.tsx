'use client';

import mapboxgl, { Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useState, useRef } from 'react';
import type { Bus } from '@/lib/types';

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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const [buses, setBuses] = useState<Bus[]>([]);

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
  }, []);

  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const res = await fetch('/api/buses');
        const data: Bus[] = await res.json();
        setBuses(data);
      } catch (err) {
        console.error('Error fetching buses:', err);
      }
    };

    fetchBuses();
    const interval = setInterval(fetchBuses, 15000); // fetch every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const currentBusIds = new Set(buses.map(bus => bus.id));
    const map = mapRef.current;
    
    // Update existing markers or add new ones
    buses.forEach(bus => {
      const pos: [number, number] = [bus.position.lng, bus.position.lat];

      if (markersRef.current[bus.id]) {
        markersRef.current[bus.id].setLngLat(pos);
      } else {
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.innerHTML = `
          <div class="bus-flag">
            ${bus.service} → ${bus.destination}<br/>
            <span class="fleet-number">Fleet: ${bus.fleetNumber}</span>
          </div>
          <div class="bus-icon-wrapper">
            ${BusIconSvg}
          </div>
        `;

        const marker = new mapboxgl.Marker(el)
          .setLngLat(pos)
          .addTo(map);

        markersRef.current[bus.id] = marker;
      }
    });

    // Remove markers for buses that are no longer in the data
    Object.keys(markersRef.current).forEach(busId => {
      if (!currentBusIds.has(busId)) {
        markersRef.current[busId].remove();
        delete markersRef.current[busId];
      }
    });

  }, [buses]);

  return <div ref={mapContainer} id="map" style={{ width: '100%', height: '100%' }} />;
}

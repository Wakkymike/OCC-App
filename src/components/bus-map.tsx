'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import type { Bus, LatLng } from '@/lib/types';

const colorPalette = ['#FF6F00','#1E88E5','#43A047','#8E24AA','#E53935', '#FFD100'];
const serviceColors: Record<string, string> = {};
const getServiceColor = (service: string) => {
  if (!serviceColors[service]) {
    serviceColors[service] = colorPalette[Object.keys(serviceColors).length % colorPalette.length];
  }
  return serviceColors[service];
};

interface BusMapProps {
    buses: Bus[];
    zoomToPosition?: LatLng | null;
}

export default function BusMap({ buses, zoomToPosition }: BusMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});

  // Initialize Map
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-2.24, 53.48], // Manchester center
      zoom: 11,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  }, []);

  // Effect to fly to a specific bus
  useEffect(() => {
    if (mapRef.current && zoomToPosition) {
      mapRef.current.flyTo({
        center: [zoomToPosition.lng, zoomToPosition.lat],
        zoom: 15,
        essential: true,
      });
    }
  }, [zoomToPosition]);

  // Update markers when buses change
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const currentBusIds = new Set(buses.map(bus => bus.id));

    buses.forEach(bus => {
      const { id, position, service, destination, fleetNumber } = bus;
      const busColor = getServiceColor(service);

      const elContent = `
        <div class="bus-flag" style="background-color:${busColor};">
          ${service} → ${destination}<br/>
          Fleet: ${fleetNumber}
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

      if (markersRef.current[id]) {
        // Update position of existing marker
        markersRef.current[id].setLngLat([position.lng, position.lat]);
        
        const markerElement = markersRef.current[id].getElement();
        if (markerElement.innerHTML !== elContent) {
            markerElement.innerHTML = elContent;
        }

      } else {
        // Create new marker
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.innerHTML = elContent;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([position.lng, position.lat])
          .addTo(map);

        markersRef.current[id] = marker;
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

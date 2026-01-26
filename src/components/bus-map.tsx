'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css'; // 🔑 Import Mapbox CSS
import type { Bus } from '@/lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

interface BusMapProps {
  buses: Bus[];
}

export default function BusMap({ buses }: BusMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  // Store markers so we can update positions instead of recreating
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});

  // ---------------------------
  // Initialize Map
  // ---------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-2.24, 53.48], // Manchester area
      zoom: 11,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl());
    
    map.on('load', () => {
      map.addSource('mapbox-traffic', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-traffic-v1',
      });
      map.addLayer(
        {
          id: 'traffic-layer',
          type: 'line',
          source: 'mapbox-traffic',
          'source-layer': 'traffic',
          paint: {
            'line-width': 1.5,
            'line-color': [
              'case',
              ['==', 'heavy', ['get', 'congestion']],
              '#e55e5e',
              ['==', 'severe', ['get', 'congestion']],
              '#b43b3b',
              ['==', 'moderate', ['get', 'congestion']],
              '#ffc62e',
              '#42c86b', // low and default
            ],
          },
        },
        'waterway-label' // Add layer before waterway labels
      );
    });

    return () => map.remove();
  }, []);

  // ---------------------------
  // Draw Selected Bus Route
  // ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const removeRoute = () => {
      if (map.getLayer('bus-route-layer')) {
        map.removeLayer('bus-route-layer');
      }
      if (map.getSource('bus-route')) {
        map.removeSource('bus-route');
      }
    };

    if (!selectedBusId) {
      removeRoute();
      return;
    }

    const selectedBus = buses.find(b => {
      const id = `${b.fleetNumber}-${b.runningBoard}-${b.service}-${b.direction}`;
      return id === selectedBusId;
    });
    
    if (!selectedBus || !selectedBus.path || selectedBus.path.length < 2) {
      removeRoute();
      return;
    }

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: selectedBus.path.map(p => [p.lng, p.lat]),
      },
    };
    
    const source = map.getSource('bus-route') as mapboxgl.GeoJSONSource;

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource('bus-route', {
        type: 'geojson',
        data: geojson,
      });

      map.addLayer({
        id: 'bus-route-layer',
        type: 'line',
        source: 'bus-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#007cbf',
          'line-width': 4,
        },
      });
    }
  }, [selectedBusId, buses]);

  // ---------------------------
  // Render / Update Bus Markers
  // ---------------------------
  useEffect(() => {
    if (!mapRef.current) return;

    const currentMarkerIds = new Set(Object.keys(markersRef.current));

    buses.forEach((bus) => {
      // A unique ID for each marker is crucial. A combination of fields that
      // uniquely identifies a specific bus on a specific journey is best.
      const markerId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}`;
      currentMarkerIds.delete(markerId);

      // Create marker if it doesn't exist
      if (!markersRef.current[markerId]) {
        const el = document.createElement('div');

        // Marker container
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';
        el.style.cursor = 'pointer';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedBusId(prevId => (prevId === markerId ? null : markerId));
        });

        // Flag showing info
        const flag = document.createElement('div');
        flag.style.background = 'white';
        flag.style.padding = '2px 6px';
        flag.style.border = '1px solid black';
        flag.style.borderRadius = '4px';
        flag.style.fontSize = '10px';
        flag.style.fontWeight = 'bold';
        flag.style.whiteSpace = 'nowrap';
        
        const iconContainer = document.createElement('div');
        // SVG for the bus icon with an arrow. The arrow points up (0 degrees).
        iconContainer.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" style="transform: rotate(0deg); transition: transform 0.2s linear;">
            <circle cx="12" cy="15" r="9" fill="yellow" stroke="black" stroke-width="1.5" />
            <path d="M12 0 L18 8 L6 8 Z" fill="black" />
          </svg>
        `.trim();
        
        el.appendChild(flag);
        el.appendChild(iconContainer.firstChild!); // Append the SVG element.
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat([bus.position.lng, bus.position.lat])
          .addTo(mapRef.current!);
        
        markersRef.current[markerId] = marker;
      }
      
      // Update existing marker position and info
      const marker = markersRef.current[markerId];
      marker.setLngLat([bus.position.lng, bus.position.lat]);
      const markerElement = marker.getElement();
      const flagElement = markerElement.querySelector('div') as HTMLDivElement;
      
      let serviceDisplay = bus.service;
      const serviceStr = String(bus.service);

      if (bus.direction.toLowerCase() === 'inbound') {
        serviceDisplay += ` <span style="color: blue;">[I]</span>`;
      } else if (bus.direction.toLowerCase() === 'outbound') {
        serviceDisplay += ` <span style="color: blue;">[O]</span>`;
      }

      if (serviceStr.length === 3 && (serviceStr.startsWith('7') || serviceStr.startsWith('8'))) {
        serviceDisplay += ` <span style="color: red;">(SCH)</span>`;
      }

      let statusDisplay = '';
      if (bus.status) {
        const speedDisplay = bus.speed !== undefined ? ` (${bus.speed} mph)` : '';
        if (bus.status === 'moving') {
          statusDisplay = `<br/><i style="color: green;">moving${speedDisplay}</i>`;
        } else {
          statusDisplay = `<br/><i style="color: red;">stopped${speedDisplay}</i>`;
        }
      }

      flagElement.innerHTML = `${bus.fleetNumber} | ${serviceDisplay} | ${bus.destination.replace(/_/g, ' ')} | ${bus.runningBoard}${statusDisplay}`;
      
      // Rotate the SVG arrow based on bus bearing
      const svgElement = markerElement.querySelector('svg');
      if (svgElement && bus.bearing !== undefined) {
        svgElement.style.transform = `rotate(${bus.bearing}deg)`;
      }
    });

    // Remove markers for buses that are no longer in the feed
    currentMarkerIds.forEach((id) => {
      markersRef.current[id].remove();
      delete markersRef.current[id];
    });
  }, [buses]);

  return (
    <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
  );
}

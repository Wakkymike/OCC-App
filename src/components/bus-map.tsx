'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Bus, LatLng } from '@/lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

interface BusMapProps {
  buses: Bus[];
  selectedBusId: string | null;
  setSelectedBusId: (id: string | null) => void;
  searchedPlace?: LatLng | null;
  mapView?: {
    center?: LatLng;
    bounds?: mapboxgl.LngLatBounds;
    zoom?: number;
  };
}

export default function BusMap({
  buses,
  selectedBusId,
  setSelectedBusId,
  searchedPlace = null,
  mapView,
}: BusMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const placeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const animationFrameRefs = useRef<Record<string, number>>({});

  // ---------------------------
  // Initialize map
  // ---------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) {
      console.error('Mapbox access token is not set. The map cannot be initialized.');
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-2.24, 53.48],
      zoom: 11,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl());

    map.on('error', (e) => {
      console.error('A Mapbox error occurred:', e.error);
    });

    map.on('click', () => {
      setSelectedBusId(null);
    });

    return () => {
      // Clean up animations and map instance
      Object.values(animationFrameRefs.current).forEach(cancelAnimationFrame);
      animationFrameRefs.current = {};
      if (map) {
        map.remove();
      }
      mapRef.current = null; // Explicitly clear the ref to prevent race conditions
    };
  }, []);

  // ---------------------------
  // Update bus markers with animation
  // ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const animateMarkerPosition = (
      marker: mapboxgl.Marker,
      endPosition: LatLng,
      markerId: string
    ) => {
      if (animationFrameRefs.current[markerId]) {
        cancelAnimationFrame(animationFrameRefs.current[markerId]);
      }

      const startLngLat = marker.getLngLat();
      const startPosition = { lat: startLngLat.lat, lng: startLngLat.lng };
      const animationDuration = 4000; // Just under the 5s refresh interval
      const startTime = performance.now();
      
      if (startPosition.lat === endPosition.lat && startPosition.lng === endPosition.lng) {
        return; // No movement needed
      }

      const frame = () => {
        const now = performance.now();
        const progress = Math.min(1, (now - startTime) / animationDuration);
        
        const lng = startPosition.lng + (endPosition.lng - startPosition.lng) * progress;
        const lat = startPosition.lat + (endPosition.lat - startPosition.lat) * progress;

        marker.setLngLat([lng, lat]);

        if (progress < 1) {
          animationFrameRefs.current[markerId] = requestAnimationFrame(frame);
        } else {
          delete animationFrameRefs.current[markerId];
        }
      };

      animationFrameRefs.current[markerId] = requestAnimationFrame(frame);
    };

    const currentMarkerIds = new Set(Object.keys(markersRef.current));

    buses.forEach((bus) => {
      // Don't render buses without a position (e.g. cancelled buses)
      if (!bus.position) {
        return;
      }
      
      const markerId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
      currentMarkerIds.delete(markerId);

      let marker = markersRef.current[markerId];

      if (!marker) {
        const el = document.createElement('div');
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';
        el.style.cursor = 'pointer';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedBusId(markerId);
        });

        // Bus flag
        const flag = document.createElement('div');
        flag.style.background = 'white';
        flag.style.padding = '2px 6px';
        flag.style.border = '1px solid black';
        flag.style.borderRadius = '4px';
        flag.style.fontSize = '10px';
        flag.style.fontWeight = 'bold';
        flag.style.whiteSpace = 'nowrap';
        el.appendChild(flag);
        
        // Info flag for selected bus
        const infoFlag = document.createElement('div');
        infoFlag.className = 'bus-info-flag'; // Use a class for easy selection
        infoFlag.style.display = 'none'; // Hidden by default
        infoFlag.style.background = 'white';
        infoFlag.style.padding = '2px 6px';
        infoFlag.style.border = '1px solid black';
        infoFlag.style.borderRadius = '4px';
        infoFlag.style.fontSize = '10px';
        infoFlag.style.whiteSpace = 'nowrap';
        infoFlag.style.marginTop = '2px';
        infoFlag.style.textAlign = 'center';
        el.appendChild(infoFlag);


        // Arrow outside circle
        const arrowContainer = document.createElement('div');
        arrowContainer.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" style="transition: transform 0.2s linear, fill 0.2s, r 0.2s;">
            <circle cx="12" cy="12" r="9" fill="yellow" stroke="black" stroke-width="1.5" />
            <polygon points="12,0 16,6 8,6" fill="black" />
          </svg>
        `.trim();

        if (arrowContainer.firstChild) {
          el.appendChild(arrowContainer.firstChild);
        }

        marker = new mapboxgl.Marker(el)
          .setLngLat([bus.position.lng, bus.position.lat])
          .addTo(map);

        markersRef.current[markerId] = marker;
      } else {
        // Animate existing marker to its new position
        animateMarkerPosition(marker, bus.position, markerId);
      }

      // Update flag text
      const markerElement = marker.getElement();
      const flagElement = markerElement.querySelector('div') as HTMLDivElement;

      let directionLabel = '';
      if (bus.direction.toLowerCase() === 'inbound') {
        directionLabel = ` <span style="color:blue">[I]</span>`;
      } else if (bus.direction.toLowerCase() === 'outbound') {
        directionLabel = ` <span style="color:blue">[O]</span>`;
      }

      flagElement.innerHTML = `${bus.fleetNumber} | ${bus.service}${directionLabel} | To: ${bus.nextStop || bus.destination}`;

      // Rotate arrow based on bearing
      const svg = markerElement.querySelector('svg');
      if (svg && bus.bearing !== undefined) {
        svg.style.transform = `rotate(${bus.bearing}deg)`;
      }

      // Highlight selected bus and update info flag
      const isSelected = markerId === selectedBusId;
      const circle = markerElement.querySelector('circle');
      const infoFlag = markerElement.querySelector('.bus-info-flag') as HTMLDivElement;

      if (circle && infoFlag) {
        circle.setAttribute('fill', isSelected ? '#00FFFF' : 'yellow'); // Cyan
        circle.setAttribute('r', isSelected ? '11' : '9');
        circle.setAttribute('stroke', isSelected ? '#00008B' : 'black'); // Dark Blue

        if (isSelected) {
          infoFlag.innerHTML = `Next Stop: ${bus.nextStop || 'N/A'}<br>${bus.status}`;
          infoFlag.style.display = 'block';
        } else {
          infoFlag.style.display = 'none';
        }
      }
    });

    // Remove markers no longer active
    currentMarkerIds.forEach((id) => {
      if (markersRef.current[id]) {
        if (animationFrameRefs.current[id]) {
          cancelAnimationFrame(animationFrameRefs.current[id]);
          delete animationFrameRefs.current[id];
        }
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
      if (id === selectedBusId) setSelectedBusId(null);
    });
  }, [buses, selectedBusId]);

  // ---------------------------
  // Searched place marker & map view changes
  // ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (placeMarkerRef.current) {
      placeMarkerRef.current.remove();
      placeMarkerRef.current = null;
    }

    if (searchedPlace) {
      const el = document.createElement('div');
      el.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 10.5C21 17.5 12 23 12 23C12 23 3 17.5 3 10.5C3 6.35786 7.02944 3 12 3C16.9706 3 21 6.35786 21 10.5Z" fill="#FF4136" stroke="white" stroke-width="1.5"/>
          <circle cx="12" cy="10.5" r="3" fill="white"/>
        </svg>
      `.trim();

      const marker = new mapboxgl.Marker(el)
        .setLngLat(searchedPlace)
        .addTo(map);

      placeMarkerRef.current = marker;

      map.flyTo({
        center: searchedPlace,
        zoom: 14,
        essential: true,
      });
    } else if (mapView) {
      if (mapView.bounds) {
        map.fitBounds(mapView.bounds, { padding: 100, maxZoom: 15 });
      } else if (mapView.center) {
        map.flyTo({
          center: mapView.center,
          zoom: mapView.zoom || 16,
          essential: true,
        });
      }
    }
  }, [searchedPlace, mapView]);

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />;
}

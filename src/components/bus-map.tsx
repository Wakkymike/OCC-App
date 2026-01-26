'use client';

import { useEffect, useRef } from 'react';
import mapboxgl, { LngLatBoundsLike } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css'; // 🔑 Import Mapbox CSS
import type { Bus } from '@/lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

interface BusMapProps {
  buses: Bus[];
  selectedBusId: string | null;
  setSelectedBusId: (id: string | null) => void;
  boundsToFit?: LngLatBoundsLike | null;
  searchedPlace?: [number, number] | null;
}

export default function BusMap({ buses, selectedBusId, setSelectedBusId, boundsToFit, searchedPlace }: BusMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const placeMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Keep a ref to the setSelectedBusId function to avoid re-running effects
  // that would cause the map to be re-initialized.
  const setSelectedBusIdRef = useRef(setSelectedBusId);
  useEffect(() => {
    setSelectedBusIdRef.current = setSelectedBusId;
  }, [setSelectedBusId]);

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
    
    // Add a click listener to the map to deselect any bus
    map.on('click', () => {
        setSelectedBusIdRef.current(null);
    });

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
              '#42c86b', // low and default
            ],
          },
        },
        'waterway-label' // Add layer before waterway labels
      );
    });

    return () => map.remove();
  }, []);

  // ----------------------------------------
  // Handle View Changes (Zoom, Pan, Bounds)
  // ----------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update marker visibility based on selection
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const markerElement = marker.getElement();
      if (selectedBusId) {
        markerElement.style.display = id === selectedBusId ? 'flex' : 'none';
      } else {
        markerElement.style.display = 'flex';
      }
    });

    // Fly to selected bus, fit bounds, or go back to default view
    if (selectedBusId) {
      const selectedMarker = markersRef.current[selectedBusId];
      if (selectedMarker) {
        map.flyTo({
          center: selectedMarker.getLngLat(),
          zoom: 16,
          essential: true,
        });
      }
    } else if (boundsToFit) {
        map.fitBounds(boundsToFit, {
            padding: 100,
            essential: true,
        });
    } else if (!searchedPlace) { // Only fly to default if no place is searched
       // Only fly back to default view if the map is currently zoomed in.
       const currentZoom = map.getZoom();
       if (currentZoom > 12) {
          map.flyTo({
              center: [-2.24, 53.48],
              zoom: 11,
              essential: true,
          });
      }
    }
  }, [selectedBusId, boundsToFit, searchedPlace]);


  // ---------------------------
  // Render / Update Bus Markers
  // ---------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const currentMarkerIds = new Set(Object.keys(markersRef.current));

    buses.forEach((bus) => {
      const markerId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
      currentMarkerIds.delete(markerId);

      let marker = markersRef.current[markerId];

      if (!marker) {
        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';
        
        // Add click listener to select the bus
        el.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the map's click event from firing
            setSelectedBusIdRef.current(markerId);
        });

        const flag = document.createElement('div');
        flag.style.background = 'white';
        flag.style.padding = '2px 6px';
        flag.style.border = '1px solid black';
        flag.style.borderRadius = '4px';
        flag.style.fontSize = '10px';
        flag.style.fontWeight = 'bold';
        flag.style.whiteSpace = 'nowrap';
        
        const iconContainer = document.createElement('div');
        iconContainer.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" style="transform: rotate(0deg); transition: transform 0.2s linear;">
            <circle cx="12" cy="15" r="9" fill="yellow" stroke="black" stroke-width="1.5" />
            <path d="M12 0 L18 8 L6 8 Z" fill="black" />
          </svg>
        `.trim();
        
        el.appendChild(flag);
        if (iconContainer.firstChild) {
          el.appendChild(iconContainer.firstChild);
        }
        
        marker = new mapboxgl.Marker(el)
          .setLngLat([bus.position.lng, bus.position.lat])
          .addTo(map);
        
        markersRef.current[markerId] = marker;
      }
      
      // Update existing marker position and info
      marker.setLngLat([bus.position.lng, bus.position.lat]);
      const markerElement = marker.getElement();
      const flagElement = markerElement.querySelector('div') as HTMLDivElement;
      
      let serviceDisplay = bus.service;

      const specialJourneyRefs = ['9001', '9002', '9003', '9004', '9005'];
      if (bus.journeyRef && specialJourneyRefs.includes(String(bus.journeyRef))) {
          serviceDisplay += ` <span style="color: red;">[SCH]</span>`;
      }

      if (bus.direction.toLowerCase() === 'inbound') {
        serviceDisplay += ` <span style="color: blue;">[I]</span>`;
      } else if (bus.direction.toLowerCase() === 'outbound') {
        serviceDisplay += ` <span style="color: blue;">[O]</span>`;
      }

      let statusDisplay = '';
      if (bus.journeyRef) {
          statusDisplay = `<br/><i>${bus.journeyRef}</i>`;
      }

      flagElement.innerHTML = `${bus.fleetNumber} | ${serviceDisplay} | ${bus.destination.replace(/_/g, ' ')} | ${bus.runningBoard}${statusDisplay}`;
      
      const svgElement = markerElement.querySelector('svg');
      if (svgElement && bus.bearing !== undefined) {
        svgElement.style.transform = `rotate(${bus.bearing}deg)`;
      }

      // If the bus is selected and we are zoomed in, pan the map to its new location
      if (markerId === selectedBusId && map.getZoom() > 14) {
        const isPanning = map.isMoving() || map.isZooming();
        if (!isPanning) {
            map.panTo([bus.position.lng, bus.position.lat]);
        }
      }
    });

    // Remove markers for buses that are no longer in the feed
    currentMarkerIds.forEach((id) => {
      if(markersRef.current[id]) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
      // If the selected bus is one of the ones being removed, deselect it
      if (id === selectedBusId) {
        setSelectedBusIdRef.current(null);
      }
    });
  }, [buses, selectedBusId]);

  // ------------------------------------
  // Handle Searched Place
  // ------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up previous marker
    if (placeMarkerRef.current) {
        placeMarkerRef.current.remove();
        placeMarkerRef.current = null;
    }
    
    if (searchedPlace) {
        map.flyTo({
            center: searchedPlace as mapboxgl.LngLatLike,
            zoom: 14,
            essential: true,
        });

        const el = document.createElement('div');
        el.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 10.5C21 17.5 12 23 12 23C12 23 3 17.5 3 10.5C3 6.35786 7.02944 3 12 3C16.9706 3 21 6.35786 21 10.5Z" fill="#FF4136" stroke="white" stroke-width="1.5"/>
                <circle cx="12" cy="10.5" r="3" fill="white"/>
            </svg>
        `.trim();

        const marker = new mapboxgl.Marker(el)
            .setLngLat(searchedPlace as mapboxgl.LngLatLike)
            .addTo(map);
        
        placeMarkerRef.current = marker;
    }
  }, [searchedPlace]);


  return (
    <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
  );
}

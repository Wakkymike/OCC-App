'use client';

import { useState, useEffect } from 'react';
import BusMap from '@/components/bus-map';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import type { Bus, LatLng } from '@/lib/types';
import SearchBar from '@/components/search-bar';
import mapboxgl from 'mapbox-gl';

export default function Page() {
  const { buses, error } = useBusTracker();

  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [searchedPlace, setSearchedPlace] = useState<LatLng | null>(null);
  const [mapView, setMapView] = useState<{
    center?: LatLng;
    bounds?: mapboxgl.LngLatBounds;
    zoom?: number;
  }>({});

  const handleSearch = (
    searchType: string,
    query: string,
    direction: 'all' | 'inbound' | 'outbound'
  ) => {
    if (!query) {
      setSelectedBusId(null);
      setMapView({}); // Reset map view if query is cleared
      return;
    }
    const lowerCaseQuery = query.toLowerCase();

    const results = buses.filter((bus) => {
      let match = false;
      if (searchType === 'fleetNumber') {
        match = String(bus.fleetNumber).toLowerCase().includes(lowerCaseQuery);
      } else if (searchType === 'service') {
        match = String(bus.service).toLowerCase() === lowerCaseQuery;
        if (match && direction !== 'all') {
          return String(bus.direction).toLowerCase() === direction;
        }
      } else if (searchType === 'journey') {
        match = String(bus.journeyRef ?? '').toLowerCase().includes(lowerCaseQuery);
      }
      return match;
    });

    if (results.length === 1) {
      const bus = results[0];
      const busId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
      setSelectedBusId(busId);
      setMapView({ center: bus.position, zoom: 16 });
    } else if (results.length > 1) {
      const newBounds = new mapboxgl.LngLatBounds();
      results.forEach((bus) => {
        newBounds.extend([bus.position.lng, bus.position.lat]);
      });
      setSelectedBusId(null);
      setMapView({ bounds: newBounds });
    } else {
      // No results found.
      setSelectedBusId(null);
      setMapView({});
    }
  };
  
  useEffect(() => {
    if (selectedBusId) {
      const bus = buses.find(b => {
        const busId = `${b.fleetNumber}-${b.runningBoard}-${b.service}-${b.direction}-${b.journeyRef || 'no-ref'}`;
        return busId === selectedBusId;
      });
      if (bus) {
        setMapView({ center: bus.position, zoom: 16 });
      }
    }
  }, [selectedBusId, buses]);


  return (
    <div className="h-screen w-screen relative">
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-center">
        <SearchBar onSearch={handleSearch} />
      </div>
      {error && (
        <p className="absolute top-24 left-4 z-10 text-red-600 bg-white p-2 rounded-lg shadow-md">
          {error}
        </p>
      )}
      <BusMap
        buses={buses}
        selectedBusId={selectedBusId}
        setSelectedBusId={setSelectedBusId}
        searchedPlace={searchedPlace}
        mapView={mapView}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import BusMap from '@/components/bus-map';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import type { Bus, LatLng } from '@/lib/types';
import SearchBar from '@/components/search-bar';
import mapboxgl from 'mapbox-gl';

export default function Page() {
  const { buses, error } = useBusTracker();
  const [displayBuses, setDisplayBuses] = useState<Bus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [searchedPlace, setSearchedPlace] = useState<LatLng | null>(null);
  const [mapView, setMapView] = useState<{
    center?: LatLng;
    bounds?: mapboxgl.LngLatBounds;
    zoom?: number;
  }>({});
  const [currentSearch, setCurrentSearch] = useState<{
    searchType: string;
    query: string;
    direction: 'all' | 'inbound' | 'outbound';
  } | null>(null);

  useEffect(() => {
    let results = buses;
    let isSearching = false;

    if (currentSearch) {
      const { searchType, query, direction } = currentSearch;
      isSearching = query !== '' || (searchType === 'service' && direction !== 'all');

      if (isSearching) {
        const lowerCaseQuery = query.toLowerCase();

        results = buses.filter((bus) => {
          if (searchType === 'fleetNumber') {
            return String(bus.fleetNumber).toLowerCase().includes(lowerCaseQuery);
          } else if (searchType === 'journey') {
            return String(bus.journeyRef ?? '').toLowerCase().includes(lowerCaseQuery);
          } else if (searchType === 'service') {
            const serviceMatch = !query || String(bus.service).toLowerCase() === lowerCaseQuery;
            const directionMatch = direction === 'all' || String(bus.direction).toLowerCase() === direction;
            return serviceMatch && directionMatch;
          }
          return false;
        });
      }
    }

    setDisplayBuses(results);

    if (isSearching) {
      if (results.length === 1) {
        const bus = results[0];
        const busId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
        setSelectedBusId(busId);
      } else if (results.length > 1) {
        const newBounds = new mapboxgl.LngLatBounds();
        results.forEach((bus) => {
          newBounds.extend([bus.position.lng, bus.position.lat]);
        });
        setSelectedBusId(null);
        setMapView({ bounds: newBounds });
      } else {
        setSelectedBusId(null);
      }
    }
  }, [buses, currentSearch]);

  const handleSearch = (
    searchType: string,
    query: string,
    direction: 'all' | 'inbound' | 'outbound'
  ) => {
    setCurrentSearch({ searchType, query, direction });
  };

  const handleClear = () => {
    setCurrentSearch(null);
    setSelectedBusId(null);
    setMapView({});
  };
  
  useEffect(() => {
    if (selectedBusId) {
      const bus = displayBuses.find(b => {
        const busId = `${b.fleetNumber}-${b.runningBoard}-${b.service}-${b.direction}-${b.journeyRef || 'no-ref'}`;
        return busId === selectedBusId;
      });
      if (bus) {
        setMapView({ center: bus.position, zoom: 16 });
      }
    }
  }, [selectedBusId, displayBuses]);


  return (
    <div className="h-screen w-screen relative">
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-center">
        <SearchBar onSearch={handleSearch} onClear={handleClear} />
      </div>
      {error && (
        <p className="absolute top-24 left-4 z-10 text-destructive bg-card p-2 rounded-lg shadow-md">
          {error}
        </p>
      )}
      <BusMap
        buses={displayBuses}
        selectedBusId={selectedBusId}
        setSelectedBusId={setSelectedBusId}
        searchedPlace={searchedPlace}
        mapView={mapView}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import BusMap from '@/components/bus-map';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import type { Bus, LatLng } from '@/lib/types';
import SearchBar from '@/components/search-bar';
import mapboxgl from 'mapbox-gl';
import { Home, Layers3 } from 'lucide-react';
import { buttonVariants, Button } from '@/components/ui/button';
import Link from 'next/link';
import MapControls from '@/components/map-controls';

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

  // New state for map layers
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/dark-v11');
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showBusStops, setShowBusStops] = useState(false);

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

    const busToTrack = selectedBusId ? results.find(b => {
        const busId = `${b.fleetNumber}-${b.runningBoard}-${b.service}-${b.direction}-${b.journeyRef || 'no-ref'}`;
        return busId === selectedBusId;
    }) : undefined;

    if (busToTrack && busToTrack.position) {
        setMapView({ center: busToTrack.position, zoom: 16 });
        return;
    }

    if (isSearching) {
      if (results.length === 1) {
        const bus = results[0];
        if (bus.position) {
          const busId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
          setSelectedBusId(busId);
          setMapView({ center: bus.position, zoom: 16 });
        }
      } else if (results.length > 1) {
        const newBounds = new mapboxgl.LngLatBounds();
        results.forEach((bus) => {
          if (bus.position) {
            newBounds.extend([bus.position.lng, bus.position.lat]);
          }
        });
        if (!newBounds.isEmpty()) {
            setSelectedBusId(null);
            setMapView({ bounds: newBounds });
        }
      } else {
        setSelectedBusId(null);
      }
    }
  }, [buses, currentSearch, selectedBusId]);

  const handleSearch = (
    searchType: string,
    query: string,
    direction: 'all' | 'inbound' | 'outbound'
  ) => {
    setSelectedBusId(null); // Deselect bus on new search
    setCurrentSearch({ searchType, query, direction });
  };

  const handleClear = () => {
    setCurrentSearch(null);
    setSelectedBusId(null);
    setMapView({});
  };
  
  return (
    <div className="h-screen w-screen relative">
      <div className="absolute top-4 left-4 z-50">
        <Link
          href="/"
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
          aria-label="Home"
        >
          <Home className="h-5 w-5" />
        </Link>
      </div>
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-center">
        <SearchBar onSearch={handleSearch} onClear={handleClear} />
      </div>
      {error && (
        <p className="absolute top-24 left-4 z-10 text-destructive bg-card p-2 rounded-lg shadow-md">
          {error}
        </p>
      )}
      <div
        className="absolute bottom-4 right-4 z-10"
        onMouseEnter={() => setControlsVisible(true)}
        onMouseLeave={() => setControlsVisible(false)}
      >
        {controlsVisible ? (
          <MapControls
            mapStyle={mapStyle}
            setMapStyle={setMapStyle}
            show3DBuildings={show3DBuildings}
            setShow3DBuildings={setShow3DBuildings}
            showTraffic={showTraffic}
            setShowTraffic={setShowTraffic}
            showBusStops={showBusStops}
            setShowBusStops={setShowBusStops}
          />
        ) : (
          <Button variant="outline" size="icon" aria-label="Map Layers">
            <Layers3 className="h-5 w-5" />
          </Button>
        )}
      </div>
      <BusMap
        buses={displayBuses}
        selectedBusId={selectedBusId}
        setSelectedBusId={setSelectedBusId}
        searchedPlace={searchedPlace}
        mapView={mapView}
        mapStyle={mapStyle}
        show3DBuildings={show3DBuildings}
        showTraffic={showTraffic}
        showBusStops={showBusStops}
      />
    </div>
  );
}

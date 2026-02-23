'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import BusMap from '@/components/bus-map';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { useRoadworksTracker } from '@/hooks/useRoadworksTracker';
import { useHazardsTracker } from '@/hooks/useHazardsTracker';
import type { Bus, LatLng, MetrolinkData, JourneyPlan, Roadwork, Hazard } from '@/lib/types';
import SearchBar from '@/components/search-bar';
import LocationSearchBar from '@/components/location-search-bar';
import mapboxgl from 'mapbox-gl';
import { Home, Layers3, Radio } from 'lucide-react';
import { buttonVariants, Button } from '@/components/ui/button';
import Link from 'next/link';
import MapControls from '@/components/map-controls';
import { useToast } from '@/hooks/use-toast';
import RouteRecorderDialog from '@/components/route-recorder';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import preRecordedRoutes from '@/lib/pre-recorded-routes.json';
import { useSearchParams } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';


export default function Page() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [user, firestore]);
  const { data: userProfile } = useDoc<{ isAdmin: boolean }>(userProfileRef);
  
  const { buses, error: busError } = useBusTracker();
  const { roadworks, error: roadworksError } = useRoadworksTracker();
  const { hazards, error: hazardsError } = useHazardsTracker();
  
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
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12');
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [showBusStops, setShowBusStops] = useState(true);
  const [showGnw, setShowGnw] = useState(true);
  const [showMetroline, setShowMetroline] = useState(false);
  const [showVisionBus, setShowVisionBus] = useState(false);
  const [showStagecoach, setShowStagecoach] = useState(false);
  const [showFirstBus, setShowFirstBus] = useState(false);
  const [showDiamondBus, setShowDiamondBus] = useState(false);
  const [showRoadworks, setShowRoadworks] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const { toast } = useToast();

  const [metrolinkData, setMetrolinkData] = useState<MetrolinkData | null>(null);
  const [txcRoutes, setTxcRoutes] = useState<Record<string, { name: string; route: LatLng[]; busId: string | null }>>({});

  // State for route recording
  const [isRecording, setIsRecording] = useState(false);
  const [activeRecordingRoute, setActiveRecordingRoute] = useState<LatLng[]>([]);
  const [recordingBusId, setRecordingBusId] = useState<string | null>(null);
  const [recordingService, setRecordingService] = useState<string | null>(null);

  const [userSavedRoutes, setUserSavedRoutes] = useState<Record<string, { name: string; route: LatLng[]; busId: string | null }>>({});
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const [initialRoutes, setInitialRoutes] = useState<Record<string, { name: string; route: LatLng[]; busId: string | null }>>(preRecordedRoutes);

  const allAvailableRoutes = useMemo(() => {
    return {
        ...initialRoutes,
        ...txcRoutes,
        ...userSavedRoutes,
    };
  }, [initialRoutes, userSavedRoutes, txcRoutes]);


  const [isRecorderOpen, setIsRecorderOpen] = useState(false);

  // Memoize last known position to avoid adding duplicate points
  const lastRecordedPosition = useMemo(() => {
    if (activeRecordingRoute.length === 0) return null;
    return activeRecordingRoute[activeRecordingRoute.length - 1];
  }, [activeRecordingRoute]);
  
  const routeToDisplay = useMemo(() => {
    if (selectedRouteId && allAvailableRoutes[selectedRouteId]) {
      return allAvailableRoutes[selectedRouteId].route;
    }
    return null;
  }, [selectedRouteId, allAvailableRoutes]);


  const handleStopRecording = useCallback(() => {
    if (isRecording && recordingService && activeRecordingRoute.length > 1) {
      const routeId = `${recordingService}-${Date.now()}`;
      const routeName = `Service ${recordingService} (${new Date().toLocaleTimeString()})`;
      setUserSavedRoutes(prev => ({
        ...prev,
        [routeId]: {
          name: routeName,
          route: activeRecordingRoute,
          busId: recordingBusId,
        }
      }));
      setSelectedRouteId(routeId); // Auto-select the new route
      toast({ title: 'Route Saved', description: `${routeName} has been saved.` });
    }
    setIsRecording(false);
    setRecordingService(null);
    setRecordingBusId(null);
    setActiveRecordingRoute([]);
  }, [isRecording, recordingService, activeRecordingRoute, recordingBusId, toast]);

  const searchParams = useSearchParams();
  const [journeyPlan, setJourneyPlan] = useState<JourneyPlan | null>(null);

  useEffect(() => {
    const busIdFromQuery = searchParams.get('busId');
    if (busIdFromQuery) {
      setSelectedBusId(decodeURIComponent(busIdFromQuery));
      // Clean the URL so a refresh doesn't re-select the bus
      const newUrl = window.location.pathname;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    }
    
    const journeyParam = searchParams.get('journey');
    if (journeyParam) {
        try {
            const plan = JSON.parse(journeyParam) as JourneyPlan;
            setJourneyPlan(plan);
            
            const newBounds = new mapboxgl.LngLatBounds();
            plan.path.forEach(p => newBounds.extend([p.lng, p.lat]));
            if (!newBounds.isEmpty()) {
                setMapView({ bounds: newBounds });
            }

            // Clean the URL
            const newUrl = window.location.pathname;
            window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);

        } catch (e) {
            console.error("Failed to parse journey plan from URL", e);
            toast({
                variant: 'destructive',
                title: 'Could not display journey',
                description: 'There was an error reading the planned journey from the URL.',
            });
        }
    }


    // Fetch metrolink data
    const fetchMetrolinkData = async () => {
      try {
        const response = await fetch('/api/metrolink');
        if (response.ok) {
          const data = await response.json();
          setMetrolinkData(data);
        } else {
          console.error('Failed to fetch Metrolink data');
        }
      } catch (err) {
        console.error('Error fetching Metrolink data:', err);
      }
    };
    
    // Fetch TXC routes data
    const fetchTxcRoutes = async () => {
      try {
        const response = await fetch('/api/routes');
        if (response.ok) {
          const data = await response.json();
          setTxcRoutes(data.txcRoutes || {});
        } else {
          console.error('Failed to fetch TransXchange routes');
          toast({
              variant: 'destructive',
              title: 'Could not load routes',
              description: 'Failed to load routes from TransXchange data.',
          });
        }
      } catch (err) {
        console.error('Error fetching TransXchange routes:', err);
      }
    };

    fetchMetrolinkData();
    fetchTxcRoutes();

  }, [searchParams, toast]);

  useEffect(() => {
    // 1. Filter buses based on the operator toggles
    const operatorFilteredBuses = buses.filter(bus => 
        (bus.operator === 'GNW' && showGnw) || 
        (bus.operator === 'MET' && showMetroline) ||
        (bus.operator === 'VB' && showVisionBus) ||
        (bus.operator === 'SC' && showStagecoach) ||
        (bus.operator === 'FB' && showFirstBus) ||
        (bus.operator === 'DB' && showDiamondBus)
    );

    // 2. Filter by search query if there is one
    let searchFilteredBuses = operatorFilteredBuses;
    let isSearching = false;
    if (currentSearch) {
      const { searchType, query, direction } = currentSearch;
      isSearching = query !== '' || (searchType === 'service' && direction !== 'all');

      if (isSearching) {
        const lowerCaseQuery = query.toLowerCase();

        searchFilteredBuses = operatorFilteredBuses.filter((bus) => {
          if (searchType === 'fleetNumber') {
            return String(bus.fleetNumber).toLowerCase().includes(lowerCaseQuery);
          } else if (searchType === 'runningBoard') {
            return String(bus.runningBoard).toLowerCase().includes(lowerCaseQuery);
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
    
    const finalDisplayBuses = searchFilteredBuses;
    setDisplayBuses(finalDisplayBuses);

    // 3. Handle route recording and map view updates
    if (isRecording) {
      if (!recordingBusId) {
        // Find the first bus for the service to start tracking from the displayed buses
        const busToStartTracking = finalDisplayBuses.find(b => b.service === recordingService);
        if (busToStartTracking) {
          const busId = `${busToStartTracking.fleetNumber}-${busToStartTracking.runningBoard}-${busToStartTracking.service}-${busToStartTracking.direction}-${busToStartTracking.journeyRef || 'no-ref'}`;
          setRecordingBusId(busId);
          setActiveRecordingRoute([]); // Reset route when a new journey is picked up
          toast({ title: 'Recording Started', description: `Now recording route for bus ${busToStartTracking.fleetNumber} on service ${recordingService}.`});
        }
      } else {
        // Continue tracking the specific bus
        const trackedBus = finalDisplayBuses.find(b => {
           const busId = `${b.fleetNumber}-${b.runningBoard}-${b.service}-${b.direction}-${b.journeyRef || 'no-ref'}`;
           return busId === recordingBusId;
        });
        if (trackedBus && trackedBus.position) {
          // Add point if it has moved
          if (!lastRecordedPosition || trackedBus.position.lat !== lastRecordedPosition.lat || trackedBus.position.lng !== lastRecordedPosition.lng) {
             setActiveRecordingRoute(prev => [...prev, trackedBus.position!]);
          }
        } else {
          // Bus is no longer in the feed, stop recording
          handleStopRecording();
          toast({ title: 'Recording Stopped', description: `Bus ${recordingBusId.split('-')[0]} is no longer being tracked. Route saved.`});
        }
      }
    }

    const busToTrack = selectedBusId ? finalDisplayBuses.find(b => {
        const busId = `${b.fleetNumber}-${b.runningBoard}-${b.service}-${b.direction}-${b.journeyRef || 'no-ref'}`;
        return busId === selectedBusId;
    }) : undefined;

    if (busToTrack && busToTrack.position) {
        setMapView({ center: busToTrack.position, zoom: 16 });
        return;
    }

    if (isSearching) {
      if (finalDisplayBuses.length === 1) {
        const bus = finalDisplayBuses[0];
        if (bus.position) {
          const busId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
          setSelectedBusId(busId);
          setMapView({ center: bus.position, zoom: 16 });
        }
      } else if (finalDisplayBuses.length > 1) {
        const newBounds = new mapboxgl.LngLatBounds();
        finalDisplayBuses.forEach((bus) => {
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
  }, [buses, currentSearch, selectedBusId, isRecording, recordingBusId, recordingService, toast, lastRecordedPosition, handleStopRecording, showGnw, showMetroline, showVisionBus, showStagecoach, showFirstBus, showDiamondBus]);

  const handleLocationSearch = async (query: string) => {
    setSelectedBusId(null);
    setCurrentSearch(null); 
    setSearchedPlace(null);
    try {
      const response = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (response.ok && data.coordinates) {
        setSearchedPlace(data.coordinates);
      } else {
        setSearchedPlace(null);
        toast({
          variant: 'destructive',
          title: 'Location not found',
          description: `Could not find a location for "${query}". Please try another search.`,
        });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast({
        variant: 'destructive',
        title: 'Search Error',
        description: 'An error occurred while searching for the location.',
      });
    }
  };

  const handleBusSearch = (
    searchType: string,
    query: string,
    direction: 'all' | 'inbound' | 'outbound'
  ) => {
    setSelectedBusId(null);
    setSearchedPlace(null);
    setCurrentSearch({ searchType, query, direction });
  };
  
  const handleLocationClear = () => {
    setSearchedPlace(null);
    setMapView({});
  };

  const handleBusClear = () => {
    setCurrentSearch(null);
    setSelectedBusId(null);
    setMapView({});
  };

  const handleStartRecording = (service: string) => {
    setIsRecording(true);
    setRecordingService(service);
    setRecordingBusId(null);
    setActiveRecordingRoute([]);
  };

  const handleExport = () => {
    if (!selectedRouteId || !allAvailableRoutes[selectedRouteId]) {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Please select a route to export.'});
      return;
    };
    
    const routeToExport = allAvailableRoutes[selectedRouteId];
    
    const geoJson = {
        type: "Feature",
        properties: {
            name: routeToExport.name,
            service: routeToExport.name.split(' ')[1], // basic parsing
            busId: routeToExport.busId,
            recordedAt: selectedRouteId.includes('-') && !isNaN(parseInt(selectedRouteId.split('-').pop()!)) ? new Date(parseInt(selectedRouteId.split('-').pop()!)).toISOString() : new Date().toISOString(),
        },
        geometry: {
            type: "LineString",
            coordinates: routeToExport.route.map(p => [p.lng, p.lat]),
        }
    };

    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-${routeToExport.name.replace(/[\s():]/g, '_')}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Export Successful', description: `The route ${routeToExport.name} has been downloaded.` });
  };
  
  return (
    <div className="h-screen w-screen relative">
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <Link
          href="/"
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
          aria-label="Home"
        >
          <Home className="h-5 w-5" />
        </Link>
        {userProfile?.isAdmin && (
         <Button
            variant="outline"
            size="icon"
            onClick={() => setIsRecorderOpen(true)}
            aria-label="Open Route Recorder"
          >
            <Radio className="h-5 w-5" />
         </Button>
        )}
      </div>
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-center items-start gap-4">
        <LocationSearchBar onSearch={handleLocationSearch} onClear={handleLocationClear} />
        <SearchBar onSearch={handleBusSearch} onClear={handleBusClear} />
      </div>
      {(busError || roadworksError || hazardsError) && (
        <div className="absolute top-24 left-4 z-10 flex flex-col gap-2">
           {busError && <p className="text-destructive bg-card p-2 rounded-lg shadow-md">{busError}</p>}
           {roadworksError && <p className="text-destructive bg-card p-2 rounded-lg shadow-md">{roadworksError}</p>}
           {hazardsError && <p className="text-destructive bg-card p-2 rounded-lg shadow-md">Hazards: {hazardsError}</p>}
        </div>
      )}
      <div className="absolute bottom-4 right-4 z-10">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Map Layers">
              <Layers3 className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-auto p-0">
            <MapControls
              mapStyle={mapStyle}
              setMapStyle={setMapStyle}
              show3DBuildings={show3DBuildings}
              setShow3DBuildings={setShow3DBuildings}
              showBusStops={showBusStops}
              setShowBusStops={setShowBusStops}
              savedRoutes={allAvailableRoutes}
              selectedRouteId={selectedRouteId}
              setSelectedRouteId={setSelectedRouteId}
              showGnw={showGnw}
              setShowGnw={setShowGnw}
              showMetroline={showMetroline}
              setShowMetroline={setShowMetroline}
              showVisionBus={showVisionBus}
              setShowVisionBus={setShowVisionBus}
              showStagecoach={showStagecoach}
              setShowStagecoach={setShowStagecoach}
              showFirstBus={showFirstBus}
              setShowFirstBus={setShowFirstBus}
              showDiamondBus={showDiamondBus}
              setShowDiamondBus={setShowDiamondBus}
              showRoadworks={showRoadworks}
              setShowRoadworks={setShowRoadworks}
              showHazards={showHazards}
              setShowHazards={setShowHazards}
            />
          </PopoverContent>
        </Popover>
      </div>
      <BusMap
        buses={displayBuses}
        selectedBusId={selectedBusId}
        setSelectedBusId={setSelectedBusId}
        searchedPlace={searchedPlace}
        mapView={mapView}
        mapStyle={mapStyle}
        show3DBuildings={show3DBuildings}
        showBusStops={showBusStops}
        metrolinkData={metrolinkData}
        routeToDisplay={routeToDisplay}
        journeyPlan={journeyPlan}
        roadworks={roadworks}
        showRoadworks={showRoadworks}
        hazards={hazards}
        showHazards={showHazards}
      />
      <RouteRecorderDialog
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onExport={handleExport}
        isRecording={isRecording}
        recordedPointsCount={activeRecordingRoute.length}
        recordingService={recordingService}
      />
    </div>
  );
}

'use client';

import { useMemo, useState, FormEvent, useEffect } from 'react';
import BusMap from '@/components/bus-map';
import { Search, Terminal, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import type { LngLatBoundsLike } from 'mapbox-gl';

type SearchCategory = 'fleetNumber' | 'service' | 'runningBoard';

export default function Home() {
  const mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const { buses, error } = useBusTracker();
  
  // State for the bus search input fields
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('fleetNumber');

  // State for the active/submitted bus filter
  const [activeFilter, setActiveFilter] = useState<{ query: string; category: SearchCategory } | null>(null);

  // State for the place search
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [searchedPlace, setSearchedPlace] = useState<[number, number] | null>(null);

  // State for the currently selected bus on the map
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  // State for bounds to fit multiple buses
  const [bounds, setBounds] = useState<LngLatBoundsLike | null>(null);


  const handleBusSearch = (e: FormEvent) => {
    e.preventDefault();
    setPlaceSearchQuery(''); // clear place search input
    setSearchedPlace(null); // Clear place search result
    if (searchQuery.trim() === '') {
        setActiveFilter(null);
    } else {
        setActiveFilter({ query: searchQuery, category: searchCategory });
    }
  };

  const handlePlaceSearch = async (e: FormEvent) => {
    e.preventDefault();
    
    // Clear bus search states
    setActiveFilter(null);
    setSelectedBusId(null);
    setBounds(null);

    if (!placeSearchQuery.trim()) {
        setSearchedPlace(null);
        return;
    }

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(placeSearchQuery)}.json`;
    // Bbox for greater manchester to improve search relevance
    const params = `?access_token=${accessToken}&limit=1&bbox=-2.73,53.32,-1.76,53.63&autocomplete=true`;

    try {
        const response = await fetch(endpoint + params);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            setSearchedPlace([lng, lat]);
        } else {
            setSearchedPlace(null);
            toast({
                variant: "destructive",
                title: "Place not found",
                description: "Could not find a location matching your search.",
            });
        }
    } catch (error) {
        console.error('Error fetching geocoding data:', error);
        setSearchedPlace(null);
        toast({
            variant: "destructive",
            title: "Error searching for place",
            description: "There was a problem searching for the location.",
        });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveFilter(null);
    setSelectedBusId(null);
    setBounds(null);
    setPlaceSearchQuery('');
    setSearchedPlace(null);
  }

  const handleSetSelectedBusId = (id: string | null) => {
    if (id) {
        setPlaceSearchQuery('');
        setSearchedPlace(null);
    }
    setSelectedBusId(id);
  }

  const filteredBuses = useMemo(() => {
    if (!activeFilter || !activeFilter.query) {
      return buses;
    }
    const lowercasedQuery = activeFilter.query.toLowerCase();
    return buses.filter(bus => {
        const targetField = String(bus[activeFilter.category] ?? '').toLowerCase();
        return targetField.includes(lowercasedQuery);
    });
  }, [buses, activeFilter]);

  // Effect to handle map view based on search results and selection
  useEffect(() => {
    // This effect manages the map's viewport (zoom/pan) based on search results and user selections.
    
    // If a bus is selected (either by a click, or from a single-bus search result),
    // we want to be zoomed in on it. In this case, we clear any multi-bus bounds.
    if (selectedBusId) {
        setBounds(null);
        return;
    }
    
    // If we're here, no bus is selected. We now decide what to show based on the active filter.
    if (!activeFilter || !activeFilter.query) {
      // No active search, so reset everything.
      setSelectedBusId(null);
      setBounds(null);
      return;
    }

    // A search is active, but no bus is selected.
    if (filteredBuses.length === 1) {
      // The search returned exactly one bus. We auto-select it to zoom in.
      // This will cause a re-render, and the `if (selectedBusId)` block above will handle the view.
      const bus = filteredBuses[0];
      const busId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
      setSelectedBusId(busId);
    } else if (activeFilter.category === 'service' && filteredBuses.length > 1) {
      // The search is for a service and returned multiple buses.
      // We calculate bounds to show them all on the map.
      const lats = filteredBuses.map(b => b.position.lat);
      const lngs = filteredBuses.map(b => b.position.lng);
      const southWest: [number, number] = [Math.min(...lngs), Math.min(...lats)];
      const northEast: [number, number] = [Math.max(...lngs), Math.max(...lats)];
      setBounds([southWest, northEast]);
    } else {
      // For any other case (no results, or multiple results for a non-service search),
      // we don't set any specific bounds.
      setBounds(null);
    }
  }, [activeFilter, filteredBuses, selectedBusId]);


  return (
    <div className="h-dvh w-screen bg-background text-foreground font-body flex flex-col">
      <header className="bg-card border-b shadow-sm z-20 shrink-0">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <h1 className="text-xl font-bold text-accent whitespace-nowrap">
            Go NorthWest Bus Tracker
          </h1>
          <div className="flex items-center gap-4 flex-1 justify-end">
            <form onSubmit={handleBusSearch} className="flex w-full max-w-lg items-center gap-2">
                <Select value={searchCategory} onValueChange={(value) => setSearchCategory(value as SearchCategory)}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Search by..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="fleetNumber">Fleet Number</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="runningBoard">Running Board</SelectItem>
                </SelectContent>
                </Select>
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    type="text"
                    placeholder="Search buses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    />
                </div>
                <Button type="submit">Search</Button>
                <Button type="button" variant="outline" onClick={clearSearch}>Clear</Button>
            </form>
             <div className="h-8 border-l border-border"></div>
            <form onSubmit={handlePlaceSearch} className="flex w-full max-w-xs items-center gap-2">
                <div className="relative w-full">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search places..."
                        value={placeSearchQuery}
                        onChange={(e) => setPlaceSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Button type="submit">Go</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 relative">
        {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-md">
                <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error Fetching Data</AlertTitle>
                    <AlertDescription>
                        <p>{error}</p>
                        <p className="mt-2 text-xs">The bus data feed may be temporarily down. Please try again later.</p>
                    </AlertDescription>
                </Alert>
            </div>
        )}
        {mapboxAccessToken ? (
          <BusMap 
            buses={filteredBuses} 
            selectedBusId={selectedBusId}
            setSelectedBusId={handleSetSelectedBusId}
            boundsToFit={bounds}
            searchedPlace={searchedPlace}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <Alert variant="destructive" className="max-w-lg">
                <Terminal className="h-4 w-4" />
                <AlertTitle>API Keys Missing!</AlertTitle>
                <AlertDescription>
                    The application requires API keys to function. Please add them to a 
                    <code className="bg-muted/50 text-destructive-foreground/80 px-1 py-0.5 rounded text-sm font-mono mx-1">.env.local</code> 
                    file in your project root.
                    <p className="mt-4">You need to add a Mapbox Access Token and a Bus Open Data Service (BODS) API key.</p>
                    <pre className="bg-muted/50 text-left p-3 rounded-md mt-4 text-sm overflow-x-auto">
                        <code>
                            {`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="YOUR_MAPBOX_KEY"\nBODS_API_KEY="YOUR_BODS_KEY"`}
                        </code>
                    </pre>
                     For your convenience, you can use the Mapbox key you provided:
                    <pre className="bg-muted/50 text-left p-3 rounded-md mt-4 text-sm overflow-x-auto">
                        <code>{`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="pk.eyJ1IjoibWljaGFlbGRvZHN3b3J0aCIsImEiOiJjbWt1N3cwMnUwanYxM2Zxd2cybWF1czRvIn0.BNCcJSODCrFSouPfAvL94A"`}</code>
                    </pre>
                    <p className="mt-2 text-xs">You can obtain a BODS API key from the official Bus Open Data Service website.</p>
                </AlertDescription>
            </Alert>
          </div>
        )}
      </main>
    </div>
  );
}

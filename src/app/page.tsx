'use client';

import { useMemo, useState, FormEvent, useEffect } from 'react';
import BusMap from '@/components/bus-map';
import { Search, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import type { LngLatBoundsLike } from 'mapbox-gl';

type SearchCategory = 'fleetNumber' | 'service' | 'runningBoard';

export default function Home() {
  const mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const { buses, error } = useBusTracker();
  
  // State for the input fields
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('fleetNumber');

  // State for the active/submitted filter
  const [activeFilter, setActiveFilter] = useState<{ query: string; category: SearchCategory } | null>(null);

  // State for the currently selected bus on the map
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  // State for bounds to fit multiple buses
  const [bounds, setBounds] = useState<LngLatBoundsLike | null>(null);


  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() === '') {
        setActiveFilter(null);
    } else {
        setActiveFilter({ query: searchQuery, category: searchCategory });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveFilter(null);
    setSelectedBusId(null);
    setBounds(null);
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

  // Effect to handle map view based on search results
  useEffect(() => {
    if (!activeFilter || !activeFilter.query) {
      setSelectedBusId(null);
      setBounds(null);
      return;
    }

    if (filteredBuses.length === 1) {
      // Single bus found: select it, clear bounds
      const bus = filteredBuses[0];
      const busId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}`;
      setSelectedBusId(busId);
      setBounds(null);
    } else if (activeFilter.category === 'service' && filteredBuses.length > 1) {
      // Multiple buses for a service: calculate bounds, clear selection
      const lats = filteredBuses.map(b => b.position.lat);
      const lngs = filteredBuses.map(b => b.position.lng);
      const southWest: [number, number] = [Math.min(...lngs), Math.min(...lats)];
      const northEast: [number, number] = [Math.max(...lngs), Math.max(...lats)];
      setBounds([southWest, northEast]);
      setSelectedBusId(null);
    } else {
      // No results, or multiple results for non-service category: clear selection and bounds
      setSelectedBusId(null);
      setBounds(null);
    }
  }, [filteredBuses, activeFilter]);


  return (
    <div className="h-dvh w-screen bg-background text-foreground font-body flex flex-col">
      <header className="bg-card border-b shadow-sm z-20 shrink-0">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <h1 className="text-xl font-bold text-accent whitespace-nowrap">
            Go NorthWest Bus Tracker
          </h1>
          <form onSubmit={handleSearch} className="flex w-full max-w-lg items-center gap-2">
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
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                />
            </div>
            <Button type="submit">Search</Button>
            <Button type="button" variant="outline" onClick={clearSearch}>Clear</Button>
          </form>
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
            setSelectedBusId={setSelectedBusId}
            boundsToFit={bounds}
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

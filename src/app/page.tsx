'use client';

import BusMap from '@/components/bus-map';
import { Terminal, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Bus } from '@/lib/types';

export default function Home() {
  const mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<keyof Bus>('fleetNumber');
  const { buses, error } = useBusTracker(searchQuery, searchType);

  const focusedBus = buses.length === 1 ? buses[0] : null;

  return (
    <div className="h-dvh w-screen bg-background text-foreground font-body flex flex-col">
      <header className="bg-card border-b shadow-sm z-20 shrink-0">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-accent">
            Go NorthWest Bus Tracker
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search"
                placeholder={`Search by ${searchType}...`}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={searchType} onValueChange={(value) => setSearchType(value as keyof Bus)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Search by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleetNumber">Fleet Number</SelectItem>
                <SelectItem value="service">Service Number</SelectItem>
                <SelectItem value="runningBoard">Running Board</SelectItem>
                <SelectItem value="journey">Journey Number</SelectItem>
              </SelectContent>
            </Select>
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
          <BusMap buses={buses} focusedBus={focusedBus} />
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

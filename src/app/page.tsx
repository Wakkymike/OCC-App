'use client';

import BusMap from '@/components/bus-map';
import { Info, Terminal, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useBusTracker } from '@/hooks/use-bus-tracker';

export default function Home() {
  const mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const { buses, error: busError } = useBusTracker();

  return (
    <div className="h-dvh w-screen bg-background text-foreground font-body flex flex-col">
      <header className="bg-card border-b shadow-sm z-20 shrink-0">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-primary">
            BNGN Bus Tracker
          </h1>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
             <Info size={16} />
             <span>Click on a bus to see details. Live data from BODS.</span>
          </div>
        </div>
      </header>
      <main className="flex-1 relative">
        {mapboxAccessToken ? (
          <>
            <BusMap accessToken={mapboxAccessToken} buses={buses} />
            {busError && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Data Fetching Error</AlertTitle>
                  <AlertDescription>
                    {busError}.
                    {busError.includes("Forbidden") && (
                      <span className="mt-2 block">
                        This error usually means the BODS API key is incorrect or lacks permissions. Please check the
                        <code className="bg-muted/50 text-destructive-foreground/80 px-1 py-0.5 rounded text-sm font-mono mx-1">.env.local</code> 
                        file and verify your key with the Bus Open Data Service.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </>
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

"use client";

import { APIProvider, Map, AdvancedMarker, Polyline, useMap } from '@vis.gl/react-google-maps';
import { useState, useMemo, useEffect } from 'react';
import type { Bus } from '@/lib/types';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { routes as allRoutes } from '@/lib/bus-data';
import { BusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const BusMarker = ({ selected }: { selected: boolean }) => (
    <div className={`relative transition-transform duration-300 ease-in-out ${selected ? 'scale-125 z-10' : 'scale-100'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors border-2 ${selected ? 'bg-accent border-accent-foreground/50' : 'bg-primary border-primary-foreground/50'}`}>
            <BusIcon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/30 rounded-full blur-[3px] scale-y-50"></div>
    </div>
);

function MapControl({ selectedBus, onClear }: { selectedBus: Bus | null; onClear: () => void; }) {
    const map = useMap();
    useEffect(() => {
        if (selectedBus && map) {
            map.panTo(selectedBus.position);
        }
    }, [selectedBus, map]);

    return (
        <>
            {selectedBus && (
                <div className="absolute top-4 right-4 z-10">
                    <Card className="w-72 shadow-2xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                             <CardTitle className="text-lg">Service {selectedBus.service}</CardTitle>
                             <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClear}>
                                <XIcon className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                             </Button>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">To: <span className="font-medium text-foreground">{selectedBus.destination}</span></p>
                            <p className="text-sm text-muted-foreground">Fleet: <span className="font-medium text-foreground">{selectedBus.fleetNumber}</span></p>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}

export default function BusMap({ apiKey }: { apiKey: string }) {
  const buses = useBusTracker();
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);

  const selectedRoute = useMemo(() => {
    if (!selectedBus) return null;
    return allRoutes.find(r => r.id === selectedBus.routeId);
  }, [selectedBus]);
  
  const handleMarkerClick = (bus: Bus) => {
    setSelectedBus(bus);
  };

  const clearSelection = () => {
    setSelectedBus(null);
  };
  
  const mapCenter = useMemo(() => ({ lat: 51.509865, lng: -0.118092 }), []);

  return (
    <div className="w-full h-full">
        <APIProvider apiKey={apiKey}>
            <Map
                center={mapCenter}
                zoom={12}
                mapId="bngn-bus-tracker-map"
                gestureHandling="greedy"
                disableDefaultUI={true}
                className="w-full h-full"
                onClick={clearSelection}
                onDragstart={clearSelection}
            >
                {buses.map(bus => (
                    <AdvancedMarker
                        key={bus.id}
                        position={bus.position}
                        onClick={() => handleMarkerClick(bus)}
                        title={`Service ${bus.service}`}
                    >
                        <BusMarker selected={selectedBus?.id === bus.id} />
                    </AdvancedMarker>
                ))}

                {selectedRoute && (
                    <Polyline
                        path={selectedRoute.path}
                        strokeColor="hsl(var(--accent))"
                        strokeOpacity={0.8}
                        strokeWeight={5}
                    />
                )}
            </Map>
            <MapControl selectedBus={selectedBus} onClear={clearSelection} />
        </APIProvider>
    </div>
  );
}

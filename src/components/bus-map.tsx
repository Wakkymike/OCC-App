"use client";

import Map, { Marker, MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useState, useMemo, useEffect, useRef } from 'react';
import type { Bus } from '@/lib/types';
import { BusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const BusMarker = ({ selected }: { selected: boolean }) => (
    <div className={`relative transition-transform duration-300 ease-in-out cursor-pointer ${selected ? 'scale-125 z-10' : 'scale-100'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors border-2 ${selected ? 'bg-accent border-accent-foreground/50' : 'bg-primary border-primary-foreground/50'}`}>
            <BusIcon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/30 rounded-full blur-[3px] scale-y-50"></div>
    </div>
);

function MapControl({ selectedBus, onClear }: { selectedBus: Bus | null; onClear: () => void; }) {
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

export default function BusMap({ accessToken, buses }: { accessToken: string; buses: Bus[] }) {
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const mapRef = useRef<MapRef>(null);
  
  const handleMarkerClick = (bus: Bus) => {
    setSelectedBus(bus);
  };

  const clearSelection = () => {
    setSelectedBus(null);
  };
  
  useEffect(() => {
    if (selectedBus && mapRef.current) {
        mapRef.current.flyTo({ center: [selectedBus.position.lng, selectedBus.position.lat], zoom: 14 });
    }
  }, [selectedBus]);
  
  // Centered on Greater Manchester area
  const mapCenter = useMemo(() => ({ lat: 53.4808, lng: -2.2426 }), []);

  return (
    <div className="w-full h-full">
        <Map
            ref={mapRef}
            mapboxAccessToken={accessToken}
            initialViewState={{
                longitude: mapCenter.lng,
                latitude: mapCenter.lat,
                zoom: 10
            }}
            style={{width: '100%', height: '100%'}}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            onClick={clearSelection}
            onDragStart={clearSelection}
            attributionControl={false}
        >
            {buses.map(bus => (
                <Marker
                    key={bus.id}
                    longitude={bus.position.lng}
                    latitude={bus.position.lat}
                    onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        handleMarkerClick(bus)
                    }}
                >
                    <BusMarker selected={selectedBus?.id === bus.id} />
                </Marker>
            ))}

            <MapControl selectedBus={selectedBus} onClear={clearSelection} />
        </Map>
    </div>
  );
}

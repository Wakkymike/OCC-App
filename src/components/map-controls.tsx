'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Layers3, Satellite, Map, Building, Bus, Route } from 'lucide-react';

interface MapControlsProps {
  mapStyle: string;
  setMapStyle: (style: string) => void;
  show3DBuildings: boolean;
  setShow3DBuildings: (show: boolean) => void;
  showBusStops: boolean;
  setShowBusStops: (show: boolean) => void;
  showRecordedRoute: boolean;
  setShowRecordedRoute: (show: boolean) => void;
  isRouteDataAvailable: boolean;
}

const styleOptions = [
  { id: 'streets-v12', name: 'Streets', icon: <Map className="h-5 w-5" /> },
  { id: 'dark-v11', name: 'Dark', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12C2 6.47715 6.47715 2 12 2V22C6.47715 22 2 17.5228 2 12Z" fill="currentColor"/></svg> },
  { id: 'satellite-streets-v12', name: 'Satellite', icon: <Satellite className="h-5 w-5" /> },
];

export default function MapControls({
  mapStyle,
  setMapStyle,
  show3DBuildings,
  setShow3DBuildings,
  showBusStops,
  setShowBusStops,
  showRecordedRoute,
  setShowRecordedRoute,
  isRouteDataAvailable,
}: MapControlsProps) {
  const currentStyleId = mapStyle.split('/').pop();

  return (
    <Card className="w-64">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layers3 className="h-5 w-5" />
          <CardTitle className="text-lg">Map Layers</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Map Style</Label>
          <RadioGroup
            value={currentStyleId}
            onValueChange={(styleId) => setMapStyle(`mapbox://styles/mapbox/${styleId}`)}
            className="grid grid-cols-3 gap-2"
          >
            {styleOptions.map(option => (
              <div key={option.id}>
                <RadioGroupItem value={option.id} id={option.id} className="sr-only" />
                <Label
                  htmlFor={option.id}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground ${
                    currentStyleId === option.id ? 'border-primary' : ''
                  }`}
                >
                  {option.icon}
                  <span className="text-xs mt-1">{option.name}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="space-y-2">
           <Label>Overlays</Label>
           <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center space-x-2">
                    <Building className="h-5 w-5" />
                    <Label htmlFor="show-3d-buildings" className="cursor-pointer">3D Buildings</Label>
                </div>
                <Switch
                    id="show-3d-buildings"
                    checked={show3DBuildings}
                    onCheckedChange={setShow3DBuildings}
                />
           </div>
           <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center space-x-2">
                    <Bus className="h-5 w-5" />
                    <Label htmlFor="show-bus-stops" className="cursor-pointer">Bus Stops</Label>
                </div>
                <Switch
                    id="show-bus-stops"
                    checked={showBusStops}
                    onCheckedChange={setShowBusStops}
                />
           </div>
           <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center space-x-2">
                    <Route className="h-5 w-5" />
                    <Label htmlFor="show-recorded-route" className="cursor-pointer">Recorded Route</Label>
                </div>
                <Switch
                    id="show-recorded-route"
                    checked={showRecordedRoute}
                    onCheckedChange={setShowRecordedRoute}
                    disabled={!isRouteDataAvailable}
                />
           </div>
        </div>
      </CardContent>
    </Card>
  );
}

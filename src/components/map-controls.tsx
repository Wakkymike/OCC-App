
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Layers3, Satellite, Map, Building, Bus, ChevronDown, Triangle, Shield, Search, Database } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LatLng } from '@/lib/types';

const TrafficConeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 22h20L12 2z" />
    </svg>
);


interface MapControlsProps {
  mapStyle: string;
  setMapStyle: (style: string) => void;
  show3DBuildings: boolean;
  setShow3DBuildings: (show: boolean) => void;
  showBusStops: boolean;
  setShowBusStops: (show: boolean) => void;
  savedRoutes: Record<string, { name: string; route: LatLng[] }>;
  selectedRouteId: string | null;
  setSelectedRouteId: (id: string | null) => void;
  showGnw: boolean;
  setShowGnw: (show: boolean) => void;
  showMetroline: boolean;
  setShowMetroline: (show: boolean) => void;
  showVisionBus: boolean;
  setShowVisionBus: (show: boolean) => void;
  showStagecoach: boolean;
  setShowStagecoach: (show: boolean) => void;
  showFirstBus: boolean;
  setShowFirstBus: (show: boolean) => void;
  showDiamondBus: boolean;
  setShowDiamondBus: (show: boolean) => void;
  showRoadworks: boolean;
  setShowRoadworks: (show: boolean) => void;
  showHazards: boolean;
  setShowHazards: (show: boolean) => void;
  showGeofences: boolean;
  setShowGeofences: (show: boolean) => void;
  // GTFS specific
  gtfsRoutes?: Record<string, any>;
  selectedGtfsRouteId?: string | null;
  setSelectedGtfsRouteId?: (id: string | null) => void;
  showGtfsRoute?: boolean;
  setShowGtfsRoute?: (show: boolean) => void;
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
  savedRoutes,
  selectedRouteId,
  setSelectedRouteId,
  showGnw,
  setShowGnw,
  showMetroline,
  setShowMetroline,
  showVisionBus,
  setShowVisionBus,
  showStagecoach,
  setShowStagecoach,
  showFirstBus,
  setShowFirstBus,
  showDiamondBus,
  setShowDiamondBus,
  showRoadworks,
  setShowRoadworks,
  showHazards,
  setShowHazards,
  showGeofences,
  setShowGeofences,
  gtfsRoutes = {},
  selectedGtfsRouteId,
  setSelectedGtfsRouteId,
  showGtfsRoute,
  setShowGtfsRoute,
}: MapControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gtfsSearch, setGtfsSearch] = useState('');
  const currentStyleId = mapStyle.split('/').pop();

  const filteredGtfs = useMemo(() => {
    if (!gtfsRoutes) return [];
    return Object.entries(gtfsRoutes)
        .filter(([id, data]) => data.name.toLowerCase().includes(gtfsSearch.toLowerCase()))
        .slice(0, 50);
  }, [gtfsRoutes, gtfsSearch]);

  return (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layers3 className="h-5 w-5" />
          <CardTitle className="text-lg">Map Layers</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Map Style</Label>
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
                  <span className="text-[10px] mt-1">{option.name}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        <div className="space-y-2">
           <Label className="text-xs font-semibold uppercase text-muted-foreground">Overlays</Label>
           <div className="space-y-1.5">
               <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                    <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4" />
                        <Label htmlFor="show-3d-buildings" className="text-sm cursor-pointer">3D Buildings</Label>
                    </div>
                    <Switch
                        id="show-3d-buildings"
                        checked={show3DBuildings}
                        onCheckedChange={setShow3DBuildings}
                    />
               </div>
               <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                    <div className="flex items-center space-x-2">
                        <Bus className="h-4 w-4" />
                        <Label htmlFor="show-bus-stops" className="text-sm cursor-pointer">Bus Stops</Label>
                    </div>
                    <Switch
                        id="show-bus-stops"
                        checked={showBusStops}
                        onCheckedChange={setShowBusStops}
                    />
               </div>
               <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                    <div className="flex items-center space-x-2 text-primary">
                        <Triangle className="h-4 w-4 fill-primary" />
                        <Label htmlFor="show-hazards" className="text-sm cursor-pointer text-foreground">Road Restrictions</Label>
                    </div>
                    <Switch
                        id="show-hazards"
                        checked={showHazards}
                        onCheckedChange={setShowHazards}
                    />
               </div>
               <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                    <div className="flex items-center space-x-2 text-green-600">
                        <Shield className="h-4 w-4" />
                        <Label htmlFor="show-geofences" className="text-sm cursor-pointer text-foreground">Monitoring Zones</Label>
                    </div>
                    <Switch
                        id="show-geofences"
                        checked={showGeofences}
                        onCheckedChange={setShowGeofences}
                    />
               </div>
               <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                    <div className="flex items-center space-x-2 text-destructive">
                        <TrafficConeIcon />
                        <Label htmlFor="show-roadworks" className="text-sm cursor-pointer text-foreground">Roadworks</Label>
                    </div>
                    <Switch
                        id="show-roadworks"
                        checked={showRoadworks}
                        onCheckedChange={setShowRoadworks}
                    />
               </div>
           </div>
        </div>

        <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                <Database className="h-3 w-3" /> GTFS Route Search
            </Label>
            <div className="space-y-2 p-2 border rounded-lg bg-muted/5">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                    <Input 
                        placeholder="Search Route..." 
                        value={gtfsSearch} 
                        onChange={(e) => setGtfsSearch(e.target.value)}
                        className="h-8 pl-7 text-xs bg-background"
                    />
                </div>
                <Select 
                    value={selectedGtfsRouteId ?? 'none'} 
                    onValueChange={(v) => setSelectedGtfsRouteId?.(v === 'none' ? null : v)}
                >
                    <SelectTrigger className="h-8 text-[10px]">
                        <SelectValue placeholder="Select path & direction..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No Route Selected</SelectItem>
                        {filteredGtfs.map(([id, data]) => (
                            <SelectItem key={id} value={id} className="text-[10px]">
                                {data.name} ({data.direction})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center justify-between pt-1">
                    <Label htmlFor="show-gtfs" className="text-[10px] font-bold uppercase opacity-70">Toggle View</Label>
                    <Switch 
                        id="show-gtfs" 
                        checked={showGtfsRoute} 
                        onCheckedChange={setShowGtfsRoute}
                        disabled={!selectedGtfsRouteId}
                        className="scale-75"
                    />
                </div>
            </div>
        </div>

        <div className="space-y-2">
           <Label className="text-xs font-semibold uppercase text-muted-foreground">Operators</Label>
           <div className="space-y-1.5">
               <div className="flex items-center justify-between rounded-md border p-2 border-primary/50 bg-primary/5">
                    <div className="flex items-center space-x-2">
                        <Bus className="h-4 w-4 text-primary" />
                        <Label htmlFor="show-gnw" className="text-sm font-semibold cursor-pointer">Go North West</Label>
                    </div>
                    <Switch
                        id="show-gnw"
                        checked={showGnw}
                        onCheckedChange={setShowGnw}
                    />
               </div>

               <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1.5">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-2 h-auto text-sm font-normal hover:bg-muted">
                            <div className="flex items-center gap-2">
                                <Bus className="h-4 w-4 text-muted-foreground" />
                                <span>Other Operators</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1.5 pt-1 pl-4 border-l-2 ml-2">
                        <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                            <Label htmlFor="show-metroline" className="text-xs cursor-pointer">Metroline</Label>
                            <Switch id="show-metroline" checked={showMetroline} onCheckedChange={setShowMetroline} className="scale-75" />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                            <Label htmlFor="show-visionbus" className="text-xs cursor-pointer">Vision Bus</Label>
                            <Switch id="show-visionbus" checked={showVisionBus} onCheckedChange={setShowVisionBus} className="scale-75" />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                            <Label htmlFor="show-stagecoach" className="text-xs cursor-pointer">Stagecoach</Label>
                            <Switch id="show-stagecoach" checked={showStagecoach} onCheckedChange={setShowStagecoach} className="scale-75" />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                            <Label htmlFor="show-firstbus" className="text-xs cursor-pointer">First Bus</Label>
                            <Switch id="show-firstbus" checked={showFirstBus} onCheckedChange={setShowFirstBus} className="scale-75" />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                            <Label htmlFor="show-diamondbus" className="text-xs cursor-pointer">Diamond</Label>
                            <Switch id="show-diamondbus" checked={showDiamondBus} onCheckedChange={setShowDiamondBus} className="scale-75" />
                        </div>
                    </CollapsibleContent>
               </Collapsible>
           </div>
        </div>

        <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Recorded Route</Label>
            <Select 
                value={selectedRouteId ?? 'none'} 
                onValueChange={(value) => setSelectedRouteId(value === 'none' ? null : value)}
                disabled={Object.keys(savedRoutes).length === 0}
            >
                <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select a route..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {Object.entries(savedRoutes).map(([id, { name }]) => (
                        <SelectItem key={id} value={id} className="text-xs">{name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </CardContent>
    </Card>
  );
}

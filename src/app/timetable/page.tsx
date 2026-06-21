
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { Bus, BusStop } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Loader2, Home, MapPin } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const schoolJourneyRefs = ['9001', '9002', '9003', '9004', '9005'];
const nightBusRunningBoards = ['3691', '3692', '3693', '1091', '1092', '1093', '21091', '21092', '21093', '23691', '23692', '23693', '11091', '11092', '11093', '13691', '13692', '13693'];
const firstJourneyRefs = ['1001', '1002', '1301', '1302', '1601', '1602'];
const lastJourneyRefs = ['8001', '8002', '8301', '8302', '8601', '8602'];

/**
 * Calculates distance between two points in meters.
 */
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
};

export default function LiveServicePage() {
  const { buses, error } = useBusTracker();
  const [serviceFilters, setServiceFilters] = useState<Record<string, 'all' | 'inbound' | 'outbound'>>({});
  const [busStops, setBusStops] = useState<BusStop[]>([]);

  // Fetch technical stops once on load
  useEffect(() => {
    fetch('/api/bus-stops')
      .then(res => res.json())
      .then(data => {
        if (data.stops) setBusStops(data.stops);
      })
      .catch(err => console.error("Timetable: Failed to fetch reference stops", err));
  }, []);

  const gnwBuses = useMemo(() => buses.filter(b => b.operator === 'GNW'), [buses]);

  // Helper to find the nearest stop name for a bus
  const getNearestStopName = (bus: Bus) => {
    if (!bus.position || busStops.length === 0) return '--';
    
    let minDistance = Infinity;
    let nearest: BusStop | null = null;
    
    // Performance optimization: only check stops within a rough 1km bounding box
    const nearbyStops = busStops.filter(s => 
        Math.abs(s.lat - bus.position!.lat) < 0.01 && 
        Math.abs(s.lng - bus.position!.lng) < 0.01
    );

    const searchSet = nearbyStops.length > 0 ? nearbyStops : busStops;

    for (const stop of searchSet) {
        const d = getDistance(bus.position.lat, bus.position.lng, stop.lat, stop.lng);
        if (d < minDistance) {
            minDistance = d;
            nearest = stop;
        }
    }
    
    // Only return if it's reasonably close (e.g. 400m) to represent "at/passing"
    return minDistance < 400 ? nearest?.name : '--';
  };

  const handleFilterChange = (serviceNumber: string, value: 'all' | 'inbound' | 'outbound') => {
    setServiceFilters(prev => ({ ...prev, [serviceNumber]: value }));
  };

  const services = gnwBuses.reduce((acc, bus) => {
    const serviceKey = String(bus.service);
    if (!acc[serviceKey]) acc[serviceKey] = [];
    acc[serviceKey].push(bus);
    acc[serviceKey].sort((a, b) => (a.direction.localeCompare(b.direction)) || (a.destination.localeCompare(b.destination)));
    return acc;
  }, {} as Record<string, Bus[]>);

  const sortedServiceNumbers = Object.keys(services).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
  
  const getDirectionLabel = (direction: string) => {
    if (direction.toLowerCase() === 'inbound') return 'Inbound';
    if (direction.toLowerCase() === 'outbound') return 'Outbound';
    return direction;
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-5xl">
        <Card>
          <CardHeader>
             <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-3xl flex flex-wrap items-center gap-4">
                  <span>Live Service Board</span>
                  {gnwBuses.length > 0 && (
                    <Badge className="bg-chart-2 text-primary-foreground">
                      {gnwBuses.length} active buses over {sortedServiceNumbers.length} services
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Real-time status and approximate locations of all Go North West services.
                </CardDescription>
              </div>
              <Link href="/" className={buttonVariants({ variant: 'outline', size: 'icon' })} aria-label="Home">
                <Home className="h-5 w-5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {gnwBuses.length === 0 && !error && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Loading live Go North West data...</span>
              </div>
            )}
            {gnwBuses.length > 0 && (
              <Accordion type="single" collapsible className="w-full">
                {sortedServiceNumbers.map((serviceNumber) => (
                  <AccordionItem value={serviceNumber} key={serviceNumber}>
                    <AccordionTrigger className="text-xl">
                      <div className="flex items-center gap-4">
                        <span>Service {serviceNumber}</span>
                        <Badge variant="outline">{services[serviceNumber].length} buses</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex items-center gap-6 px-4 py-3 border-b">
                        <span className="text-sm font-medium text-muted-foreground">Filter direction:</span>
                        <RadioGroup
                          value={serviceFilters[serviceNumber] || 'all'}
                          onValueChange={(value: 'all' | 'inbound' | 'outbound') => handleFilterChange(serviceNumber, value)}
                          className="flex items-center gap-4"
                        >
                          {['all', 'inbound', 'outbound'].map(v => (
                            <div key={v} className="flex items-center space-x-2">
                              <RadioGroupItem value={v} id={`r-${serviceNumber}-${v}`} />
                              <Label htmlFor={`r-${serviceNumber}-${v}`}>{v.charAt(0).toUpperCase() + v.slice(1)}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fleet No.</TableHead>
                            <TableHead>Running Board</TableHead>
                            <TableHead className="w-20">Journey No.</TableHead>
                            <TableHead>Last Stop</TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead>Direction</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services[serviceNumber]
                            .filter(bus => {
                              const filter = serviceFilters[serviceNumber] || 'all';
                              return filter === 'all' || bus.direction.toLowerCase() === filter;
                            })
                            .map((bus) => {
                                const busId = `${bus.operator}-${bus.fleetNumber}`;
                                
                                const isSchool = bus.journeyRef && schoolJourneyRefs.includes(bus.journeyRef);
                                const isNight = bus.runningBoard && nightBusRunningBoards.includes(bus.runningBoard);
                                
                                const isGnw = bus.operator === 'GNW';
                                const isFirst = isGnw && bus.journeyRef && firstJourneyRefs.includes(bus.journeyRef);
                                const isLast = isGnw && bus.journeyRef && lastJourneyRefs.includes(bus.journeyRef);
                                
                                const lastStop = getNearestStopName(bus);
                                
                                return (
                                    <TableRow key={busId}>
                                      <TableCell>
                                        <Link href={`/map?busId=${encodeURIComponent(busId)}`} className={buttonVariants({ variant: 'link', size: 'sm' })}>
                                          {bus.fleetNumber}
                                        </Link>
                                      </TableCell>
                                      <TableCell>
                                        {bus.runningBoard}
                                      </TableCell>
                                      <TableCell className={isFirst || isLast ? 'blinking-rb text-white font-bold text-center' : ''}>
                                        {bus.journeyRef || '--'}
                                      </TableCell>
                                      <TableCell className="text-[10px] max-w-[200px]">
                                        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span title={lastStop}>{lastStop}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {bus.destination}
                                        {isSchool && <span className="ml-2 text-destructive text-[10px] font-bold">[SCHOOL]</span>}
                                        {isNight && <span className="ml-2 text-purple-600 text-[10px] font-bold">[NIGHT]</span>}
                                      </TableCell>
                                      <TableCell>{getDirectionLabel(bus.direction)}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
          <CardFooter>
             <Button asChild variant="outline">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
             </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { Bus } from '@/lib/types';
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
import { ArrowLeft, Loader2, Home } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const schoolJourneyRefs = ['9001', '9002', '9003', '9004', '9005'];
const nightBusRunningBoards = ['3691', '3692', '3693', '1091', '1092', '1093', '21091', '21092', '21093', '23691', '23692', '23693', '11091', '11092', '11093', '13691', '13692', '13693'];

export default function LiveServicePage() {
  const { buses, error, lastRefreshed } = useBusTracker();
  const [serviceFilters, setServiceFilters] = useState<Record<string, 'all' | 'inbound' | 'outbound'>>({});

  const handleFilterChange = (serviceNumber: string, value: 'all' | 'inbound' | 'outbound') => {
    setServiceFilters(prev => ({ ...prev, [serviceNumber]: value }));
  };

  const services = buses.reduce((acc, bus) => {
    const serviceKey = String(bus.service);
    if (!acc[serviceKey]) {
      acc[serviceKey] = [];
    }
    acc[serviceKey].push(bus);
    // Sort buses within a service by direction then destination
    acc[serviceKey].sort((a, b) => {
      if (a.direction < b.direction) return -1;
      if (a.direction > b.direction) return 1;
      if (a.destination < b.destination) return -1;
      if (a.destination > b.destination) return 1;
      return 0;
    });
    return acc;
  }, {} as Record<string, Bus[]>);

  const sortedServiceNumbers = Object.keys(services).sort((a, b) => {
    // Attempt to sort numerically, fallback to string sort
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
  
  const getDirectionLabel = (direction: string) => {
    if (direction.toLowerCase() === 'inbound') return 'Inbound';
    if (direction.toLowerCase() === 'outbound') return 'Outbound';
    return direction;
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-4xl">
        <Card>
          <CardHeader>
             <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-3xl flex items-center gap-4">
                  <span>Live Service Board</span>
                  {buses.length > 0 && (
                    <Badge className="bg-chart-2 text-primary-foreground">
                      {buses.length} buses active over {sortedServiceNumbers.length} services
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Real-time status of all currently running services. Data refreshes automatically.
                </CardDescription>
              </div>
              <Link
                  href="/"
                  className={buttonVariants({ variant: 'outline', size: 'icon' })}
                  aria-label="Home"
                >
                  <Home className="h-5 w-5" />
                </Link>
            </div>
            {lastRefreshed && (
                <div className="text-sm text-muted-foreground pt-2">
                    Data last refreshed at: {lastRefreshed.toLocaleString()}
                </div>
            )}
            {error && (
                <div className="text-sm text-destructive pt-1">
                    Error receiving data: {error}
                </div>
            )}
          </CardHeader>
          <CardContent>
            {!error && buses.length === 0 && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Loading live bus data...</span>
              </div>
            )}
             {error && buses.length === 0 && (
              <div className="flex items-center justify-center py-10 text-destructive">
                <span>Could not load bus data.</span>
              </div>
            )}
            {buses.length > 0 && (
              <Accordion type="single" collapsible className="w-full">
                {sortedServiceNumbers.map((serviceNumber) => (
                  <AccordionItem value={serviceNumber} key={serviceNumber}>
                    <AccordionTrigger className="text-xl">
                      <div className="flex items-center gap-4">
                        <span>Service {serviceNumber}</span>
                        <Badge variant="outline">{services[serviceNumber].length} buses active</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex items-center gap-6 px-4 py-3 border-b">
                        <span className="text-sm font-medium text-muted-foreground">Filter by direction:</span>
                        <RadioGroup
                          value={serviceFilters[serviceNumber] || 'all'}
                          onValueChange={(value: 'all' | 'inbound' | 'outbound') => {
                              handleFilterChange(serviceNumber, value);
                          }}
                          className="flex items-center gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id={`r-${serviceNumber}-all`} />
                            <Label htmlFor={`r-${serviceNumber}-all`}>All</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="inbound" id={`r-${serviceNumber}-inbound`} />
                            <Label htmlFor={`r-${serviceNumber}-inbound`}>Inbound</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="outbound" id={`r-${serviceNumber}-outbound`} />
                            <Label htmlFor={`r-${serviceNumber}-outbound`}>Outbound</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fleet No.</TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead>Direction</TableHead>
                            <TableHead>Current Location</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services[serviceNumber]
                            .filter(bus => {
                              const filter = serviceFilters[serviceNumber] || 'all';
                              if (filter === 'all') return true;
                              return bus.direction.toLowerCase() === filter;
                            })
                            .map((bus) => {
                                const busId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
                                const isSchoolService = bus.journeyRef ? schoolJourneyRefs.includes(bus.journeyRef) : false;
                                const isNightBus = bus.runningBoard ? nightBusRunningBoards.includes(bus.runningBoard) : false;
                                
                                return (
                                    <TableRow key={`${bus.fleetNumber}-${bus.journeyRef}`}>
                                    <TableCell>
                                      <Link href={`/map?busId=${encodeURIComponent(busId)}`} className={buttonVariants({ variant: 'link', size: 'sm' })}>
                                        {bus.fleetNumber}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {bus.destination}
                                        {isSchoolService && <span className="ml-2 text-destructive font-semibold">[SCHOOL SERVICE]</span>}
                                        {isNightBus && <span className="ml-2 text-destructive font-semibold">[NIGHT BUS]</span>}
                                    </TableCell>
                                    <TableCell>{getDirectionLabel(bus.direction)}</TableCell>
                                    <TableCell>
                                      {bus.roadName ? (
                                        <div>
                                          <div>{bus.roadName}</div>
                                          <div className="text-xs text-muted-foreground">{bus.postcode}</div>
                                        </div>
                                      ) : (
                                        'N/A'
                                      )}
                                    </TableCell>
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

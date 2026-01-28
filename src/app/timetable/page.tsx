'use client';

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
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LiveServicePage() {
  const { buses, error } = useBusTracker();

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

  const getStatusBadge = (status: string, delay: number | undefined) => {
    let variant: "default" | "destructive" | "secondary" | "outline" = "outline";

    if (status === 'On Time') {
        variant = 'default';
    } else if (status.includes('late') || status === 'Late') {
        variant = 'destructive';
    } else if (status.includes('early') || status === 'Early') {
        variant = 'secondary';
    } 
    // Fallback to using delay number if status is something else but delay is present
    else if (delay !== undefined) {
        if (delay > 2) variant = 'destructive';
        else if (delay < -2) variant = 'secondary';
        else variant = 'default';
    }
    
    return <Badge variant={variant}>{status}</Badge>;
  };
  
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
            <CardTitle className="text-3xl">Live Service Board</CardTitle>
            <CardDescription>
              Real-time status of all currently running services. Data refreshes automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <p className="text-destructive">Error fetching live data: {error}</p>}
            {!error && buses.length === 0 && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Loading live bus data...</span>
              </div>
            )}
            {buses.length > 0 && (
              <Accordion type="single" collapsible className="w-full">
                {sortedServiceNumbers.map((serviceNumber) => (
                  <AccordionItem value={serviceNumber} key={serviceNumber}>
                    <AccordionTrigger className="text-xl">
                      <div className="flex items-center gap-4">
                        <span>Service {serviceNumber}</span>
                        <Badge variant="outline">{services[serviceNumber].length} buses running</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Destination</TableHead>
                            <TableHead>Direction</TableHead>
                            <TableHead>Fleet No.</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services[serviceNumber].map((bus) => (
                            <TableRow key={`${bus.fleetNumber}-${bus.journeyRef}`}>
                              <TableCell className="font-medium">{bus.destination}</TableCell>
                              <TableCell>{getDirectionLabel(bus.direction)}</TableCell>
                              <TableCell>{bus.fleetNumber}</TableCell>
                              <TableCell className="text-right">
                                {getStatusBadge(bus.status, bus.delay)}
                              </TableCell>
                            </TableRow>
                          ))}
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

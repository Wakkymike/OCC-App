'use client';

import { useState, useEffect } from 'react';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Loader2, AlertCircle, Clock, ArrowLeft, Home } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from 'next/link';

interface Stop {
    name: string;
    time: string;
}

interface Journey {
    journeyRef: string;
    departureTime: string;
    destination: string;
    stops: Stop[];
}

interface Service {
    service: string;
    journeys: Journey[];
}


export default function TimetablesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTimetables = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/timetables');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to load timetable data.');
                }
                const data = await response.json();
                setServices(data.services || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTimetables();
    }, []);

    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
            <div className="w-full max-w-6xl">
                 <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-3xl flex items-center gap-3">
                                    <Clock className="h-8 w-8" />
                                    <span>Service Timetables</span>
                                </CardTitle>
                                <CardDescription>
                                    Browse scheduled journeys for all services. This data is based on the last uploaded TransXchange file.
                                </CardDescription>
                            </div>
                             <Link
                                href="/"
                                className={buttonVariants({ variant: 'outline' })}
                                aria-label="Home"
                                >
                                <Home className="mr-2 h-5 w-5" />
                                Back to Home
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading && (
                            <div className="flex items-center justify-center py-20 text-muted-foreground">
                                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                <span className="text-lg">Loading timetables...</span>
                            </div>
                        )}
                        {error && (
                            <Alert variant="destructive" className="my-8">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error Loading Data</AlertTitle>
                                <AlertDescription>
                                    <p>{error}</p>
                                    <p className="mt-2">Please go to the Admin Panel to upload a valid TransXchange data file.</p>
                                </AlertDescription>
                            </Alert>
                        )}
                        {!isLoading && !error && services.length > 0 && (
                             <Accordion type="single" collapsible className="w-full">
                                {services.map((service) => (
                                <AccordionItem value={`service-${service.service}`} key={service.service}>
                                    <AccordionTrigger className="text-2xl font-medium">
                                    Service {service.service}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                    <Accordion type="single" collapsible className="w-full pl-4">
                                        {service.journeys.map((journey) => (
                                        <AccordionItem value={`${journey.journeyRef}-${journey.departureTime}`} key={`${journey.journeyRef}-${journey.departureTime}`}>
                                            <AccordionTrigger>
                                            {journey.departureTime.slice(0, 5)} to {journey.destination}
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="overflow-y-auto max-h-96 pr-4">
                                                    <Table>
                                                        <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Stop Name</TableHead>
                                                            <TableHead className="w-24 text-right">Time</TableHead>
                                                        </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                        {journey.stops.map((stop, index) => (
                                                            <TableRow key={index}>
                                                            <TableCell>{stop.name}</TableCell>
                                                            <TableCell className="text-right font-mono">{stop.time}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                        ))}
                                    </Accordion>
                                    </AccordionContent>
                                </AccordionItem>
                                ))}
                            </Accordion>
                        )}
                         {!isLoading && !error && services.length === 0 && (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-center">
                                <div>
                                    <h3 className="text-lg font-semibold">No timetable data found.</h3>
                                    <p>Please upload a TransXchange file in the Admin Panel to generate the timetables.</p>
                                </div>
                            </div>
                         )}
                    </CardContent>
                 </Card>
            </div>
        </main>
    )
}

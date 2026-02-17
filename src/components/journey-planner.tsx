'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Route } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function JourneyPlanner() {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handlePlanJourney = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!start || !end) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please enter both a start and destination.',
            });
            return;
        }
        setIsLoading(true);

        try {
            const response = await fetch(`/api/journey-planner?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to plan journey.');
            }
            
            // The API returns the path and stops. We need to pass this to the map page.
            // URL encoding a large JSON object is the easiest way.
            const params = new URLSearchParams({
                journey: JSON.stringify(data),
            });
            
            router.push(`/map?${params.toString()}`);

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Journey Planner Failed',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Route className="h-6 w-6" />
                    <div>
                        <CardTitle className="text-xl">Journey Planner</CardTitle>
                        <CardDescription>
                          Find the best bus route for your journey across the network.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handlePlanJourney} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="start-location">Start</Label>
                            <Input
                                id="start-location"
                                type="text"
                                placeholder="e.g., Manchester Piccadilly"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="end-location">Destination</Label>
                            <Input
                                id="end-location"
                                type="text"
                                placeholder="e.g., Old Trafford"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>
                    </div>
                    <Button type="submit" disabled={isLoading || !start || !end}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Planning...
                            </>
                        ) : (
                            'Plan Journey'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

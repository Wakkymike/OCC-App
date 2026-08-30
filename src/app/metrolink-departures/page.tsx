'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock3, Home, Loader2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MetrolinkDepartureBoard, MetrolinkStation } from '@/lib/types';
import PageShell from '@/components/layout/PageShell';

interface MetrolinkStationsResponse {
  stations: MetrolinkStation[];
}

interface MetrolinkDeparturesResponse {
  station: MetrolinkStation;
  departures: MetrolinkDepartureBoard[];
  departureBoard: MetrolinkDepartureBoard | null;
}

const departureSlots = [
  { key: 'Dest0', waitKey: 'Wait0', statusKey: 'Status0' },
  { key: 'Dest1', waitKey: 'Wait1', statusKey: 'Status1' },
  { key: 'Dest2', waitKey: 'Wait2', statusKey: 'Status2' },
  { key: 'Dest3', waitKey: 'Wait3', statusKey: 'Status3' },
] as const;

const formatDepartureLabel = (value: string | undefined, fallback = '—') => {
  if (!value || value.trim() === '') return fallback;
  return value;
};

export default function MetrolinkDeparturesPage() {
  const [stations, setStations] = useState<MetrolinkStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [departureBoard, setDepartureBoard] = useState<MetrolinkDepartureBoard | null>(null);
  const [loadingStations, setLoadingStations] = useState(true);
  const [loadingDepartures, setLoadingDepartures] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStations = async () => {
      setLoadingStations(true);
      try {
        const response = await fetch('/api/metrolink?mode=stations', { cache: 'no-store' });
        const payload = (await response.json()) as MetrolinkStationsResponse;

        if (!response.ok || !Array.isArray(payload.stations)) {
          throw new Error('Unable to load station list');
        }

        if (!cancelled) {
          const sortedStations = payload.stations.sort((a, b) => a.StationLocation.localeCompare(b.StationLocation));
          setStations(sortedStations);
          setSelectedStation((current) => current || sortedStations[0]?.TLAREF || '');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Metrolink stations');
        }
      } finally {
        if (!cancelled) {
          setLoadingStations(false);
        }
      }
    };

    void loadStations();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedStation) return;

    let cancelled = false;

    const loadDepartures = async () => {
      setLoadingDepartures(true);
      setError(null);

      try {
        const response = await fetch(`/api/metrolink?mode=departures&station=${encodeURIComponent(selectedStation)}`, {
          cache: 'no-store',
        });

        const payload = (await response.json()) as MetrolinkDeparturesResponse | { error?: string };

        if (!response.ok) {
          throw new Error('error' in payload ? payload.error ?? 'Unable to load departures' : 'Unable to load departures');
        }

        if (!cancelled && 'departureBoard' in payload && payload.departureBoard) {
          setDepartureBoard(payload.departureBoard);
        } else if (!cancelled && 'departures' in payload && Array.isArray(payload.departures) && payload.departures.length > 0) {
          setDepartureBoard(payload.departures[0]);
        } else if (!cancelled) {
          setDepartureBoard(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load departures');
          setDepartureBoard(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingDepartures(false);
        }
      }
    };

    void loadDepartures();

    return () => {
      cancelled = true;
    };
  }, [selectedStation]);

  const selectedStationDetail = useMemo(
    () => stations.find((station) => station.TLAREF === selectedStation) ?? null,
    [stations, selectedStation],
  );

  return (
    <PageShell
      title="Metrolink Departures"
      description="Live Metrolink departure information from the TfGM feed."
      actions={
        <Button asChild variant="outline" size="icon" aria-label="Home">
          <Link href="/">
            <Home className="h-5 w-5" />
          </Link>
        </Button>
      }
    >
      <Card className="occ-panel">
          <CardHeader>
            <div>
              <CardTitle className="text-xl">Departure Board</CardTitle>
              <CardDescription>
                Choose a stop and inspect the next departures by platform.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Station</p>
                <p className="text-lg font-semibold">{selectedStationDetail?.StationLocation ?? 'Select a station'}</p>
              </div>
              <div className="flex flex-col gap-2 md:min-w-[280px]">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="metrolink-station">
                  Choose station
                </label>
                <select
                  id="metrolink-station"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedStation}
                  onChange={(event) => setSelectedStation(event.target.value)}
                  disabled={loadingStations || stations.length === 0}
                >
                  {stations.map((station) => (
                    <option key={station.Id} value={station.TLAREF}>
                      {station.StationLocation} ({station.TLAREF})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingStations && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Loading station list…</span>
              </div>
            )}

            {error && !loadingDepartures && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {loadingDepartures && !error && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Loading live departures…</span>
              </div>
            )}

            {!loadingDepartures && departureBoard && (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Wait</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Platform</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departureSlots.map((slot) => (
                      <TableRow key={slot.key}>
                        <TableCell>
                          <Badge className="bg-primary/10 text-primary">{departureBoard.Line}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatDepartureLabel(departureBoard[slot.key as keyof MetrolinkDepartureBoard] as string | undefined)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock3 className="h-4 w-4" />
                            <span>
                              {formatDepartureLabel(departureBoard[slot.waitKey as keyof MetrolinkDepartureBoard] as string | undefined)} min
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDepartureLabel(departureBoard[slot.statusKey as keyof MetrolinkDepartureBoard] as string | undefined)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{departureBoard.PIDREF.slice(-1) || '—'}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loadingDepartures && !departureBoard && !error && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No departure data is currently available for this station.
              </div>
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
    </PageShell>
  );
}

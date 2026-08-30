import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { MetrolinkData, MetrolinkDepartureBoard, MetrolinkStation } from '@/lib/types';

// This will make the route dynamic and prevent caching
export const dynamic = 'force-dynamic';

const METROLINK_API_URL = process.env.METROLINK_API_URL ?? 'https://europe-west2-tramsfunc.cloudfunctions.net/tramsfunc';

async function fetchStations(): Promise<MetrolinkStation[]> {
  const response = await fetch(METROLINK_API_URL, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Metrolink station list request failed with status ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function fetchStationDepartures(stationId: number): Promise<MetrolinkDepartureBoard[]> {
  const response = await fetch(`${METROLINK_API_URL}?id=${stationId}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Metrolink departure request failed with status ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode');
  const stationRef = request.nextUrl.searchParams.get('station')?.trim().toUpperCase();

  if (mode === 'stations') {
    try {
      const stations = await fetchStations();
      return NextResponse.json({ stations });
    } catch (error) {
      console.error('Error loading metrolink station list:', error);
      return NextResponse.json({ error: 'Failed to load Metrolink stations' }, { status: 500 });
    }
  }

  if (mode === 'departures') {
    try {
      const stations = await fetchStations();
      if (stations.length === 0) {
        return NextResponse.json({ error: 'No stations available' }, { status: 404 });
      }

      const station = stationRef
        ? stations.find((item) => item.TLAREF.toUpperCase() === stationRef)
        : stations[0];

      if (!station) {
        return NextResponse.json({ error: 'Station not found' }, { status: 404 });
      }

      const departures = await fetchStationDepartures(station.Id);
      const departureBoard = departures[0] ?? null;
      return NextResponse.json({ station, departures: departures.slice(0, 1), departureBoard });
    } catch (error) {
      console.error('Error loading metrolink departures:', error);
      return NextResponse.json({ error: 'Failed to load Metrolink departures' }, { status: 500 });
    }
  }

  try {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'metrolink-data.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data: MetrolinkData = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error: any) {
    // If the file doesn't exist or has an error, return empty data structure.
    if (error.code === 'ENOENT') {
      return NextResponse.json({ stops: [], lines: [] });
    }
    console.error('Error reading metrolink data:', error);
    return NextResponse.json({ error: 'Failed to load Metrolink data' }, { status: 500 });
  }
}

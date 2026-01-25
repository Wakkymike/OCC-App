'use server';
import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';

// Simplified SIRI-VM types from XML, where values are directly on keys
interface VehicleActivityXml {
  MonitoredVehicleJourney: {
    LineRef: string;
    DestinationName: string;
    VehicleLocation: { Longitude: string; Latitude: string };
    VehicleRef: string;
    BlockRef?: string;
  };
}

export async function GET() {
  const apiKey = process.env.BODS_API_KEY;
  const feedId = '18880';

  if (!apiKey) {
    console.error('BODS_API_KEY is missing. Please check .env.local');
    return NextResponse.json(
      { error: 'BODS_API_KEY not configured' },
      { status: 500 }
    );
  }

  const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/${feedId}/?api_key=${apiKey}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      const text = await response.text();
      console.error('BODS API returned error:', response.status, text);
      return NextResponse.json(
        { error: `BODS API error ${response.status}: ${text}` },
        { status: response.status }
      );
    }

    const xmlText = await response.text();
    const parser = new XMLParser();
    const data = parser.parse(xmlText);
    
    let vehicleActivities: VehicleActivityXml[] = [];
    const activitySource = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.VehicleActivity;
    
    if (activitySource) {
        // The parser may return an object for a single entry, so we ensure it's an array.
        vehicleActivities = Array.isArray(activitySource) ? activitySource : [activitySource];
    }

    if (vehicleActivities.length === 0) {
      console.warn('No VehicleActivity found in BODS feed');
    }

    const buses: Bus[] = vehicleActivities
      .map(activity => {
        const journey = activity?.MonitoredVehicleJourney;
        if (!journey || !journey.VehicleLocation || !journey.VehicleRef || !journey.LineRef || !journey.DestinationName) {
            return null;
        }

        const lat = parseFloat(journey.VehicleLocation.Latitude);
        const lng = parseFloat(journey.VehicleLocation.Longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

        return {
          id: journey.VehicleRef,
          fleetNumber: journey.BlockRef ?? journey.VehicleRef,
          service: journey.LineRef,
          destination: journey.DestinationName,
          position: { lat, lng },
        };
      })
      .filter((bus): bus is Bus => bus !== null);

    console.log(`Returning ${buses.length} buses to frontend`);
    return NextResponse.json(buses);
  } catch (error) {
    console.error('Unexpected error fetching/parsing BODS data:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

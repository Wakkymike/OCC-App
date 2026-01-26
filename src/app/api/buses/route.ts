'use server';
import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';

// Simplified SIRI-VM types
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
    console.error('BODS_API_KEY missing in .env.local');
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
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true, // Remove XML namespace prefixes for easier parsing
    });
    const data = parser.parse(xmlText);

    // Collect all VehicleActivities across all VehicleMonitoringDelivery
    let vehicleActivities: VehicleActivityXml[] = [];
    const deliveriesSource = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery;

    if (deliveriesSource) {
      const deliveries = Array.isArray(deliveriesSource)
        ? deliveriesSource
        : [deliveriesSource];

      for (const delivery of deliveries) {
        if (delivery && delivery.VehicleActivity) {
          const activitySource = delivery.VehicleActivity;
          const activities = Array.isArray(activitySource)
            ? activitySource
            : [activitySource];
          vehicleActivities.push(...activities);
        }
      }
    }
    
    if (vehicleActivities.length === 0) {
      console.warn('No VehicleActivity found in BODS feed');
    }

    const buses: Bus[] = (vehicleActivities || [])
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

    console.log(`Total VehicleActivity parsed: ${vehicleActivities.length}`);
    console.log('First 5 vehicles:', vehicleActivities.slice(0,5).map(v => v.MonitoredVehicleJourney.VehicleRef));
    console.log('Positions for first 5 vehicles:', vehicleActivities.slice(0,5).map(v => v.MonitoredVehicleJourney.VehicleLocation));

    console.log(`Returning ${buses.length} buses to frontend`);
    return NextResponse.json(buses);
  } catch (error) {
    console.error('Unexpected error fetching/parsing BODS XML:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

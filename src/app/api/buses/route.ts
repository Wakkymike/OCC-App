'use server';
import { NextResponse } from 'next/server';
import type { Bus } from '@/lib/types';

// Simplified SIRI-VM structure from BODS
interface SiriVmVehicleActivity {
  MonitoredVehicleJourney: {
    LineRef: { value: string };
    DestinationName: { value: string };
    VehicleLocation: {
      Latitude: string;
      Longitude: string;
    };
    VehicleRef: { value: string };
    BlockRef?: { value: string }; // sometimes used as fleet number
  };
}

interface SiriVmResponse {
  Siri: {
    ServiceDelivery: {
      VehicleMonitoringDelivery: {
        VehicleActivity?: SiriVmVehicleActivity[];
      }[];
    };
  };
}

export async function GET() {
  const apiKey = process.env.BODS_API_KEY;
  const feedId = '18880'; // numeric feed ID for Bee Network live feed

  if (!apiKey) {
    console.warn('BODS_API_KEY not set.');
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
      console.error('BODS API error:', response.status, text);
      return NextResponse.json(
        { error: 'Failed to fetch BODS data' },
        { status: response.status }
      );
    }

    const data: SiriVmResponse = await response.json();

    const vehicleActivities =
      data.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.[0]
        ?.VehicleActivity ?? [];

    const buses: Bus[] = vehicleActivities
      .map(activity => {
        const journey = activity.MonitoredVehicleJourney;
        if (!journey.VehicleLocation || !journey.VehicleRef) {
          return null;
        }

        const lat = parseFloat(journey.VehicleLocation.Latitude);
        const lng = parseFloat(journey.VehicleLocation.Longitude);

        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

        return {
          id: journey.VehicleRef.value,
          fleetNumber: journey.BlockRef?.value ?? journey.VehicleRef.value,
          service: journey.LineRef?.value ?? 'N/A',
          destination: journey.DestinationName?.value ?? 'N/A',
          position: { lat, lng },
        };
      })
      .filter((bus): bus is Bus => bus !== null);

    return NextResponse.json(buses);
  } catch (error) {
    console.error('Unexpected error fetching BODS data:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching bus data' },
      { status: 500 }
    );
  }
}

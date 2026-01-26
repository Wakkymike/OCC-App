import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';

export async function GET() {
  const apiKey = process.env.BODS_API_KEY;
  const feedId = '18880';

  if (!apiKey) {
    console.error('BODS_API_KEY missing');
    return NextResponse.json([], { status: 500 });
  }

  const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/${feedId}/?api_key=${apiKey}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    const xmlText = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
    });

    const data = parser.parse(xmlText);

    const deliveries = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery ?? [];
    const deliveriesArray = Array.isArray(deliveries) ? deliveries : [deliveries];

    let vehicleActivities: any[] = [];

    for (const delivery of deliveriesArray) {
      let activities = delivery?.VehicleActivity ?? [];
      if (!activities) continue;
      if (!Array.isArray(activities)) activities = [activities];
      vehicleActivities.push(...activities);
    }

    let skippedCount = 0;
    const skippedVehicles: any[] = [];

    const buses: Bus[] = vehicleActivities
      .map(activity => {
        const journey = activity.MonitoredVehicleJourney;

        if (!journey?.VehicleLocation?.Latitude || !journey?.VehicleLocation?.Longitude) {
          skippedCount++;
          skippedVehicles.push(journey?.VehicleRef ?? 'unknown');
          return null;
        }

        const lat = parseFloat(journey.VehicleLocation.Latitude);
        const lng = parseFloat(journey.VehicleLocation.Longitude);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          skippedCount++;
          skippedVehicles.push(journey?.VehicleRef ?? 'unknown');
          return null;
        }

        return {
          id: journey.VehicleRef,
          fleetNumber: journey.VehicleRef,
          runningBoard: journey.BlockRef ?? 'unknown',
          service: journey.PublishedLineName ?? 'unknown',
          destination: (journey.DestinationName ?? 'unknown').replace(/_/g, ' '),
          direction: journey.DirectionRef ?? 'unknown',
          position: { lat, lng },
        };
      })
      .filter((bus): bus is Bus => bus !== null);

    console.log(
      `Total VehicleActivity parsed: ${vehicleActivities.length}, returning ${buses.length}, skipped ${skippedCount}`
    );

    return NextResponse.json({
      buses,
      debug: {
        totalVehicleActivity: vehicleActivities.length,
        skippedCount,
        skippedVehicles: skippedVehicles.slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Unexpected error fetching/parsing BODS XML:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

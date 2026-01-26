import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export interface Bus {
  id: string;
  fleetNumber: string;
  service: string;
  destination: string;
  position: { lat: number; lng: number };
}

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

    // Collect all VehicleMonitoringDelivery elements
    const deliveries = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery ?? [];
    const deliveriesArray = Array.isArray(deliveries) ? deliveries : [deliveries];

    let vehicleActivities: any[] = [];

    for (const delivery of deliveriesArray) {
      let activities = delivery?.VehicleActivity ?? [];
      if (!activities) continue;
      if (!Array.isArray(activities)) activities = [activities]; // single vehicle
      vehicleActivities.push(...activities);
    }

    // Map vehicles to Bus[] while keeping debug info
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
          fleetNumber: journey.BlockRef ?? journey.VehicleRef,
          service: journey.LineRef ?? 'unknown',
          destination: journey.DestinationName ?? 'unknown',
          position: { lat, lng },
        };
      })
      .filter(Boolean);

    console.log(
      `Total VehicleActivity parsed: ${vehicleActivities.length}, returning ${buses.length}, skipped ${skippedCount}`
    );

    return NextResponse.json({
      buses,
      debug: {
        totalVehicleActivity: vehicleActivities.length,
        skippedCount,
        skippedVehicles: skippedVehicles.slice(0, 10), // first 10 for debug
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

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
    return NextResponse.json({ error: 'Server configuration error: BODS_API_KEY is missing.' }, { status: 500 });
  }

  const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/${feedId}/?api_key=${apiKey}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`BODS API request failed with status ${response.status}:`, errorText);
      return NextResponse.json({ error: `Failed to fetch data from BODS API: ${errorText}` }, { status: response.status });
    }
    
    const xmlText = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
    });

    const data = parser.parse(xmlText);

    const deliveries = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery ?? [];
    const deliveriesArray = Array.isArray(deliveries) ? deliveries : [deliveries];
    
    // Check for ErrorCondition in the response
    for (const delivery of deliveriesArray) {
        if (delivery.ErrorCondition) {
            const errorMessage = delivery.ErrorCondition.Description || 'Unknown error from BODS API';
            console.error('BODS API returned an error condition:', errorMessage);
            return NextResponse.json({ error: `BODS API error: ${errorMessage}` }, { status: 500 });
        }
    }

    let vehicleActivities: any[] = [];
    for (const delivery of deliveriesArray) {
      let activities = delivery?.VehicleActivity ?? [];
      if (!activities) continue;
      if (!Array.isArray(activities)) activities = [activities];
      vehicleActivities.push(...activities);
    }

    const buses: Bus[] = vehicleActivities
      .map(activity => {
        const journey = activity.MonitoredVehicleJourney;

        if (!journey?.VehicleLocation?.Latitude || !journey?.VehicleLocation?.Longitude) {
          return null;
        }

        const lat = parseFloat(journey.VehicleLocation.Latitude);
        const lng = parseFloat(journey.VehicleLocation.Longitude);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
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

    return NextResponse.json({ buses });

  } catch (error) {
    console.error('Unexpected error fetching/parsing BODS XML:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

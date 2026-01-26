import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';

export async function GET() {
  const apiKey = process.env.BODS_API_KEY;
  const feedId = '18880';

  if (!apiKey) {
    console.error('BODS_API_KEY missing');
    return NextResponse.json({ error: "Server configuration error: BODS_API_KEY is missing." }, { status: 500 });
  }

  const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/${feedId}/?api_key=${apiKey}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`BODS API error: ${response.status}`, errorText.slice(0, 500));
        return NextResponse.json({ error: `Failed to fetch data from bus API. Status: ${response.status}`}, { status: response.status });
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

    let vehicleActivities: any[] = [];

    for (const delivery of deliveriesArray) {
      if (delivery.ErrorCondition) {
        console.error('BODS API returned error condition:', delivery.ErrorCondition.Description);
        continue;
      }
      let activities = delivery?.VehicleActivity ?? [];
      if (!activities) continue;
      if (!Array.isArray(activities)) activities = [activities];
      vehicleActivities.push(...activities);
    }

    let skippedCount = 0;
    
    const buses: Bus[] = vehicleActivities
      .map(activity => {
        const journey = activity.MonitoredVehicleJourney;

        if (!journey?.VehicleLocation?.Latitude || !journey?.VehicleLocation?.Longitude) {
          skippedCount++;
          return null;
        }

        const lat = parseFloat(journey.VehicleLocation.Latitude);
        const lng = parseFloat(journey.VehicleLocation.Longitude);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          skippedCount++;
          return null;
        }
        
        const bearing = journey.Bearing ? parseFloat(journey.Bearing) : undefined;
        
        const delayValue = journey.Delay;
        let delayStr: string | undefined;

        if (typeof delayValue === 'string') {
          delayStr = delayValue;
        } else if (delayValue && typeof delayValue === 'object' && '#text' in delayValue) {
          delayStr = (delayValue as any)['#text'];
        }
        
        let delayInMinutes: number | undefined = undefined;

        if (delayStr && delayStr !== 'PT0S') {
          const sign = delayStr.startsWith('-') ? -1 : 1;
          let duration = delayStr.replace(/^-?P(T)?/, '');
          
          let totalSeconds = 0;
          
          if (duration.includes('H')) {
            const parts = duration.split('H');
            if (parts[0] && !isNaN(parseFloat(parts[0]))) {
                totalSeconds += parseFloat(parts[0]) * 3600;
            }
            duration = parts[1] || '';
          }
          if (duration.includes('M')) {
            const parts = duration.split('M');
            if (parts[0] && !isNaN(parseFloat(parts[0]))) {
                totalSeconds += parseFloat(parts[0]) * 60;
            }
            duration = parts[1] || '';
          }
          if (duration.includes('S')) {
            const parts = duration.split('S');
            if (parts[0] && !isNaN(parseFloat(parts[0]))) {
                totalSeconds += parseFloat(parts[0]);
            }
          }
          
          if (totalSeconds >= 30) { 
              const minutes = totalSeconds / 60;
              const roundedMinutes = Math.round(minutes);
              if (roundedMinutes !== 0) {
                delayInMinutes = roundedMinutes * sign;
              }
          }
        }

        return {
          fleetNumber: journey.VehicleRef,
          runningBoard: journey.BlockRef ?? 'unknown',
          service: journey.PublishedLineName ?? 'unknown',
          destination: (journey.DestinationName ?? 'unknown').replace(/_/g, ' '),
          direction: journey.DirectionRef ?? 'unknown',
          position: { lat, lng },
          bearing: bearing && !Number.isNaN(bearing) ? bearing : undefined,
          journeyRef: journey.FramedVehicleJourneyRef?.DatedVehicleJourneyRef,
          delay: delayInMinutes,
        };
      })
      .filter((bus): bus is Bus => bus !== null);

    if (skippedCount > 0) {
        console.log(`Skipped ${skippedCount} buses due to missing location data.`);
    }

    return NextResponse.json({ buses });
  } catch (error) {
    console.error('Unexpected error fetching/parsing BODS XML:', error);
    return NextResponse.json(
      { error: `Unexpected server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

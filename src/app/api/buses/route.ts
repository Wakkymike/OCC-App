import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';

export async function GET() {
  const apiKey = process.env.BODS_API_KEY;
  const feedId = '18880';

  if (!apiKey) {
    console.error('BODS_API_KEY missing');
    return NextResponse.json(
      { error: "Server configuration error: BODS_API_KEY is missing." },
      { status: 500 }
    );
  }

  const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/${feedId}/?api_key=${apiKey}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`BODS API error: ${response.status}`, errorText.slice(0, 500));
      return NextResponse.json(
        { error: `Failed to fetch data from bus API. Status: ${response.status}` },
        { status: response.status }
      );
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
      .map((activity): Bus | null => {
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

        // --- Calculate Delay ---
        // The bus data can provide delay in two ways:
        // 1. A `Delay` field (ISO 8601 duration)
        // 2. A set of `OnwardCalls` with aimed vs. expected arrival times.
        // We will try the `Delay` field first and fall back to `OnwardCalls`.

        let delayInMinutes: number | undefined;

        // Method 1: Parse the `Delay` field if it exists.
        if (journey.Delay) {
          const rawDelay = typeof journey.Delay === 'string' ? journey.Delay : journey.Delay['#text'];
          if (rawDelay && typeof rawDelay === 'string') {
            const match = rawDelay.match(/(-)?PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (match) {
              const sign = match[1] === '-' ? -1 : 1;
              const hours = parseInt(match[2] || '0', 10);
              const minutes = parseInt(match[3] || '0', 10);
              const seconds = parseInt(match[4] || '0', 10);
              const totalSeconds = (hours * 3600 + minutes * 60 + seconds) * sign;
              delayInMinutes = Math.round(totalSeconds / 60);
            }
          }
        }

        // Method 2: If no delay was found, calculate from the first onward call.
        if (delayInMinutes === undefined && journey.OnwardCalls?.OnwardCall) {
          const onwardCalls = Array.isArray(journey.OnwardCalls.OnwardCall)
            ? journey.OnwardCalls.OnwardCall
            : [journey.OnwardCalls.OnwardCall];
          
          if (onwardCalls.length > 0) {
            const firstCall = onwardCalls[0];
            if (firstCall.AimedArrivalTime && firstCall.ExpectedArrivalTime) {
              const aimed = new Date(firstCall.AimedArrivalTime);
              const expected = new Date(firstCall.ExpectedArrivalTime);
              if (!isNaN(aimed.getTime()) && !isNaN(expected.getTime())) {
                const diffSeconds = (expected.getTime() - aimed.getTime()) / 1000;
                // We only consider it a valid delay if it's not a huge number (e.g., > 1 day)
                if (Math.abs(diffSeconds) < 86400) { 
                  delayInMinutes = Math.round(diffSeconds / 60);
                }
              }
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
      console.log(`Skipped ${skippedCount} buses due to missing or invalid location data.`);
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

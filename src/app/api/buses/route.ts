
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

        // --- Robust Delay Calculation ---
        let delayInMinutes: number | undefined;

        // Method 1: Attempt to parse the 'Delay' field (ISO 8601 duration).
        if (journey.Delay) {
            const rawDelay = typeof journey.Delay === 'string' ? journey.Delay : journey.Delay['#text'];
            if (rawDelay && typeof rawDelay === 'string') {
                // Regex for ISO 8601 duration format, e.g., 'PT1M30S' or 'P1M'. The 'T' is now optional.
                const match = rawDelay.match(/(-)?P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(\.\d+)?)S)?/);
                if (match) {
                    try {
                        const sign = match[1] === '-' ? -1 : 1;
                        const hours = parseInt(match[2] || '0', 10);
                        const minutes = parseInt(match[3] || '0', 10);
                        const seconds = parseFloat(match[4] || '0');
                        
                        if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
                            // We only calculate a delay if at least one time component was present.
                            if (hours > 0 || minutes > 0 || seconds > 0) {
                                const totalSeconds = (hours * 3600 + minutes * 60 + seconds) * sign;
                                delayInMinutes = Math.round(totalSeconds / 60);
                            } else if (rawDelay.includes('PT0S') || rawDelay.includes('P0S') || rawDelay === 'P0D') { // Explicitly on time
                                delayInMinutes = 0;
                            }
                        }
                    } catch {
                        // Ignore parsing errors, will fallback to other methods.
                    }
                }
            }
        }

        const calculateDelayFromTimes = (call: any): number | undefined => {
            if (call && call.AimedArrivalTime && call.ExpectedArrivalTime) {
                const aimed = new Date(call.AimedArrivalTime);
                const expected = new Date(call.ExpectedArrivalTime);
                
                if (!isNaN(aimed.getTime()) && !isNaN(expected.getTime())) {
                    const diffSeconds = (expected.getTime() - aimed.getTime()) / 1000;
                    
                    // Sanity check: A huge delay is likely a data error.
                    if (Math.abs(diffSeconds) < 86400) { // less than 1 day
                        return Math.round(diffSeconds / 60);
                    }
                }
            }
            return undefined;
        }

        // Method 2: Check the 'MonitoredCall' (next stop).
        if (delayInMinutes === undefined) {
            delayInMinutes = calculateDelayFromTimes(journey.MonitoredCall);
        }

        // Method 3: If still no delay, check the 'OnwardCalls' (subsequent stops).
        if (delayInMinutes === undefined && journey.OnwardCalls?.OnwardCall) {
          const onwardCalls = Array.isArray(journey.OnwardCalls.OnwardCall)
            ? journey.OnwardCalls.OnwardCall
            : [journey.OnwardCalls.OnwardCall];
          
          for (const call of onwardCalls) {
              const delay = calculateDelayFromTimes(call);
              if (delay !== undefined) {
                  delayInMinutes = delay;
                  break; // Use the first valid delay we find
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


import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';

// Helper function moved outside GET to avoid re-declaration and ensure scope.
const calculateDelayFromTimes = (call: any): number | undefined => {
    if (!call) return undefined;

    let aimedTimeVal: any, expectedTimeVal: any;

    // Prefer arrival times, but fallback to departure times
    if (call.AimedArrivalTime && call.ExpectedArrivalTime) {
        aimedTimeVal = call.AimedArrivalTime;
        expectedTimeVal = call.ExpectedArrivalTime;
    } else if (call.AimedDepartureTime && call.ExpectedDepartureTime) {
        aimedTimeVal = call.AimedDepartureTime;
        expectedTimeVal = call.ExpectedDepartureTime;
    } else {
        return undefined;
    }
    
    // Handle cases where the value is in a '#text' property due to XML attributes
    const aimedTimeStr = (typeof aimedTimeVal === 'object' && aimedTimeVal !== null && '#text' in aimedTimeVal) ? aimedTimeVal['#text'] : aimedTimeVal;
    const expectedTimeStr = (typeof expectedTimeVal === 'object' && expectedTimeVal !== null && '#text' in expectedTimeVal) ? expectedTimeVal['#text'] : expectedTimeVal;

    // Ensure we have valid, non-empty strings before creating Date objects
    if (typeof aimedTimeStr !== 'string' || typeof expectedTimeStr !== 'string' || !aimedTimeStr || !expectedTimeStr) {
        return undefined;
    }

    const aimed = new Date(aimedTimeStr);
    const expected = new Date(expectedTimeStr);
        
    if (!isNaN(aimed.getTime()) && !isNaN(expected.getTime())) {
        const diffSeconds = (expected.getTime() - aimed.getTime()) / 1000;
        
        // Sanity check: A huge delay is likely a data error (e.g., > 1 day)
        if (Math.abs(diffSeconds) < 86400) { 
            return Math.round(diffSeconds / 60);
        }
    }
    return undefined;
}


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

        // --- NEW, MOST ROBUST STATUS CALCULATION ---
        let delayInMinutes: number | undefined;
        let status: string = 'Unknown'; // Default status

        // Method 1: The <Delay> field is the most direct source.
        const delayValue = journey.Delay;
        if (delayInMinutes === undefined && delayValue !== undefined && delayValue !== null) {
            const rawDelay = (typeof delayValue === 'object' && '#text' in delayValue) 
              ? delayValue['#text'] 
              : delayValue;
            
            if (typeof rawDelay === 'string' && (rawDelay.startsWith('P') || rawDelay.startsWith('-P'))) {
              try {
                  const match = rawDelay.match(/(-)?P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(\.\d+)?)S)?/);
                  if (match) {
                      const sign = match[1] === '-' ? -1 : 1;
                      const hours = parseInt(match[2] || '0', 10);
                      const minutes = parseInt(match[3] || '0', 10);
                      const seconds = parseFloat(match[4] || '0');
                      const totalSeconds = (hours * 3600 + minutes * 60 + seconds) * sign;
                      if (Math.abs(totalSeconds) < 86400) {
                          delayInMinutes = Math.round(totalSeconds / 60);
                      }
                  }
              } catch { /* Fallback */ }
            } else if (!isNaN(Number(rawDelay))) {
                const delaySeconds = Number(rawDelay);
                if (Math.abs(delaySeconds) < 86400) {
                    delayInMinutes = Math.round(delaySeconds / 60);
                }
            }
        }

        // Method 2: Fallback to calculating from scheduled vs expected times.
        if (delayInMinutes === undefined) {
            const callsToCheck = [];
            if (journey.MonitoredCall) {
                callsToCheck.push(journey.MonitoredCall);
            }
            if (journey.OnwardCalls?.OnwardCall) {
                const onwardCalls = Array.isArray(journey.OnwardCalls.OnwardCall)
                  ? journey.OnwardCalls.OnwardCall
                  : [journey.OnwardCalls.OnwardCall];
                callsToCheck.push(...onwardCalls);
            }

            for (const call of callsToCheck) {
                const calculatedDelay = calculateDelayFromTimes(call);
                if (calculatedDelay !== undefined) {
                    delayInMinutes = calculatedDelay;
                    break; // Use the first valid delay we find
                }
            }
        }

        // Method 3: Final fallback to text-based status indicators.
        if (delayInMinutes === undefined) {
            const progressStatus = (journey.ProgressStatus || '').toLowerCase();
            if (progressStatus.includes('on time')) {
                status = 'On Time';
            } else if (progressStatus.includes('late')) {
                status = 'Late';
            } else if (progressStatus.includes('early')) {
                status = 'Early';
            }
        }

        // Finally, set the status string based on the numeric delay, if we have one.
        // This will override text statuses like 'Late' with a more specific 'X min late'.
        if (delayInMinutes !== undefined) {
            if (delayInMinutes > 2) {
              status = `${delayInMinutes} min late`;
            } else if (delayInMinutes < -2) {
              status = `${Math.abs(delayInMinutes)} min early`;
            } else {
              status = 'On Time';
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
          status: status,
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

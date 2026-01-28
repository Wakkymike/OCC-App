
import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';

// Helper to safely extract a text value from a field which might be a string or an object with a #text property.
const getText = (field: any): string | undefined => {
    if (field === undefined || field === null) return undefined;
    if (typeof field === 'object' && '#text' in field) {
        return field['#text'];
    }
    if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') {
        return String(field);
    }
    return undefined;
};


// Helper to calculate delay by comparing aimed vs expected times.
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
    
    const aimedTimeStr = getText(aimedTimeVal);
    const expectedTimeStr = getText(expectedTimeVal);

    // Ensure we have valid, non-empty strings before creating Date objects
    if (!aimedTimeStr || !expectedTimeStr) {
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
        console.error('BODS API returned error condition:', getText(delivery.ErrorCondition.Description));
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
        if (!journey) return null;

        const fleetNumber = getText(journey.VehicleRef);
        const runningBoard = getText(journey.BlockRef);
        const service = getText(journey.PublishedLineName);
        const destination = getText(journey.DestinationName)?.replace(/_/g, ' ');
        const direction = getText(journey.DirectionRef);
        const journeyRef = getText(journey.FramedVehicleJourneyRef?.DatedVehicleJourneyRef);

        // --- CANCELLATION CHECK ---
        const progressStatusText = getText(journey.ProgressStatus)?.toLowerCase() ?? '';
        if (progressStatusText.includes('cancelled')) {
          return {
            fleetNumber: fleetNumber ?? 'unknown',
            runningBoard: runningBoard ?? 'unknown',
            service: service ?? 'unknown',
            destination: destination ?? 'Cancelled',
            direction: direction ?? 'unknown',
            journeyRef: journeyRef,
            status: 'Cancelled',
          };
        }

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
        
        const bearing = journey.Bearing ? parseFloat(getText(journey.Bearing)!) : undefined;
        
        const monitoredCall = journey.MonitoredCall;
        const nextStop = getText(monitoredCall?.StopPointName)?.replace(/_/g, ' ');


        // --- MULTI-LAYERED STATUS CALCULATION ---
        let delayInMinutes: number | undefined;
        let status: string = 'Unknown';

        // Method 1: Calculate from scheduled vs expected times. This is often the most reliable.
        const callsToCheck = [];
        if (journey.MonitoredCall) callsToCheck.push(journey.MonitoredCall);
        
        if (journey.OnwardCalls?.OnwardCall) {
            const onward = Array.isArray(journey.OnwardCalls.OnwardCall) ? journey.OnwardCalls.OnwardCall : [journey.OnwardCalls.OnwardCall];
            callsToCheck.push(...onward);
        }

        for (const call of callsToCheck) {
            const calculatedDelay = calculateDelayFromTimes(call);
            if (calculatedDelay !== undefined) {
                delayInMinutes = calculatedDelay;
                break; // Use the first valid delay we find
            }
        }

        // Method 2: Fallback to the <Delay> field if calculation fails.
        if (delayInMinutes === undefined) {
            const delayText = getText(journey.Delay);
            if (delayText) {
                // Handle ISO 8601 Duration format (e.g., 'PT2M30S', '-PT1M')
                if (delayText.startsWith('PT') || delayText.startsWith('-PT')) {
                    const isNegative = delayText.startsWith('-');
                    const durationStr = isNegative ? delayText.substring(1) : delayText;
                    try {
                        const minutesMatch = durationStr.match(/(\d+)M/);
                        const secondsMatch = durationStr.match(/(\d+)S/);
                        const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
                        const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;
                        let totalSeconds = (minutes * 60) + seconds;
                        if (isNegative) totalSeconds = -totalSeconds;
                        
                        if (Math.abs(totalSeconds) < 86400) {
                            delayInMinutes = Math.round(totalSeconds / 60);
                        }
                    } catch (e) { /* Parsing failed, continue */ }
                } 
                // Handle raw seconds format
                else if (!isNaN(Number(delayText))) {
                    const delaySeconds = Number(delayText);
                    if (Math.abs(delaySeconds) < 86400) { 
                        delayInMinutes = Math.round(delaySeconds / 60);
                    }
                }
            }
        }
        
        // Method 3: Final fallback to text-based status indicators.
        if (delayInMinutes === undefined) {
            if (progressStatusText.includes('on time')) {
                status = 'On Time';
                delayInMinutes = 0; // Set to 0 so the formatter below provides a consistent message
            } else if (progressStatusText.includes('late')) {
                status = 'Late';
            } else if (progressStatusText.includes('early')) {
                status = 'Early';
            }
        }

        // Finally, set the specific status string based on the numeric delay, if we have one.
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
          fleetNumber: fleetNumber ?? 'unknown',
          runningBoard: runningBoard ?? 'unknown',
          service: service ?? 'unknown',
          destination: destination ?? 'unknown',
          direction: direction ?? 'unknown',
          position: { lat, lng },
          bearing: bearing && !Number.isNaN(bearing) ? bearing : undefined,
          journeyRef: journeyRef,
          delay: delayInMinutes,
          status: status,
          nextStop: nextStop,
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

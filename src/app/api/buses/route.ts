
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

// New, more robust parser for ISO 8601 duration strings (e.g., PT1H5M, -PT2M30S)
// Also handles raw seconds as a fallback.
const parseISODuration = (duration: string): number | undefined => {
    if (!duration) return undefined;

    // Handle case where duration is just a number (in seconds)
    const secondsAsNumber = parseFloat(duration);
    if (!isNaN(secondsAsNumber) && !duration.startsWith('P') && !duration.startsWith('-P')) {
        // A duration of 0 is valid.
        if (Math.abs(secondsAsNumber) < 86400) { // Sanity check for less than a day
            return Math.round(secondsAsNumber / 60);
        }
    }
    
    // Handle ISO 8601 Duration format
    if (!duration.startsWith('P') && !duration.startsWith('-P')) {
        return undefined;
    }
    
    const isNegative = duration.startsWith('-');
    // Remove P or -P from the start
    const durationStr = isNegative ? duration.substring(2) : duration.substring(1);
    
    // Check if there is a time component
    const timePart = durationStr.includes('T') ? durationStr.split('T')[1] : durationStr;
    
    if (!timePart) return undefined;
    
    let totalSeconds = 0;
    
    const hoursMatch = timePart.match(/(\d+(?:\.\d+)?)H/);
    const minutesMatch = timePart.match(/(\d+(?:\.\d+)?)M/);
    const secondsMatch = timePart.match(/(\d+(?:\.\d+)?)S/);

    if (hoursMatch) totalSeconds += parseFloat(hoursMatch[1]) * 3600;
    if (minutesMatch) totalSeconds += parseFloat(minutesMatch[1]) * 60;
    if (secondsMatch) totalSeconds += parseFloat(secondsMatch[1]);
    
    if (isNegative) totalSeconds = -totalSeconds;
    
    return Math.round(totalSeconds / 60);
}


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

    try {
        const aimed = new Date(aimedTimeStr);
        const expected = new Date(expectedTimeStr);
            
        if (!isNaN(aimed.getTime()) && !isNaN(expected.getTime())) {
            const diffSeconds = (expected.getTime() - aimed.getTime()) / 1000;
            
            // Sanity check: A huge delay is likely a data error (e.g., > 1 day)
            if (Math.abs(diffSeconds) < 86400) { 
                return Math.round(diffSeconds / 60);
            }
        }
    } catch (e) {
      // Date parsing can fail
      return undefined;
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
      parseNodeValue: true, 
      parseAttributeValue: true,
      trimValues: true,
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
        const progressStatusText = getText(journey.ProgressStatus)?.toLowerCase() ?? '';

        // --- CANCELLATION CHECK ---
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

        if (isNaN(lat) || isNaN(lng)) {
          skippedCount++;
          return null;
        }
        
        const bearing = journey.Bearing ? parseFloat(getText(journey.Bearing)!) : undefined;
        
        // --- MULTI-LAYERED STATUS AND NEXT STOP CALCULATION ---
        let delayInMinutes: number | undefined;
        let status: string = 'Unknown';
        let nextStop: string | undefined;

        // --- Delay Calculation ---
        // Method 1: Use the <Delay> field. This is the most direct data source.
        const delayText = getText(journey.Delay);
        if (delayText) {
            delayInMinutes = parseISODuration(delayText);
        }
        
        const monitoredCall = journey.MonitoredCall;
        const onwardCalls = journey.OnwardCalls?.OnwardCall ? (Array.isArray(journey.OnwardCalls.OnwardCall) ? journey.OnwardCalls.OnwardCall : [journey.OnwardCalls.OnwardCall]) : [];
        
        // Method 2: Fallback to calculating from scheduled vs expected times if <Delay> failed.
        if (delayInMinutes === undefined) {
            const callsToCheck = [];
            if (monitoredCall) callsToCheck.push(monitoredCall);
            callsToCheck.push(...onwardCalls);

            for (const call of callsToCheck) {
                const calculatedDelay = calculateDelayFromTimes(call);
                if (calculatedDelay !== undefined) {
                    delayInMinutes = calculatedDelay;
                    break; // Use the first valid delay we find
                }
            }
        }
        
        // --- Status String Generation ---
        if (delayInMinutes !== undefined) {
            if (delayInMinutes > 2) {
              status = `${delayInMinutes} min late`;
            } else if (delayInMinutes < -2) {
              status = `${Math.abs(delayInMinutes)} min early`;
            } else {
              status = 'On Time';
            }
        } else {
            // Method 3: Final fallback to text-based status if numeric delay failed.
            if (progressStatusText.includes('on time')) {
                status = 'On Time';
                delayInMinutes = 0; 
            } else if (progressStatusText.includes('late')) {
                status = 'Late';
            } else if (progressStatusText.includes('early')) {
                status = 'Early';
            }
        }

        // --- Next Stop Calculation ---
        nextStop = getText(monitoredCall?.StopPointName)?.replace(/_/g, ' ');
        if (!nextStop && onwardCalls.length > 0) {
            nextStop = getText(onwardCalls[0]?.StopPointName)?.replace(/_/g, ' ');
        }


        return {
          fleetNumber: fleetNumber ?? 'unknown',
          runningBoard: runningBoard ?? 'unknown',
          service: service ?? 'unknown',
          destination: destination ?? 'unknown',
          direction: direction ?? 'unknown',
          position: { lat, lng },
          bearing: bearing && !isNaN(bearing) ? bearing : undefined,
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

    
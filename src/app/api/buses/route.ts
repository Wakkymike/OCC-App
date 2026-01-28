
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
const calculateDelayFromTimes = (aimedTimeStr: string | undefined, expectedTimeStr: string | undefined): number | undefined => {
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
        console.warn('BODS API returned an error condition:', getText(delivery.ErrorCondition.Description));
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
        try {
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

          if (!journey.VehicleLocation || !journey.VehicleLocation.Latitude || !journey.VehicleLocation.Longitude) {
            skippedCount++;
            return null;
          }

          const lat = parseFloat(journey.VehicleLocation.Latitude);
          const lng = parseFloat(journey.VehicleLocation.Longitude);

          if (isNaN(lat) || isNaN(lng)) {
            skippedCount++;
            return null;
          }
          
          const bearingText = getText(journey.Bearing);
          const bearing = bearingText ? parseFloat(bearingText) : undefined;
          
          let delayInMinutes: number | undefined;
          let status: string = 'Unknown';
          let currentStop: string | undefined;
          let nextStop: string | undefined;

          const monitoredCall = journey.MonitoredCall;
          const onwardCallsRaw = journey.OnwardCalls?.OnwardCall;
          const onwardCalls = onwardCallsRaw ? (Array.isArray(onwardCallsRaw) ? onwardCallsRaw : [onwardCallsRaw]) : [];
          
          if (monitoredCall) {
              currentStop = getText(monitoredCall.StopPointName)?.replace(/_/g, ' ');
          }

          const potentialCalls = [...onwardCalls];
          if (monitoredCall) {
            potentialCalls.push(monitoredCall)
          }

          for (const call of potentialCalls) {
              const aimedTime = getText(call.AimedArrivalTime) ?? getText(call.AimedDepartureTime);
              const expectedTime = getText(call.ExpectedArrivalTime) ?? getText(call.ExpectedDepartureTime);
              
              const calculatedDelay = calculateDelayFromTimes(aimedTime, expectedTime);

              if (calculatedDelay !== undefined) {
                  delayInMinutes = calculatedDelay;
                  
                  if (!nextStop) {
                    const stopName = getText(call.StopPointName)?.replace(/_/g, ' ');
                    if (stopName && stopName !== currentStop) {
                        nextStop = stopName;
                    }
                  }
                  
                  break; 
              }
          }
          
          if (delayInMinutes !== undefined && !nextStop && onwardCalls.length > 0) {
              nextStop = getText(onwardCalls[0].StopPointName)?.replace(/_/g, ' ');
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
              // Fallback to text status if no delay could be calculated
              if (progressStatusText.includes('on time')) {
                  status = 'On Time';
              } else if (progressStatusText.includes('late')) {
                  status = 'Late';
              } else if (progressStatusText.includes('early')) {
                  status = 'Early';
              }
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
            currentStop: currentStop,
            nextStop: nextStop,
          };
        } catch (e) {
          // If processing a single bus record fails, log it and continue instead of crashing
          console.error('Error processing individual bus record:', e, 'Record:', JSON.stringify(activity, null, 2).slice(0, 1000));
          return null;
        }
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

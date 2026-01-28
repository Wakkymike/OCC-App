
import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';
import timetable from '@/lib/timetable-data.json';
import { parse as dateFnsParse } from 'date-fns';

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

const ensureArray = (item: any) => {
    if (!item) return [];
    if (Array.isArray(item)) return item;
    return [item];
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
          let lastStop: string | undefined;
          let nextStop: string | undefined;

          const monitoredCall = journey.MonitoredCall;
          const onwardCallsRaw = journey.OnwardCalls?.OnwardCall;
          const onwardCalls = onwardCallsRaw ? ensureArray(onwardCallsRaw) : [];

          // --- TIMETABLE-BASED DELAY CALCULATION (PRIMARY) ---
          const scheduledJourney = journeyRef ? (timetable as Record<string, any>)[journeyRef] : undefined;
          if (scheduledJourney && Array.isArray(scheduledJourney)) {
            // Iterate through all upcoming stops to find the first one with enough data
            for (const call of onwardCalls) {
              const nextStopRef = getText(call.StopPointRef);
              const expectedTimeStr = getText(call.ExpectedArrivalTime);
              const scheduledStopTime = scheduledJourney.find((s: any) => s.stop === nextStopRef);

              if (scheduledStopTime && expectedTimeStr) {
                const expectedTime = new Date(expectedTimeStr);
                
                // Create three versions of the scheduled time: for today, yesterday, and tomorrow to handle midnight crossings
                const scheduledToday = dateFnsParse(scheduledStopTime.time, 'HH:mm:ss', expectedTime);
                const scheduledYesterday = new Date(scheduledToday.getTime() - 24 * 60 * 60 * 1000);
                const scheduledTomorrow = new Date(scheduledToday.getTime() + 24 * 60 * 60 * 1000);

                // Calculate the difference for each and find the one with the smallest absolute value
                const diffToday = expectedTime.getTime() - scheduledToday.getTime();
                const diffYesterday = expectedTime.getTime() - scheduledYesterday.getTime();
                const diffTomorrow = expectedTime.getTime() - scheduledTomorrow.getTime();
                
                let bestDiff = diffToday;
                if (Math.abs(diffYesterday) < Math.abs(bestDiff)) {
                    bestDiff = diffYesterday;
                }
                if (Math.abs(diffTomorrow) < Math.abs(bestDiff)) {
                    bestDiff = diffTomorrow;
                }
                
                const finalDelayInMinutes = Math.round(bestDiff / (1000 * 60));

                // Sanity check to avoid huge, erroneous delays (e.g. > 1 day)
                if (Math.abs(finalDelayInMinutes) < 1440) { 
                    delayInMinutes = finalDelayInMinutes;
                    // Once we have a valid delay, we can stop searching.
                    break;
                }
              }
            }
          }
          
          if (monitoredCall) {
              lastStop = getText(monitoredCall.StopPointName)?.replace(/_/g, ' ');
          }

          // --- FALLBACK DELAY CALCULATION (FROM LIVE FEED AIMED/EXPECTED) ---
          if (delayInMinutes === undefined) {
              for (const call of onwardCalls) {
                  const aimedTime = getText(call.AimedArrivalTime) ?? getText(call.AimedDepartureTime);
                  const expectedTime = getText(call.ExpectedArrivalTime) ?? getText(call.ExpectedDepartureTime);
                  
                  const calculatedDelay = calculateDelayFromTimes(aimedTime, expectedTime);

                  if (calculatedDelay !== undefined) {
                      delayInMinutes = calculatedDelay;
                      // Once we find a delay, we can break
                      break; 
                  }
              }
          }
          
          // Find next stop name from the first onward call
          if (onwardCalls.length > 0) {
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
            lastStop: lastStop,
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

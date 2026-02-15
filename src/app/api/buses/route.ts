
import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';
import timetable from '@/lib/timetable-data.json';

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
          const recordedAtTimeStr = getText(activity.RecordedAtTime);
          // If the record has no timestamp, we can't verify its freshness, so we skip it.
          if (!recordedAtTimeStr) {
            return null;
          }

          const recordedAt = new Date(recordedAtTimeStr);
          // If the timestamp is invalid, skip it.
          if (isNaN(recordedAt.getTime())) {
            return null;
          }

          const ageInMinutes = (new Date().getTime() - recordedAt.getTime()) / (1000 * 60);

          // If data is older than 3 minutes, consider it stale and remove the bus from the map.
          if (ageInMinutes > 3) {
            return null;
          }

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

          const monitoredCall = journey.MonitoredCall;
          const onwardCallsRaw = journey.OnwardCalls?.OnwardCall;
          const onwardCalls = onwardCallsRaw ? ensureArray(onwardCallsRaw) : [];

          // --- TIMETABLE-BASED DELAY CALCULATION (PRIMARY) ---
          const calculateDelayWithTimetable = (
            expectedTimeStr: string | undefined, 
            scheduledStopTime: { time: string } | undefined
          ): number | undefined => {
            if (!expectedTimeStr || !scheduledStopTime?.time) return undefined;
            
            try {
              const expectedTime = new Date(expectedTimeStr);
              const [hours, minutes, seconds] = scheduledStopTime.time.split(':').map(Number);
              
              // Create scheduled time on the same date as the expected time
              const scheduledTime = new Date(expectedTime);
              scheduledTime.setHours(hours, minutes, seconds, 0);

              let diffMinutes = (expectedTime.getTime() - scheduledTime.getTime()) / (1000 * 60);

              // Basic midnight crossing handling
              if (diffMinutes > 12 * 60) { // e.g., expected is 00:05, scheduled is 23:55
                  scheduledTime.setDate(scheduledTime.getDate() - 1);
                  diffMinutes = (expectedTime.getTime() - scheduledTime.getTime()) / (1000 * 60);
              } else if (diffMinutes < -12 * 60) { // e.g., expected is 23:55, scheduled is 00:05
                  scheduledTime.setDate(scheduledTime.getDate() + 1);
                  diffMinutes = (expectedTime.getTime() - scheduledTime.getTime()) / (1000 * 60);
              }
              
              // Only return a delay if it's within a reasonable range (e.g., less than a day)
              if (Math.abs(diffMinutes) < 1440) {
                  return Math.round(diffMinutes);
              }
            } catch (e) {
              return undefined;
            }
            return undefined;
          };

          const scheduledJourney = journeyRef ? (timetable as Record<string, any>)[journeyRef] : undefined;
          if (scheduledJourney && Array.isArray(scheduledJourney)) {
            let delayFound = false;

            // Method 1: Iterate through upcoming stops (OnwardCalls)
            for (const call of onwardCalls) {
              const stopRef = getText(call.StopPointRef);
              const scheduledStopTime = scheduledJourney.find((s: any) => s.stop === stopRef);
              const calculatedDelay = calculateDelayWithTimetable(getText(call.ExpectedArrivalTime), scheduledStopTime);
              
              if (calculatedDelay !== undefined) {
                delayInMinutes = calculatedDelay;
                delayFound = true;
                break; // Found a valid delay, stop searching
              }
            }

            // Method 2: If no delay found, check the last stop visited (MonitoredCall)
            if (!delayFound && monitoredCall) {
                const stopRef = getText(monitoredCall.StopPointRef);
                const scheduledStopTime = scheduledJourney.find((s: any) => s.stop === stopRef);
                const expectedTimeStr = getText(monitoredCall.ExpectedDepartureTime) ?? getText(monitoredCall.ActualDepartureTime);
                const calculatedDelay = calculateDelayWithTimetable(expectedTimeStr, scheduledStopTime);

                if (calculatedDelay !== undefined) {
                    delayInMinutes = calculatedDelay;
                }
            }
          }
          
          // --- FALLBACK DELAY CALCULATION (FROM LIVE FEED AIMED/EXPECTED) ---
          if (delayInMinutes === undefined) {
              // Check onward calls first
              for (const call of onwardCalls) {
                  const aimedTime = getText(call.AimedArrivalTime) ?? getText(call.AimedDepartureTime);
                  const expectedTime = getText(call.ExpectedArrivalTime) ?? getText(call.ExpectedDepartureTime);
                  const calculatedDelay = calculateDelayFromTimes(aimedTime, expectedTime);
                  if (calculatedDelay !== undefined) {
                      delayInMinutes = calculatedDelay;
                      break; 
                  }
              }
              // If still no delay, check monitored call
              if (delayInMinutes === undefined && monitoredCall) {
                  const aimedTime = getText(monitoredCall.AimedDepartureTime);
                  const expectedTime = getText(monitoredCall.ExpectedDepartureTime);
                  const calculatedDelay = calculateDelayFromTimes(aimedTime, expectedTime);
                  if (calculatedDelay !== undefined) {
                      delayInMinutes = calculatedDelay;
                  }
              }
          }
          
          // --- Status String Generation ---
          if (delayInMinutes !== undefined) {
              const delay = Math.round(delayInMinutes);
              if (delay > 1) {
                status = `${delay} min late`;
              } else if (delay < -1) {
                status = `${Math.abs(delay)} min early`;
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
              } else if (progressStatusText) {
                  status = progressStatusText.charAt(0).toUpperCase() + progressStatusText.slice(1);
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

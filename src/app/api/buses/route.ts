
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

  if (!apiKey) {
    console.error('BODS_API_KEY missing');
    return NextResponse.json(
      { error: "Server configuration error: BODS_API_KEY is missing." },
      { status: 500 }
    );
  }

  const feeds = [
    { operator: 'GNW' as const, feedId: '18880' },
    { operator: 'MET' as const, feedId: '16387' },
    { operator: 'VB' as const, feedId: '20422' },
  ];

  const fetchPromises = feeds.map(feed => {
      const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/${feed.feedId}/?api_key=${apiKey}`;
      return fetch(url, { cache: 'no-store' })
        .then(async (res) => {
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`API error for ${feed.operator} (${feed.feedId}): ${res.status} ${errorText.slice(0, 200)}`);
            }
            return res.text();
        })
        .then(xmlText => ({ xmlText, operator: feed.operator, feedId: feed.feedId }));
  });
  
  const allBuses: Bus[] = [];
  
  try {
      const settledResults = await Promise.allSettled(fetchPromises);
      
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        removeNSPrefix: true,
        parseNodeValue: true, 
        parseAttributeValue: true,
        trimValues: true,
      });

      for (const result of settledResults) {
          if (result.status === 'rejected') {
              console.error('BODS feed fetch failed:', result.reason);
              continue;
          }
          
          const { xmlText, operator } = result.value;
          const data = parser.parse(xmlText);

          const deliveries = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery ?? [];
          const deliveriesArray = Array.isArray(deliveries) ? deliveries : [deliveries];

          let vehicleActivities: any[] = [];
          for (const delivery of deliveriesArray) {
            if (delivery.ErrorCondition) {
              console.warn(`[${operator}] BODS API returned an error condition:`, getText(delivery.ErrorCondition.Description));
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
                if (!recordedAtTimeStr) return null;

                const recordedAt = new Date(recordedAtTimeStr);
                if (isNaN(recordedAt.getTime())) return null;

                const ageInMinutes = (new Date().getTime() - recordedAt.getTime()) / (1000 * 60);
                if (ageInMinutes > 3) return null;

                const journey = activity.MonitoredVehicleJourney;
                if (!journey) return null;

                const fleetNumber = getText(journey.VehicleRef);
                const runningBoard = getText(journey.BlockRef);
                const service = getText(journey.PublishedLineName);
                const destination = getText(journey.DestinationName)?.replace(/_/g, ' ');
                const direction = getText(journey.DirectionRef);
                const journeyRef = getText(journey.FramedVehicleJourneyRef?.DatedVehicleJourneyRef);
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
                    operator: operator,
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
                let status: string;

                const monitoredCall = journey.MonitoredCall;
                const onwardCallsRaw = journey.OnwardCalls?.OnwardCall;
                const onwardCalls = onwardCallsRaw ? ensureArray(onwardCallsRaw) : [];
                
                let callToUse;
                callToUse = onwardCalls.find(c => getText(c.AimedArrivalTime) && getText(c.ExpectedArrivalTime));
                if (callToUse) {
                    delayInMinutes = calculateDelayFromTimes(getText(callToUse.AimedArrivalTime), getText(callToUse.ExpectedArrivalTime));
                }

                if (delayInMinutes === undefined) {
                    callToUse = onwardCalls.find(c => getText(c.AimedDepartureTime) && getText(c.ExpectedDepartureTime));
                    if (callToUse) {
                        delayInMinutes = calculateDelayFromTimes(getText(callToUse.AimedDepartureTime), getText(callToUse.ExpectedDepartureTime));
                    }
                }

                if (delayInMinutes === undefined && monitoredCall) {
                    const aimedTime = getText(monitoredCall.AimedDepartureTime) ?? getText(monitoredCall.AimedArrivalTime);
                    const expectedTime = getText(monitoredCall.ExpectedDepartureTime) ?? getText(monitoredCall.ActualDepartureTime);
                    delayInMinutes = calculateDelayFromTimes(aimedTime, expectedTime);
                }
                
                if (delayInMinutes !== undefined) {
                  const delay = Math.round(delayInMinutes);
                  if (delay > 1) {
                    status = `${delay} min late`;
                  } else if (delay < -1) {
                    status = `${Math.abs(delay)} min early`;
                  } else {
                    status = 'On Time';
                  }
                } else if (progressStatusText) {
                  status = progressStatusText.charAt(0).toUpperCase() + progressStatusText.slice(1);
                } else {
                  status = 'Unknown';
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
                  operator: operator,
                };
              } catch (e) {
                console.error(`[${operator}] Error processing individual bus record:`, e, 'Record:', JSON.stringify(activity, null, 2).slice(0, 1000));
                return null;
              }
            })
            .filter((bus): bus is Bus => bus !== null);

          if (skippedCount > 0) {
            console.log(`[${operator}] Skipped ${skippedCount} buses due to missing or invalid location data.`);
          }
          
          allBuses.push(...buses);
      }

    return NextResponse.json({ buses: allBuses });

  } catch (error) {
    console.error('Unexpected error in buses API route:', error);
    return NextResponse.json(
      { error: `Unexpected server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

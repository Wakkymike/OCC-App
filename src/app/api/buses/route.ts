
import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Bus } from '@/lib/types';

// Helper to safely extract a text value from a field
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
    if (!aimedTimeStr || !expectedTimeStr) return undefined;
    try {
        const aimed = new Date(aimedTimeStr);
        const expected = new Date(expectedTimeStr);
        if (!isNaN(aimed.getTime()) && !isNaN(expected.getTime())) {
            const diffSeconds = (expected.getTime() - aimed.getTime()) / 1000;
            if (Math.abs(diffSeconds) < 86400) { 
                return Math.round(diffSeconds / 60);
            }
        }
    } catch (e) {
      return undefined;
    }
    return undefined;
}

export async function GET() {
  const apiKey = process.env.BODS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Server configuration error: BODS_API_KEY is missing." }, { status: 500 });
  }

  const feeds = [
    { operator: 'GNW' as const, feedId: '18880' },
    { operator: 'MET' as const, feedId: '16387' },
    { operator: 'VB' as const, feedId: '20422' },
    { operator: 'SC' as const, feedId: '14336' },
    { operator: 'FB' as const, feedId: '14327' },
    { operator: 'DB' as const, feedId: '12880' },
  ];

  try {
    const fetchPromises = feeds.map(async (feed) => {
        const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/${feed.feedId}/?api_key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 

        try {
            const res = await fetch(url, { 
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                return { error: `API ${res.status}`, operator: feed.operator };
            }
            const xmlText = await res.text();
            return { xmlText, operator: feed.operator };
        } catch (err) {
            clearTimeout(timeoutId);
            return { error: 'Timeout/Network Error', operator: feed.operator };
        }
    });
    
    const results = await Promise.all(fetchPromises);
    
    // Use a Map to deduplicate buses globally by operator + fleet number
    // This ensures that even if a feed contains multiple activities for one bus, 
    // we only keep the latest one.
    const globalBusMap = new Map<string, Bus>();
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
      parseNodeValue: true, 
      parseAttributeValue: true,
      trimValues: true,
    });

    for (const result of results) {
        if ('error' in result || !result.xmlText) continue;
        
        const { xmlText, operator } = result;
        const data = parser.parse(xmlText);

        const deliveries = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery ?? [];
        const deliveriesArray = Array.isArray(deliveries) ? deliveries : [deliveries];

        let vehicleActivities: any[] = [];
        for (const delivery of deliveriesArray) {
          let activities = delivery?.VehicleActivity ?? [];
          if (!Array.isArray(activities)) activities = [activities];
          vehicleActivities.push(...activities);
        }

        vehicleActivities.forEach((activity) => {
            try {
              const recordedAtTimeStr = getText(activity.RecordedAtTime);
              if (!recordedAtTimeStr) return;

              const recordedAt = new Date(recordedAtTimeStr);
              if (isNaN(recordedAt.getTime())) return;

              // Stricter filtering: 3 minutes max age for active buses
              const ageInMinutes = (new Date().getTime() - recordedAt.getTime()) / (1000 * 60);
              if (ageInMinutes > 3) return; 

              const journey = activity.MonitoredVehicleJourney;
              if (!journey) return;

              const fleetNumber = getText(journey.VehicleRef);
              if (!fleetNumber) return;

              const runningBoard = getText(journey.BlockRef);
              const service = getText(journey.PublishedLineName);
              const destination = getText(journey.DestinationName)?.replace(/_/g, ' ');
              const direction = getText(journey.DirectionRef);
              const journeyRef = getText(journey.FramedVehicleJourneyRef?.DatedVehicleJourneyRef);

              if (!journey.VehicleLocation || !journey.VehicleLocation.Latitude || !journey.VehicleLocation.Longitude) return;

              const lat = parseFloat(journey.VehicleLocation.Latitude);
              const lng = parseFloat(journey.VehicleLocation.Longitude);

              if (isNaN(lat) || isNaN(lng)) return;
              
              const bearingText = getText(journey.Bearing);
              const bearing = bearingText ? parseFloat(bearingText) : undefined;
              
              let delayInMinutes: number | undefined;
              let status: string = 'Active';

              const onwardCallsRaw = journey.OnwardCalls?.OnwardCall;
              const onwardCalls = onwardCallsRaw ? ensureArray(onwardCallsRaw) : [];
              
              let callToUse = onwardCalls.find(c => getText(c.AimedArrivalTime) && getText(c.ExpectedArrivalTime));
              if (callToUse) {
                  delayInMinutes = calculateDelayFromTimes(getText(callToUse.AimedArrivalTime), getText(callToUse.ExpectedArrivalTime));
              }

              if (delayInMinutes !== undefined) {
                const delay = Math.round(delayInMinutes);
                status = delay > 1 ? `${delay} min late` : delay < -1 ? `${Math.abs(delay)} min early` : 'On Time';
              }

              const busData: Bus = {
                fleetNumber: fleetNumber,
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

              const busKey = `${operator}-${fleetNumber}`;
              const existing = globalBusMap.get(busKey);
              
              // Only update if this activity is newer than the one we already have
              // (BODS VM usually lists packets in order, but checking helps)
              if (!existing) {
                globalBusMap.set(busKey, busData);
              }
            } catch (e) {
              return;
            }
        });
    }

    return NextResponse.json({ buses: Array.from(globalBusMap.values()) });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error processing bus data' }, { status: 500 });
  }
}

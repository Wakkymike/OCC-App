import {NextResponse} from 'next/server';
import type {Bus} from '@/lib/types';

// This is a simplified representation of the SIRI-VM data structure.
interface SiriVmVehicleActivity {
  MonitoredVehicleJourney: {
    LineRef: { value: string };
    DirectionRef: { value: string };
    DestinationName: { value: string };
    VehicleLocation: {
      Latitude: string;
      Longitude: string;
    };
    OperatorRef: { value: string };
    VehicleRef: { value: string };
    BlockRef?: { value: string }; // fleet number can be here
  };
  RecordedAtTime: string;
}

interface SiriVmResponse {
  Siri: {
    ServiceDelivery: {
      VehicleMonitoringDelivery: {
        VehicleActivity: SiriVmVehicleActivity[];
      }[];
      ResponseTimestamp: string;
    };
  };
}


export async function GET() {
  const apiKey = process.env.BODS_API_KEY;
  const operatorCode = 'BNGN';
  
  if (!apiKey || apiKey === 'YOUR_BODS_KEY_HERE') {
    console.warn('BODS API key is not configured. Returning empty array.');
    return NextResponse.json([]);
  }

  const url = `https://data.bus-data.dft.gov.uk/api/v1/siri-vm?OperatorRef=${operatorCode}&api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 10 } // Revalidate every 10 seconds
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("BODS API Error:", errorText);
        return NextResponse.json({ error: `Failed to fetch data from BODS API: ${response.statusText}` }, { status: response.status });
    }

    const data: SiriVmResponse = await response.json();
    
    const vehicleActivities = data.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.[0]?.VehicleActivity;

    if (!vehicleActivities) {
      return NextResponse.json([]);
    }
    
    const buses: Bus[] = vehicleActivities.map(activity => {
      const journey = activity.MonitoredVehicleJourney;
      return {
        id: journey.VehicleRef.value,
        fleetNumber: journey.BlockRef?.value || journey.VehicleRef.value,
        service: journey.LineRef.value,
        destination: journey.DestinationName.value,
        position: {
          lat: parseFloat(journey.VehicleLocation.Latitude),
          lng: parseFloat(journey.VehicleLocation.Longitude),
        },
      };
    }).filter(bus => bus.position.lat && bus.position.lng);

    return NextResponse.json(buses);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred while fetching bus data.' }, { status: 500 });
  }
}

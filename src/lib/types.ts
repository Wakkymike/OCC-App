export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bus {
  fleetNumber: string;      // VehicleRef
  runningBoard: string;     // BlockRef
  service: string;          // PublishedLineName
  destination: string;      // DestinationName
  direction: string;        // DirectionRef
  position: LatLng;
  bearing?: number;
  journeyRef?: string;
  delay?: number; // Delay in minutes
}

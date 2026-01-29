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
  position?: LatLng;
  bearing?: number;
  journeyRef?: string;
  delay?: number; // Delay in minutes, for internal logic/styling
  status: string; // The display text for status: "On Time", "5 min late", "Unknown"
  roadName?: string;
  postcode?: string;
}

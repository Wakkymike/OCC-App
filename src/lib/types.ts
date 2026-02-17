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
  operator: 'GNW' | 'MET' | 'VB';
}

export interface MetrolinkStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[];
}

export interface MetrolinkLine {
  id: string;
  name: string;
  color: string;
  path: string[]; // Array of stop IDs
}

export interface MetrolinkData {
  stops: MetrolinkStop[];
  lines: MetrolinkLine[];
}

export interface JourneyPlan {
  service: string;
  destination: string;
  routeName: string;
  startStop: LatLng;
  endStop: LatLng;
  path: LatLng[];
}

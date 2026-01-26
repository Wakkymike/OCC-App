// src/lib/types.ts

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bus {
  id: string;
  fleetNumber: string;      // VehicleRef
  runningBoard: string;     // BlockRef
  service: string;          // PublishedLineName
  destination: string;      // DestinationName
  direction: string;        // DirectionRef
  position: LatLng;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bus {
  id: string;
  fleetNumber: string;
  service: string;
  runningBoard: string;
  direction: 'inbound' | 'outbound' | string;
  destination?: string;
  position: LatLng;
}

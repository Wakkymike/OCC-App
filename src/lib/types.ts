export type LatLng = {
  lat: number;
  lng: number;
};

export interface Bus {
  id: string;
  fleetNumber: string;
  runningBoard: string;
  service: string;
  destination: string;
  direction?: string;
  position: LatLng;
}

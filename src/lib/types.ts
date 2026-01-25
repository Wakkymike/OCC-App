export type LatLng = {
  lat: number;
  lng: number;
};

export type Bus = {
  id: string;
  fleetNumber: string;
  service: string;
  destination: string;
  position: LatLng;
};

export type LatLng = {
  lat: number;
  lng: number;
};

export type Route = {
  id: string;
  name: string;
  path: LatLng[];
};

export type Bus = {
  id: string;
  fleetNumber: string;
  service: string;
  destination: string;
  position: LatLng;
};

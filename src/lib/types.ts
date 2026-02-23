import { Timestamp } from 'firebase/firestore';

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
  delay?: number; 
  status: string; 
  operator: 'GNW' | 'MET' | 'VB' | 'SC' | 'FB' | 'DB';
}

export interface MetrolinkData {
  stops: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    lines: string[];
  }[];
  lines: {
    id: string;
    name: string;
    color: string;
    path: string[];
  }[];
}

export interface JourneyPlan {
  service: string;
  destination: string;
  routeName: string;
  startStop: LatLng;
  endStop: LatLng;
  path: LatLng[];
}

export interface Roadwork {
  id: string;
  title: string;
  description: string;
  location: LatLng;
  severity: 'low' | 'moderate' | 'high';
  link: string;
  pubDate: string;
}

export interface NetworkUpdate {
  id: string;
  title: string;
  details: string;
  priority: number;
  isVisible: boolean;
  createdAt: Timestamp;
}

export interface Hazard {
  id: string;
  type: 'height' | 'width' | 'both';
  value: string;
  location: LatLng;
  description: string;
}

export interface MonitoredHazard {
  id: string; // Firestore Document ID
  hazardId: string; // The original hazard ID from OSM
  type: 'height' | 'width' | 'both';
  value: string;
  location: LatLng;
  geofenceCenter?: LatLng;
  description: string;
  radius: number;
  createdAt: Timestamp;
}

export interface ActiveAlert {
  id: string;
  busId: string;
  fleetNumber: string;
  service: string;
  hazardId: string;
  monitorId: string;
  hazardValue: string;
  hazardDescription: string;
  timestamp: Timestamp;
}

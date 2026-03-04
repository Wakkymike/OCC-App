
// Timestamps are ISO 8601 date strings from the SQLite/REST API layer

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

export interface BusStop {
  atcoCode: string;
  name: string;
  lat: number;
  lng: number;
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
  createdAt: string;
}

export interface Hazard {
  id: string;
  type: 'height' | 'width' | 'both' | 'manual';
  value: string;
  location: LatLng;
  description: string;
}

export interface MonitoredHazard {
  id: string;
  hazardId: string;
  type: 'height' | 'width' | 'both' | 'manual';
  value: string;
  location: LatLng;
  geofenceCenter?: LatLng;
  description: string;
  radius: number;
  createdAt: string;
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
  isAcknowledged: boolean;
  timestamp: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  historyDocId?: string;
}

export interface AlertHistory {
  id: string;
  busId: string;
  fleetNumber: string;
  service: string;
  hazardId: string;
  monitorId: string;
  hazardValue: string;
  hazardDescription: string;
  timestamp: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface CallLog {
  id: string;
  userId: string;
  date: string;
  callTime: string;
  employeeNumber: string;
  fleetNumber: string;
  runningBoard: string;
  serviceNumber: string;
  depot: string;
  phoneNumber: string;
  timeFrom: string;
  timeTo: string;
  details: string;
  isTeamsRelated: boolean;
  isTicketerRelated: boolean;
  isEPMRelated: boolean;
  isIRRelated: boolean;
  isTSIRelated: boolean;
  isDriverReportRelated: boolean;
  createdAt: string;
}

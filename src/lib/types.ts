
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
  /** Name of the previous / current stop from MonitoredCall (SIRI-VM) */
  lastStop?: string;
  /** Name of the next upcoming stop from the first OnwardCall */
  nextStop?: string;
  /** Expected arrival time at the next stop (ISO string) */
  nextStopExpectedArrival?: string;
  /** The origin / departure stop name */
  origin?: string;
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

export interface MetrolinkStation {
  Id: number;
  TLAREF: string;
  StationLocation: string;
}

export interface MetrolinkDepartureBoard {
  Id: number;
  Line: string;
  TLAREF: string;
  PIDREF: string;
  StationLocation: string;
  AtcoCode: string;
  Direction: string;
  Dest0: string;
  Carriages0: string;
  Status0: string;
  Wait0: string;
  Dest1: string;
  Carriages1: string;
  Status1: string;
  Wait1: string;
  Dest2: string;
  Carriages2: string;
  Status2: string;
  Wait2: string;
  Dest3: string;
  Carriages3: string;
  Status3: string;
  Wait3: string;
  MessageBoard: string;
  LastUpdated: string;
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

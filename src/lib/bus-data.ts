import type { Bus, Route } from './types';

export const routes: Route[] = [
  {
    id: 'route-1',
    name: 'Central Line',
    path: [
      { lat: 51.5173, lng: -0.1437 }, // Oxford Circus
      { lat: 51.5153, lng: -0.1224 }, // Tottenham Court Road
      { lat: 51.5134, lng: -0.0984 }, // St. Paul's
      { lat: 51.5126, lng: -0.0883 }, // Bank
      { lat: 51.5152, lng: -0.0761 }, // Liverpool Street
    ],
  },
  {
    id: 'route-2',
    name: 'River Runner',
    path: [
      { lat: 51.5033, lng: -0.1195 }, // London Eye
      { lat: 51.5055, lng: -0.0754 }, // Tower of London
      { lat: 51.5081, lng: -0.0101 }, // Canary Wharf
      { lat: 51.4994, lng: 0.0054 }, // Greenwich Pier
    ],
  },
  {
    id: 'route-3',
    name: 'North-South Connector',
    path: [
      { lat: 51.5308, lng: -0.1233 }, // King's Cross
      { lat: 51.5195, lng: -0.1270 }, // Russell Square
      { lat: 51.5070, lng: -0.1279 }, // Trafalgar Square
      { lat: 51.4952, lng: -0.1439 }, // Victoria
      { lat: 51.4614, lng: -0.1156 }, // Brixton
    ],
  },
];

export const initialBuses: Bus[] = [
  {
    id: 'bus-001',
    fleetNumber: 'BNGN-728',
    service: '12',
    destination: 'Liverpool Street',
    routeId: 'route-1',
    position: routes[0].path[0],
    progress: 0,
  },
  {
    id: 'bus-002',
    fleetNumber: 'BNGN-551',
    service: '12',
    destination: 'Oxford Circus',
    routeId: 'route-1',
    position: routes[0].path[2],
    progress: 0.5,
  },
  {
    id: 'bus-003',
    fleetNumber: 'BNGN-903',
    service: 'RB1',
    destination: 'Greenwich',
    routeId: 'route-2',
    position: routes[1].path[0],
    progress: 0.1,
  },
  {
    id: 'bus-004',
    fleetNumber: 'BNGN-415',
    service: 'RB1',
    destination: 'London Eye',
    routeId: 'route-2',
    position: routes[1].path[3],
    progress: 0.8,
  },
  {
    id: 'bus-005',
    fleetNumber: 'BNGN-111',
    service: '59',
    destination: 'Brixton',
    routeId: 'route-3',
    position: routes[2].path[1],
    progress: 0.25,
  },
  {
    id: 'bus-006',
    fleetNumber: 'BNGN-234',
    service: '59',
    destination: "King's Cross",
    routeId: 'route-3',
    position: routes[2].path[4],
    progress: 0.9,
  },
];

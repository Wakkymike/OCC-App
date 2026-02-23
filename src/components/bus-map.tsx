
'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Bus, LatLng, MetrolinkData, JourneyPlan, Roadwork, Hazard, MonitoredHazard } from '@/lib/types';
import { useUser, useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

interface BusMapProps {
  buses: Bus[];
  selectedBusId: string | null;
  setSelectedBusId: (id: string | null) => void;
  searchedPlace?: LatLng | null;
  mapView?: {
    center?: LatLng;
    bounds?: mapboxgl.LngLatBounds;
    zoom?: number;
  };
  mapStyle: string;
  show3DBuildings: boolean;
  showBusStops: boolean;
  metrolinkData: MetrolinkData | null;
  routeToDisplay: LatLng[] | null;
  journeyPlan: JourneyPlan | null;
  roadworks: Roadwork[] | null;
  showRoadworks: boolean;
  hazards: Hazard[] | null;
  showHazards: boolean;
}

const firstJourneyRefs = ['1001', '1002', '1301', '1302', '1601', '1602'];
const lastJourneyRefs = ['8001', '8002', '8301', '8302', '8601', '8602'];

export default function BusMap({
  buses,
  selectedBusId,
  setSelectedBusId,
  searchedPlace = null,
  mapView,
  mapStyle,
  show3DBuildings,
  showBusStops,
  metrolinkData,
  routeToDisplay,
  journeyPlan,
  roadworks,
  showRoadworks,
  hazards,
  showHazards,
}: BusMapProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const roadworksMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const hazardsMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const [styleRevision, setStyleRevision] = useState(0);

  const monitoredRef = useMemoFirebase(() => collection(firestore, 'monitoredHazards'), [firestore]);
  const { data: monitoredHazards } = useCollection<MonitoredHazard>(monitoredRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = userProfile?.isAdmin || user?.email === 'michael.dodsworth@gonorthwest.co.uk';

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [-2.24, 53.48],
      zoom: 14,
      pitch: 45,
      bearing: -17.6,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    const handleStyleLoad = () => {
      setStyleRevision(rev => rev + 1);
    };

    map.on('load', handleStyleLoad);
    map.on('style.load', handleStyleLoad);
    map.on('click', () => setSelectedBusId(null));

    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapStyle);
  }, [mapStyle]);

  const handleSetGeofence = (hazard: Hazard, radius: number) => {
    if (!isAdmin) return;
    const docRef = doc(firestore, 'monitoredHazards', hazard.id);
    setDoc(docRef, {
      ...hazard,
      radius,
      createdAt: serverTimestamp()
    }, { merge: true });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    Object.values(hazardsMarkersRef.current).forEach(m => m.remove());
    hazardsMarkersRef.current = {};

    if (hazards && showHazards) {
      hazards.forEach((hazard) => {
        const monitoringInfo = monitoredHazards?.find(m => m.id === hazard.id);
        const isMonitored = !!monitoringInfo;
        const radius = monitoringInfo?.radius || 100;

        const el = document.createElement('div');
        const color = isMonitored ? '#10b981' : (hazard.type === 'height' ? '#e11d48' : hazard.type === 'width' ? '#2563eb' : '#9333ea');
        
        el.innerHTML = `
          <div class="hazard-tag" style="background:${color}; color:white; padding:2px 4px; border-radius:4px; font-size:10px; font-weight:bold; border:1px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3); display: flex; align-items:center; gap: 2px;">
            ${isMonitored ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' : ''}
            ${hazard.value}
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; margin: -2px auto 0;">
            <path d="M12 2L20 20H4L12 2Z" fill="${color}" stroke="white" stroke-width="2"/>
          </svg>
        `.trim();

        const popupContent = document.createElement('div');
        popupContent.className = 'p-3 space-y-3 min-w-[200px]';
        popupContent.innerHTML = `
          <div class="space-y-1">
            <h3 class="font-bold text-sm uppercase text-muted-foreground">${hazard.type} Restriction</h3>
            <p class="text-xl font-black">${hazard.value}</p>
            <p class="text-xs opacity-70">${hazard.description}</p>
          </div>
          <div class="pt-2 border-t geofence-control"></div>
        `;

        if (isAdmin) {
          const control = popupContent.querySelector('.geofence-control');
          if (control) {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = radius.toString();
            input.className = 'w-full mb-2 p-1 text-sm border rounded bg-background';
            
            const btn = document.createElement('button');
            btn.className = `w-full py-2 px-3 text-xs font-bold rounded flex items-center justify-center gap-2 ${isMonitored ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'}`;
            btn.innerHTML = isMonitored ? 'Stop Monitoring' : 'Start Monitoring';
            btn.onclick = () => handleSetGeofence(hazard, parseInt(input.value));
            
            control.appendChild(input);
            control.appendChild(btn);
          }
        }

        try {
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([hazard.location.lng, hazard.location.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent))
            .addTo(map);
            
          hazardsMarkersRef.current[hazard.id] = marker;
        } catch (e) {
          console.error("Failed to add hazard marker", e);
        }
      });
    }
  }, [hazards, showHazards, styleRevision, monitoredHazards, isAdmin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const currentMarkerIds = new Set(Object.keys(markersRef.current));
    buses.forEach((bus) => {
      if (!bus.position) return;
      const markerId = `${bus.fleetNumber}-${bus.service}-${bus.journeyRef || 'no-ref'}`;
      currentMarkerIds.delete(markerId);
      
      let marker = markersRef.current[markerId];
      if (!marker) {
        const el = document.createElement('div');
        el.className = 'bus-marker-container';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => { e.stopPropagation(); setSelectedBusId(markerId); });
        
        const flag = document.createElement('div');
        flag.style.background = 'white';
        flag.style.padding = '2px 6px';
        flag.style.border = '1px solid black';
        flag.style.borderRadius = '4px';
        flag.style.fontSize = '10px';
        flag.style.fontWeight = 'bold';
        flag.style.whiteSpace = 'nowrap';
        el.appendChild(flag);
        
        const arrow = document.createElement('div');
        arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="transition: transform 0.2s linear; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.4));"><rect id="bus-body" x="5" y="2" width="14" height="20" rx="3" fill="#FFC107" stroke="black" stroke-width="1"/><rect x="7" y="4" width="10" height="4" fill="#333"/><rect x="7" y="16" width="10" height="4" fill="#333"/><line x1="5" y1="10" x2="19" y2="10" stroke="black" stroke-width="1"/></svg>`;
        
        if (arrow.firstChild) el.appendChild(arrow.firstChild);
        
        try {
          marker = new mapboxgl.Marker(el).setLngLat([bus.position.lng, bus.position.lat]).addTo(map);
          markersRef.current[markerId] = marker;
        } catch (e) {
          console.error("Failed to add bus marker", e);
          return;
        }
      } else {
        marker.setLngLat([bus.position.lng, bus.position.lat]);
      }
      
      const el = marker.getElement();
      const flag = el.querySelector('div');
      const busBody = el.querySelector('#bus-body');
      
      if (flag) {
        const isFirst = bus.operator === 'GNW' && bus.journeyRef && firstJourneyRefs.includes(bus.journeyRef);
        const isLast = bus.operator === 'GNW' && bus.journeyRef && lastJourneyRefs.includes(bus.journeyRef);
        flag.innerHTML = `${bus.fleetNumber} | ${bus.service} | ${bus.destination}`;
        flag.className = (isFirst || isLast) ? 'blinking-rb' : '';
      }

      const isSelected = markerId === selectedBusId;
      const isGnw = bus.operator === 'GNW';
      const color = isGnw ? '#FFC107' : '#ef4444';
      if (busBody) busBody.setAttribute('fill', isSelected ? '#00FFFF' : color);
      
      const svg = el.querySelector('svg');
      if (svg && bus.bearing !== undefined) svg.style.transform = `rotate(${bus.bearing}deg)`;
    });

    currentMarkerIds.forEach(id => {
      markersRef.current[id].remove();
      delete markersRef.current[id];
    });
  }, [buses, selectedBusId, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    Object.values(roadworksMarkersRef.current).forEach(m => m.remove());
    roadworksMarkersRef.current = {};

    if (roadworks && showRoadworks) {
      roadworks.forEach((rw) => {
        const el = document.createElement('div');
        const color = rw.severity === 'high' ? '#ef4444' : rw.severity === 'moderate' ? '#f59e0b' : '#3b82f6';
        el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="black" stroke-width="1.5"><path d="M12 2L2 22h20L12 2z"/></svg>`;
        
        try {
          const marker = new mapboxgl.Marker(el)
            .setLngLat([rw.location.lng, rw.location.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div class="p-2">
                <p class="font-bold text-sm">${rw.title}</p>
                <p class="text-xs text-muted-foreground mt-1">${rw.description}</p>
              </div>
            `))
            .addTo(map);
          roadworksMarkersRef.current[rw.id] = marker;
        } catch (e) {
          console.error("Failed to add roadwork marker", e);
        }
      });
    }
  }, [roadworks, showRoadworks, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapView) return;

    if (mapView.bounds) {
      map.fitBounds(mapView.bounds, { padding: 50, duration: 1000 });
    } else if (mapView.center) {
      map.flyTo({
        center: [mapView.center.lng, mapView.center.lat],
        zoom: mapView.zoom || map.getZoom(),
        duration: 1000,
      });
    }
  }, [mapView]);

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full bg-muted" />;
}

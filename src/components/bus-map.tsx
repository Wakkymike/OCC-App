
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Bus, LatLng, MetrolinkData, JourneyPlan, Roadwork, Hazard, MonitoredHazard } from '@/lib/types';
import { useUser, useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { Loader2, ShieldAlert, Navigation, Trash2, Plus, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

function createGeoJSONCircle(center: LatLng, radiusInMeters: number) {
  const points = 64;
  const coords = {
    latitude: center.lat,
    longitude: center.lng
  };
  const km = radiusInMeters / 1000;
  const ret = [];
  const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = km / 110.574;

  let theta, x, y;
  for (let i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);
  return [ret];
}

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
  const { toast } = useToast();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const roadworksMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const hazardsMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleRevision, setStyleRevision] = useState(0);
  const [relocatingMonitorId, setRelocatingMonitorId] = useState<string | null>(null);
  const relocatingMonitorIdRef = useRef<string | null>(null);

  const monitoredRef = useMemoFirebase(() => user ? collection(firestore, 'monitoredHazards') : null, [firestore, user]);
  const { data: monitoredHazards } = useCollection<MonitoredHazard>(monitoredRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isAdmin = userProfile?.isAdmin || user?.email === 'michael.dodsworth@gonorthwest.co.uk';

  useEffect(() => {
    relocatingMonitorIdRef.current = relocatingMonitorId;
  }, [relocatingMonitorId]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [-2.24, 53.48],
      zoom: 13,
      pitch: 45,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    const handleLoad = () => {
      setMapLoaded(true);
      setStyleRevision(prev => prev + 1);
    };

    if (map.loaded()) {
      handleLoad();
    } else {
      map.on('load', handleLoad);
    }
    
    map.on('style.load', () => setStyleRevision(prev => prev + 1));
    
    map.on('click', (e) => {
      if (relocatingMonitorIdRef.current) {
        const monitorId = relocatingMonitorIdRef.current;
        const newCenter = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        
        const docRef = doc(firestore, 'monitoredHazards', monitorId);
        updateDoc(docRef, { geofenceCenter: newCenter });
        
        setRelocatingMonitorId(null);
        map.getCanvas().style.cursor = '';
        toast({ title: 'Geofence Updated', description: 'The geofence center has been moved to the selected location.' });
        return;
      }
      setSelectedBusId(null);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [firestore, setSelectedBusId, toast]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const setupLayers = () => {
      if (!map.getSource('geofences')) {
        map.addSource('geofences', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'geofence-fills',
          type: 'fill',
          source: 'geofences',
          layout: {},
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.15
          }
        });

        map.addLayer({
          id: 'geofence-outlines',
          type: 'line',
          source: 'geofences',
          layout: {},
          paint: {
            'line-color': '#10b981',
            'line-width': 2,
            'line-dasharray': [2, 2]
          }
        });
      }
    };

    if (map.isStyleLoaded()) {
      setupLayers();
    } else {
      map.once('style.load', setupLayers);
    }
  }, [mapLoaded, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getSource('geofences')) return;

    const features = monitoredHazards?.map(h => {
        const center = h.geofenceCenter || h.location;
        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: createGeoJSONCircle(center, h.radius)
            },
            properties: { id: h.id }
        };
    }) || [];

    (map.getSource('geofences') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: features as any
    });
  }, [monitoredHazards, mapLoaded]);

  const handleAddGeofence = (hazard: Hazard, radius: number) => {
    if (!isAdmin) return;
    addDoc(collection(firestore, 'monitoredHazards'), {
      hazardId: hazard.id,
      type: hazard.type,
      value: hazard.value,
      location: hazard.location,
      description: hazard.description,
      radius,
      createdAt: serverTimestamp()
    });
    toast({ title: 'Geofence Added', description: `New monitoring zone active for ${hazard.value}.` });
  };

  const handleRemoveGeofence = useCallback((monitorId: string) => {
    if (!isAdmin) return;
    deleteDoc(doc(firestore, 'monitoredHazards', monitorId));
    toast({ title: 'Geofence Removed' });
  }, [isAdmin, firestore, toast]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getCanvasContainer()) return;

    Object.values(hazardsMarkersRef.current).forEach(m => m.remove());
    hazardsMarkersRef.current = {};

    if (hazards && showHazards) {
      hazards.forEach((hazard) => {
        const monitors = monitoredHazards?.filter(m => m.hazardId === hazard.id) || [];
        const isMonitored = monitors.length > 0;

        const el = document.createElement('div');
        el.className = 'hazard-marker cursor-pointer';
        
        let color = '#3b82f6'; // Default Width
        if (hazard.type === 'height') color = '#ef4444'; // Height
        if (hazard.type === 'both') color = '#9333ea'; // Both
        if (isMonitored) color = '#10b981'; // Active Geofence

        el.innerHTML = `
          <div style="background:${color}; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3); display: flex; align-items:center; gap: 4px;">
            ${isMonitored ? `<span style="background:white; color:${color}; padding:0 3px; border-radius:2px;">${monitors.length}</span>` : ''}
            ${hazard.value}
          </div>
          <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid ${color}; margin: -2px auto 0;"></div>
        `;

        const popupContent = document.createElement('div');
        popupContent.className = 'p-3 space-y-3 min-w-[240px] text-foreground max-h-[400px] overflow-y-auto';
        popupContent.innerHTML = `
          <div class="space-y-1">
            <h3 class="font-bold text-[10px] uppercase text-muted-foreground">${hazard.type} Restriction</h3>
            <p class="text-lg font-black">${hazard.value}</p>
            ${hazard.description ? `<p class="text-[10px] opacity-70 italic">${hazard.description}</p>` : ''}
          </div>
          <div class="pt-2 border-t space-y-3 monitors-list"></div>
          <div class="pt-2 border-t add-monitor"></div>
        `;

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([hazard.location.lng, hazard.location.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25, maxWidth: '300px' }).setDOMContent(popupContent))
            .addTo(map);

        // Management UI for Admins only
        if (isAdmin) {
          const listContainer = popupContent.querySelector('.monitors-list');
          if (listContainer) {
            monitors.forEach((m, idx) => {
                const item = document.createElement('div');
                item.className = 'p-2 border rounded bg-secondary/20 space-y-2';
                item.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] font-bold">Monitor #${idx + 1}</span>
                        <span class="text-[10px] opacity-60">${m.radius}m</span>
                    </div>
                `;

                const actions = document.createElement('div');
                actions.className = 'grid grid-cols-2 gap-2';

                const moveBtn = document.createElement('button');
                moveBtn.className = 'py-1 px-2 text-[10px] font-bold rounded bg-secondary hover:bg-secondary/80';
                moveBtn.innerHTML = relocatingMonitorId === m.id ? 'Click Map...' : 'Relocate';
                moveBtn.onclick = (e) => {
                    e.stopPropagation();
                    setRelocatingMonitorId(m.id);
                    marker.getPopup().remove();
                    map.getCanvas().style.cursor = 'crosshair';
                };

                const delBtn = document.createElement('button');
                delBtn.className = 'py-1 px-2 text-[10px] font-bold rounded bg-destructive text-white';
                delBtn.innerHTML = 'Remove';
                delBtn.onclick = () => handleRemoveGeofence(m.id);

                actions.appendChild(moveBtn);
                actions.appendChild(delBtn);
                item.appendChild(actions);
                listContainer.appendChild(item);
            });
          }

          const addContainer = popupContent.querySelector('.add-monitor');
          if (addContainer) {
            const label = document.createElement('label');
            label.className = 'text-[10px] font-bold block mb-1';
            label.innerText = 'Add New Geofence (Radius m):';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.value = '100';
            input.className = 'w-full mb-2 p-1 text-sm border rounded bg-background';
            
            const btn = document.createElement('button');
            btn.className = 'w-full py-2 px-3 text-xs font-bold rounded bg-primary text-primary-foreground';
            btn.innerHTML = 'Add Geofence';
            btn.onclick = () => handleAddGeofence(hazard, parseInt(input.value));
            
            addContainer.appendChild(label);
            addContainer.appendChild(input);
            addContainer.appendChild(btn);
          }
        } else {
            // For non-admins, show that monitoring is active if applicable
            const listContainer = popupContent.querySelector('.monitors-list');
            if (listContainer && isMonitored) {
                listContainer.innerHTML = `
                    <div class="flex items-center gap-2 text-[10px] text-green-600 font-bold bg-green-50 p-2 rounded">
                        <ShieldAlert class="h-3 w-3" /> Monitoring Active (${monitors.length} zones)
                    </div>
                `;
            }
        }
            
        hazardsMarkersRef.current[hazard.id] = marker;
      });
    }
  }, [hazards, showHazards, mapLoaded, styleRevision, monitoredHazards, isAdmin, relocatingMonitorId, toast, handleRemoveGeofence]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getCanvasContainer()) return;

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
        el.addEventListener('click', (e) => { 
          e.stopPropagation(); 
          setSelectedBusId(markerId); 
        });
        
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
          marker = new mapboxgl.Marker({ element: el }).setLngLat([bus.position.lng, bus.position.lat]).addTo(map);
          markersRef.current[markerId] = marker;
        } catch (e) {
          console.error("Failed to add bus marker", e);
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
  }, [buses, selectedBusId, mapLoaded, styleRevision, setSelectedBusId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getCanvasContainer()) return;

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
              <div class="p-2 text-foreground">
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
  }, [roadworks, showRoadworks, mapLoaded, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapView || !mapLoaded) return;

    if (mapView.bounds) {
      map.fitBounds(mapView.bounds, { padding: 50, duration: 1000 });
    } else if (mapView.center) {
      map.flyTo({
        center: [mapView.center.lng, mapView.center.lat],
        zoom: mapView.zoom || map.getZoom(),
        duration: 1000,
      });
    }
  }, [mapView, mapLoaded]);

  return (
    <div className="absolute inset-0 w-full h-full bg-muted overflow-hidden">
      {!mapLoaded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted-foreground">Initializing Map Engine...</p>
        </div>
      )}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

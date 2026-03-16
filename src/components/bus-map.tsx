
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Bus, LatLng, MetrolinkData, JourneyPlan, Roadwork, Hazard, MonitoredHazard, BusStop } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { SOCKET_EVENTS } from '@/lib/socket/events';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  gtfsRouteToDisplay?: LatLng[] | null;
  journeyPlan: JourneyPlan | null;
  roadworks: Roadwork[] | null;
  showRoadworks: boolean;
  hazards: Hazard[] | null;
  showHazards: boolean;
  showGeofences: boolean;
  manualGeofenceMode?: boolean;
  setManualGeofenceMode?: (val: boolean) => void;
}

const firstJourneyRefs = ['1001', '1002', '1301', '1302', '1601', '1602'];
const lastJourneyRefs = ['8001', '8002', '8301', '8302', '8601', '8602'];
const schoolJourneyRefs = ['9001', '9002', '9003', '9004', '9005'];
const nightBusRunningBoards = ['3691', '3692', '3693', '1091', '1092', '1093', '21091', '21092', '21093', '23691', '23692', '23693', '11091', '11092', '11093', '13691', '13692', '13693'];

function createGeoJSONCircle(center: LatLng, radiusInMeters: number) {
  const points = 64;
  const coords = { latitude: center.lat, longitude: center.lng };
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
  gtfsRouteToDisplay,
  journeyPlan,
  roadworks,
  showRoadworks,
  hazards,
  showHazards,
  showGeofences,
  manualGeofenceMode = false,
  setManualGeofenceMode,
}: BusMapProps) {
  const { user } = useAuth();
  const { on, off } = useSocket();
  const { toast } = useToast();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const hazardsMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleRevision, setStyleRevision] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [monitoredHazards, setMonitoredHazards] = useState<MonitoredHazard[]>([]);

  const isAdmin = user?.isAdmin || user?.isSuperAdmin;

  // Fetch monitored hazards via REST + listen for real-time updates
  useEffect(() => {
    if (!user) return;
    fetch('/api/monitored-hazards').then(r => r.json()).then(data => setMonitoredHazards(data.hazards || [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    const handler = () => {
      fetch('/api/monitored-hazards').then(r => r.json()).then(data => setMonitoredHazards(data.hazards || [])).catch(() => {});
    };
    on(SOCKET_EVENTS.HAZARD_CHANGED, handler);
    return () => { off(SOCKET_EVENTS.HAZARD_CHANGED, handler); };
  }, [on, off]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) {
      setConfigError("Mapbox token is missing. Map cannot be initialized.");
      return;
    }

    try {
      mapboxgl.accessToken = token;
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

      map.on('load', () => setMapLoaded(true));
      map.on('style.load', () => setStyleRevision(prev => prev + 1));
      map.on('error', (e) => {
        console.error("Mapbox internal error:", e);
        if (e.error?.message?.includes('Invalid Access Token')) {
          setConfigError("The provided Mapbox Access Token is invalid.");
        }
      });
    } catch (err: any) {
      console.error("Critical error during map initialization:", err);
      setConfigError(err.message || "Failed to initialize Mapbox engine.");
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // GTFS Route Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const updateGtfsLayer = () => {
        if (!map.isStyleLoaded()) return;

        if (!map.getSource('gtfs-route')) {
            map.addSource('gtfs-route', {
                type: 'geojson',
                data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} }
            });
            map.addLayer({
                id: 'gtfs-route-line',
                type: 'line',
                source: 'gtfs-route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ef4444', 'line-width': 5, 'line-opacity': 0.8 }
            });
        }

        const source = map.getSource('gtfs-route') as mapboxgl.GeoJSONSource;
        if (source) {
            const coordinates = gtfsRouteToDisplay ? gtfsRouteToDisplay.map(p => [p.lng, p.lat]) : [];
            source.setData({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coordinates as any },
                properties: {}
            });
        }
    };

    updateGtfsLayer();
  }, [gtfsRouteToDisplay, mapLoaded, styleRevision]);

  // Fetch technical bus stop data from the new live source
  useEffect(() => {
    fetch('/api/bus-stops')
      .then(res => res.json())
      .then(data => {
        if (data.stops) {
          setBusStops(data.stops);
        }
      })
      .catch(err => console.error("Failed to fetch bus stops for map:", err));
  }, []);

  // Technical Stop Layer Management
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const updateStopLayer = () => {
      if (!map.isStyleLoaded()) return;

      if (!map.getSource('technical-bus-stops')) {
        map.addSource('technical-bus-stops', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'technical-bus-stops-layer',
          type: 'circle',
          source: 'technical-bus-stops',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2, 15, 6],
            'circle-color': '#2563eb',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Interactive "Flag" popup for stops showing operational details
        map.on('click', 'technical-bus-stops-layer', (e) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const props = feature.properties;
          
          new mapboxgl.Popup({ 
            className: 'bus-stop-popup',
            closeButton: false,
            offset: 10
          })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="flex flex-col items-center text-center">
                <div class="font-bold text-[13px] leading-tight whitespace-nowrap">${props?.name}</div>
                <div class="text-[10px] opacity-80 font-mono mt-1">${Number(props?.lat).toFixed(5)}, ${Number(props?.lng).toFixed(5)}</div>
                <div class="text-[9px] opacity-60 uppercase font-black tracking-widest mt-0.5">${props?.atcoCode}</div>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'technical-bus-stops-layer', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'technical-bus-stops-layer', () => {
          map.getCanvas().style.cursor = '';
        });
      }

      const source = map.getSource('technical-bus-stops') as mapboxgl.GeoJSONSource;
      if (source) {
        const features = showBusStops ? busStops.map(stop => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
          properties: { ...stop }
        })) : [];
        source.setData({ type: 'FeatureCollection', features: features as any });
      }
    };

    updateStopLayer();
  }, [busStops, showBusStops, mapLoaded, styleRevision]);

  const handleAddManualGeofence = useCallback((lngLat: mapboxgl.LngLat) => {
    if (!isAdmin || !mapRef.current) return;
    
    const popupContent = document.createElement('div');
    popupContent.className = 'p-4 space-y-3 min-w-[260px] text-foreground';
    popupContent.innerHTML = `
        <div class="space-y-1">
            <h3 class="font-bold text-sm uppercase">Add Manual Monitoring Zone</h3>
            <p class="text-[10px] text-muted-foreground italic">Place custom monitoring anywhere for the GNW network.</p>
        </div>
        <div class="space-y-3 pt-2">
            <div>
                <label class="text-[10px] font-bold block mb-1">Category:</label>
                <select class="w-full p-2 text-xs border rounded bg-background manual-category">
                    <option value="Off Route">Off Route</option>
                    <option value="No Bus Access">No Bus Access</option>
                    <option value="Height Limit">Height Limit</option>
                    <option value="Weight Limit">Weight Limit</option>
                    <option value="Width Limit">Width Limit</option>
                </select>
            </div>
            <div>
                <label class="text-[10px] font-bold block mb-1">Description:</label>
                <input type="text" placeholder="e.g. Deansgate Diversion" class="w-full p-2 text-xs border rounded bg-background manual-desc" />
            </div>
            <div>
                <label class="text-[10px] font-bold block mb-1">Radius (meters):</label>
                <input type="number" value="80" class="w-full p-2 text-xs border rounded bg-background manual-radius" />
            </div>
            <button class="w-full py-2 px-3 text-xs font-bold rounded bg-primary text-primary-foreground save-manual-btn">
                Create Geofence
            </button>
        </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 10, closeOnClick: false })
        .setLngLat(lngLat)
        .setDOMContent(popupContent)
        .addTo(mapRef.current);

    const saveBtn = popupContent.querySelector('.save-manual-btn') as HTMLButtonElement;
    saveBtn.onclick = async () => {
        const value = (popupContent.querySelector('.manual-category') as HTMLSelectElement).value;
        const description = (popupContent.querySelector('.manual-desc') as HTMLInputElement).value;
        const radiusInput = popupContent.querySelector('.manual-radius') as HTMLInputElement;
        const radius = parseInt(radiusInput.value) || 80;
        
        if (!description) {
            toast({ variant: 'destructive', title: 'Missing Description' });
            return;
        }

        const manualData = {
            hazardId: 'manual', 
            type: 'manual', 
            value, 
            location: { lat: lngLat.lat, lng: lngLat.lng },
            description, 
            radius, 
        };

        fetch('/api/monitored-hazards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(manualData),
        }).then(() => {
            toast({ title: 'Manual Geofence Added' });
            popup.remove();
            if (setManualGeofenceMode) setManualGeofenceMode(false);
        });
    };
  }, [isAdmin, toast, setManualGeofenceMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (manualGeofenceMode) {
        handleAddManualGeofence(e.lngLat);
      } else {
        setSelectedBusId(null);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [manualGeofenceMode, mapLoaded, setSelectedBusId, handleAddManualGeofence]);

  const handleAddGeofence = (hazard: Hazard, radius: number) => {
    if (!isAdmin) return;
    const geoData = {
      hazardId: hazard.id, type: hazard.type, value: hazard.value, location: hazard.location,
      description: hazard.description, radius,
    };
    fetch('/api/monitored-hazards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geoData),
    }).then(() => {
        toast({ title: 'Geofence Added' });
    });
  };

  const handleRemoveGeofence = (monitorId: string) => {
    if (!isAdmin) return;
    fetch(`/api/monitored-hazards/${monitorId}`, { method: 'DELETE' }).then(() => {
      toast({ title: 'Geofence Removed' });
    });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    Object.values(hazardsMarkersRef.current).forEach(m => m.remove());
    hazardsMarkersRef.current = {};

    if (hazards && showHazards) {
      hazards.forEach((hazard) => {
        const monitors = monitoredHazards?.filter(m => m.hazardId === hazard.id) || [];
        const isMonitored = monitors.length > 0;

        const el = document.createElement('div');
        let color = isMonitored ? '#10b981' : (hazard.type === 'height' ? '#ef4444' : (hazard.type === 'both' ? '#9333ea' : '#3b82f6'));

        el.innerHTML = `
          <div style="background:${color}; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3); display: flex; align-items:center; gap: 4px;">
            ${isMonitored ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' : ''}
            ${hazard.value}
          </div>
          <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid ${color}; margin: -2px auto 0;"></div>
        `;

        const popupContent = document.createElement('div');
        popupContent.className = 'p-3 space-y-3 min-w-[240px] text-foreground';
        popupContent.innerHTML = `
          <div class="space-y-1">
            <h3 class="font-bold text-[10px] uppercase text-muted-foreground">${hazard.type} Restriction</h3>
            <p class="text-lg font-black">${hazard.value}</p>
          </div>
          <div class="pt-2 border-t space-y-2 monitors-list"></div>
          ${isAdmin ? `<div class="pt-2 border-t add-monitor-form"></div>` : ''}
        `;

        const list = popupContent.querySelector('.monitors-list')!;
        monitors.forEach(m => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center gap-2 p-1 border rounded bg-muted/20';
            item.innerHTML = `<span class="text-[10px] font-bold">${m.radius}m Zone</span>`;
            if (isAdmin) {
                const del = document.createElement('button');
                del.className = 'text-[10px] bg-destructive text-white px-2 py-0.5 rounded';
                del.innerText = 'Remove';
                del.onclick = () => handleRemoveGeofence(m.id);
                item.appendChild(del);
            }
            list.appendChild(item);
        });

        if (isAdmin) {
            const form = popupContent.querySelector('.add-monitor-form')!;
            form.innerHTML = `<input type="number" value="80" class="w-full mb-1 p-1 text-xs border rounded bg-background r-input" />`;
            const btn = document.createElement('button');
            btn.className = 'w-full py-1 text-xs font-bold rounded bg-primary text-primary-foreground';
            btn.innerText = 'Add Geofence';
            btn.onclick = () => {
              const radiusInput = form.querySelector('.r-input') as HTMLInputElement;
              handleAddGeofence(hazard, parseInt(radiusInput.value) || 80);
            };
            form.appendChild(btn);
        }

        try {
            const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([hazard.location.lng, hazard.location.lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent))
                .addTo(map);
            hazardsMarkersRef.current[hazard.id] = marker;
        } catch (e) {}
      });
    }

    if (monitoredHazards && showGeofences) {
        monitoredHazards.filter(m => m.type === 'manual').forEach(m => {
            const el = document.createElement('div');
            el.innerHTML = `<div style="background:#f97316; color:white; padding:4px; border-radius:50%; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`;
            try {
                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat([m.location.lng, m.location.lat])
                    .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(`<div class="p-2 text-foreground"><b>${m.value}</b><p class="text-xs">${m.description}</p></div>`))
                    .addTo(map);
                hazardsMarkersRef.current[m.id] = marker;
            } catch (e) {}
        });
    }
  }, [hazards, showHazards, showGeofences, mapLoaded, styleRevision, monitoredHazards, isAdmin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const setupLayer = () => {
      if (!map.isStyleLoaded()) return;

      if (!map.getSource('geofences')) {
        map.addSource('geofences', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'geofence-fill',
          type: 'fill',
          source: 'geofences',
          paint: { 'fill-color': '#10b981', 'fill-opacity': 0.15 }
        });
        map.addLayer({
          id: 'geofence-outline',
          type: 'line',
          source: 'geofences',
          paint: { 'line-color': '#059669', 'line-width': 2, 'line-dasharray': [2, 2] }
        });
      }

      const source = map.getSource('geofences') as mapboxgl.GeoJSONSource;
      if (source) {
        const features = (showGeofences && monitoredHazards) ? monitoredHazards.map(m => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: createGeoJSONCircle(m.geofenceCenter || m.location, m.radius) },
          properties: { id: m.id }
        })) : [];
        source.setData({ type: 'FeatureCollection', features: features as any });
      }
    };

    setupLayer();
  }, [monitoredHazards, showGeofences, mapLoaded, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const currentMarkerIds = new Set(Object.keys(markersRef.current));
    
    buses.forEach((bus) => {
      if (!bus.position) return;
      const markerId = `${bus.operator}-${bus.fleetNumber}`;
      currentMarkerIds.delete(markerId);
      
      let marker = markersRef.current[markerId];
      if (!marker) {
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.style.cursor = 'pointer';
        el.style.pointerEvents = 'auto';
        el.style.zIndex = '10';
        
        el.addEventListener('click', (e) => { 
          e.stopPropagation(); 
          setSelectedBusId(markerId); 
        });
        
        const flag = document.createElement('div');
        flag.className = 'bus-flag';
        el.appendChild(flag);
        
        const iconContainer = document.createElement('div');
        iconContainer.innerHTML = `
          <svg width="32" height="32" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5))">
            <rect class="bus-body-rect" x="4" y="2" width="16" height="20" rx="3" fill="#FFC107" stroke="black" stroke-width="1.5"/>
            <rect x="6" y="4" width="12" height="6" rx="1" fill="#333"/>
            <rect x="6" y="14" width="12" height="1" fill="rgba(255,255,255,0.3)"/>
            <line x1="8" y1="2" x2="8" y2="22" stroke="rgba(0,0,0,0.1)" stroke-width="0.5" />
            <line x1="12" y1="2" x2="12" y2="22" stroke="rgba(0,0,0,0.1)" stroke-width="0.5" />
            <line x1="16" y1="2" x2="16" y2="22" stroke="rgba(0,0,0,0.1)" stroke-width="0.5" />
          </svg>`;
        el.appendChild(iconContainer);
        
        try {
          marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([bus.position.lng, bus.position.lat])
            .addTo(map);
          markersRef.current[markerId] = marker;
        } catch (e) {
          console.error("Failed to add bus marker", e);
        }
      } else {
        marker.setLngLat([bus.position.lng, bus.position.lat]);
      }
      
      const el = marker.getElement();
      const flag = el.querySelector('.bus-flag') as HTMLDivElement;
      const busBody = el.querySelector('.bus-body-rect');
      
      if (flag) {
        const dirLabel = bus.direction?.toLowerCase() === 'inbound' ? '[I]' : '[O]';
        const isFirstLast = bus.operator === 'GNW' && bus.journeyRef && (firstJourneyRefs.includes(bus.journeyRef) || lastJourneyRefs.includes(bus.journeyRef));
        
        const isSchool = bus.operator === 'GNW' && bus.journeyRef && schoolJourneyRefs.includes(bus.journeyRef);
        const isNight = bus.operator === 'GNW' && bus.runningBoard && nightBusRunningBoards.includes(bus.runningBoard);
        
        let labelHtml = `${bus.fleetNumber} | ${bus.service} | ${dirLabel} ${bus.destination} | Board: ${bus.runningBoard}`;
        if (isSchool) labelHtml += ' <span style="color: #ef4444; font-weight: bold;">[SCHOOL]</span>';
        if (isNight) labelHtml += ' <span style="color: #9333ea; font-weight: bold;">[NIGHT]</span>';
        
        flag.innerHTML = labelHtml;
        flag.className = `bus-flag ${isFirstLast ? 'blinking-rb' : ''}`;
      }

      if (busBody) {
        let color = '#ef4444'; // Other operators
        if (bus.operator === 'GNW') color = '#FFC107'; // GNW Yellow
        if (markerId === selectedBusId) color = '#00FFFF'; // Highlight Cyan
        busBody.setAttribute('fill', color);
      }
    });

    currentMarkerIds.forEach(id => {
      if (markersRef.current[id]) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [buses, selectedBusId, mapLoaded, styleRevision, setSelectedBusId]);

  return (
    <div className="absolute inset-0 w-full h-full bg-muted overflow-hidden">
      {configError && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-background/90 text-center p-8">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Map Engine Offline</h2>
          <p className="max-w-md text-muted-foreground font-bold">{configError}</p>
          <p className="mt-4 text-xs opacity-50 italic">Verify your VPS environment variables and rebuild the application.</p>
        </div>
      )}
      
      {!mapLoaded && !configError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted-foreground">Initializing Network Map...</p>
        </div>
      )}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

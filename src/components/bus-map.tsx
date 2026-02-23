'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Bus, LatLng, MetrolinkData, JourneyPlan, Roadwork, Hazard } from '@/lib/types';

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

const schoolJourneyRefs = ['9001', '9002', '9003', '9004', '9005'];
const nightBusRunningBoards = ['3691', '3692', '3693', '1091', '1092', '1093', '21091', '21092', '21093', '23691', '23692', '23693', '11091', '11092', '11093', '13691', '13692', '13693'];
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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const roadworksMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const hazardsMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const placeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const animationFrameRefs = useRef<Record<string, number>>({});
  const [styleRevision, setStyleRevision] = useState(0);
  const currentStyleRef = useRef(mapStyle);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [-2.24, 53.48],
      zoom: 15,
      pitch: 45,
      bearing: -17.6,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl());

    const setupOptionalLayers = (map: mapboxgl.Map) => {
        if (!map.getLayer('3d-buildings')) {
            const layers = map.getStyle().layers;
            const labelLayerId = layers.find(
                (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
            )?.id;
            map.addLayer({
                'id': '3d-buildings',
                'source': 'composite',
                'source-layer': 'building',
                'filter': ['==', 'extrude', 'true'],
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                    'fill-extrusion-color': '#aaa',
                    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
                    'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
                    'fill-extrusion-opacity': 0.6,
                },
                'layout': { 'visibility': 'none' },
            }, labelLayerId);
        }
        if (!map.getLayer('bus-stops')) {
            map.addLayer({
                id: 'bus-stops',
                type: 'circle',
                source: 'composite',
                'source-layer': 'transit_stop_label',
                filter: ['all', ['==', 'subclass', 'bus']],
                minzoom: 14.5,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 14.5, 2, 18, 5],
                    'circle-color': mapStyle.includes('dark') ? '#4dabf7' : '#1971c2',
                    'circle-stroke-color': 'white',
                    'circle-stroke-width': 1.5
                },
                layout: { 'visibility': 'none' },
            });
        }
    };
    
    const handleStyleLoad = () => {
      if (!mapRef.current) return;
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};
      Object.values(roadworksMarkersRef.current).forEach(marker => marker.remove());
      roadworksMarkersRef.current = {};
      Object.values(hazardsMarkersRef.current).forEach(marker => marker.remove());
      hazardsMarkersRef.current = {};
      setupOptionalLayers(mapRef.current);
      setStyleRevision(rev => rev + 1);
    };

    map.on('load', handleStyleLoad);
    map.on('style.load', handleStyleLoad);
    map.on('click', () => setSelectedBusId(null));

    return () => {
      Object.values(animationFrameRefs.current).forEach(cancelAnimationFrame);
      animationFrameRefs.current = {};
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentStyleRef.current === mapStyle) return;
    currentStyleRef.current = mapStyle;
    map.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getLayer('3d-buildings')) return;
    map.setLayoutProperty('3d-buildings', 'visibility', show3DBuildings ? 'visible' : 'none');
  }, [show3DBuildings, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const stopLayerId = 'bus-stops';
    if (!map.getLayer(stopLayerId)) return;
    map.setLayoutProperty(stopLayerId, 'visibility', showBusStops ? 'visible' : 'none');
  }, [showBusStops, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !metrolinkData) return;
    const stopsById = new Map(metrolinkData.stops.map(s => [s.id, [s.lng, s.lat] as [number, number]]));
    const lineFeatures = metrolinkData.lines.map(line => ({
        type: 'Feature' as const,
        geometry: {
            type: 'LineString' as const,
            coordinates: line.path.map(stopId => stopsById.get(stopId)).filter((p): p is [number, number] => !!p)
        },
        properties: { color: line.color, name: line.name }
    }));
    const lineSourceId = 'metrolink-lines';
    const lineSource = map.getSource(lineSourceId) as mapboxgl.GeoJSONSource;
    if (lineSource) lineSource.setData({ type: 'FeatureCollection', features: lineFeatures });
    else map.addSource(lineSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
    const lineLayerId = 'metrolink-lines-layer';
    if (!map.getLayer(lineLayerId)) {
        map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: lineSourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.8 }
        }, 'bus-stops');
    }
  }, [metrolinkData, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const sourceId = 'route-display-source';
    const layerId = 'route-display-layer';
    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
    const lineString: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: routeToDisplay ? routeToDisplay.map(p => [p.lng, p.lat]) : []
        }
    };
    if (source) source.setData(lineString);
    else map.addSource(sourceId, { type: 'geojson', data: lineString });
    if (!map.getLayer(layerId)) {
        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#8a2be2', 'line-width': 5, 'line-opacity': 0.8 }
        }, 'bus-stops');
    }
    map.setLayoutProperty(layerId, 'visibility', routeToDisplay && routeToDisplay.length > 1 ? 'visible' : 'none');
  }, [routeToDisplay, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const animateMarkerPosition = (marker: mapboxgl.Marker, endPosition: LatLng, markerId: string) => {
      if (animationFrameRefs.current[markerId]) cancelAnimationFrame(animationFrameRefs.current[markerId]);
      const startLngLat = marker.getLngLat();
      const startPosition = { lat: startLngLat.lat, lng: startLngLat.lng };
      const animationDuration = 4000;
      const startTime = performance.now();
      if (startPosition.lat === endPosition.lat && startPosition.lng === endPosition.lng) return;
      const frame = () => {
        const now = performance.now();
        const progress = Math.min(1, (now - startTime) / animationDuration);
        const lng = startPosition.lng + (endPosition.lng - startPosition.lng) * progress;
        const lat = startPosition.lat + (endPosition.lat - startPosition.lat) * progress;
        marker.setLngLat([lng, lat]);
        if (progress < 1) animationFrameRefs.current[markerId] = requestAnimationFrame(frame);
        else delete animationFrameRefs.current[markerId];
      };
      animationFrameRefs.current[markerId] = requestAnimationFrame(frame);
    };

    const currentMarkerIds = new Set(Object.keys(markersRef.current));

    buses.forEach((bus) => {
      if (!bus.position) return;
      const markerId = `${bus.fleetNumber}-${bus.runningBoard}-${bus.service}-${bus.direction}-${bus.journeyRef || 'no-ref'}`;
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
        const infoFlag = document.createElement('div');
        infoFlag.className = 'bus-info-flag';
        infoFlag.style.display = 'none';
        infoFlag.style.background = 'white';
        infoFlag.style.padding = '5px 8px';
        infoFlag.style.border = '1px solid black';
        infoFlag.style.borderRadius = '4px';
        infoFlag.style.fontSize = '10px';
        infoFlag.style.whiteSpace = 'nowrap';
        infoFlag.style.marginTop = '2px';
        infoFlag.style.textAlign = 'center';
        el.appendChild(infoFlag);
        const arrowContainer = document.createElement('div');
        arrowContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="transition: transform 0.2s linear; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.4));"><rect id="bus-body" x="5" y="2" width="14" height="20" rx="3" fill="#FFC107" stroke="black" stroke-width="1"/><rect x="7" y="4" width="10" height="4" fill="#333"/><rect x="7" y="16" width="10" height="4" fill="#333"/><line x1="5" y1="10" x2="19" y2="10" stroke="black" stroke-width="1"/></svg>`.trim();
        if (arrowContainer.firstChild) el.appendChild(arrowContainer.firstChild);
        marker = new mapboxgl.Marker(el).setLngLat([bus.position.lng, bus.position.lat]).addTo(map);
        markersRef.current[markerId] = marker;
      } else {
        animateMarkerPosition(marker, bus.position, markerId);
      }
      
      const markerElement = marker.getElement();
      const flagElement = markerElement.querySelector('div') as HTMLDivElement;
      
      const isGnwBus = bus.operator === 'GNW';
      const isSchoolService = isGnwBus && bus.journeyRef ? schoolJourneyRefs.includes(bus.journeyRef) : false;
      const isNightBus = isGnwBus && bus.runningBoard ? nightBusRunningBoards.includes(bus.runningBoard) : false;
      const isFirstJourney = isGnwBus && bus.journeyRef && firstJourneyRefs.includes(bus.journeyRef);
      const isLastJourney = isGnwBus && bus.journeyRef && lastJourneyRefs.includes(bus.journeyRef);

      let runningBoardHtml = bus.runningBoard;
      if (isFirstJourney || isLastJourney) {
        runningBoardHtml = `<span class="blinking-rb">${bus.runningBoard}</span>`;
      }
      
      let indicators = '';
      if (isSchoolService) indicators += ` <span style="color:red;font-weight:bold;">(S)</span>`;
      if (isNightBus) indicators += ` <span style="color:purple;font-weight:bold;">(N)</span>`;

      let directionLabel = '';
      if (bus.direction.toLowerCase() === 'inbound') directionLabel = ` <span style="color:blue;">[I]</span>`;
      else if (bus.direction.toLowerCase() === 'outbound') directionLabel = ` <span style="color:green;">[O]</span>`;
      
      let statusHtml = '';
      if (bus.status && bus.status !== 'Unknown') {
          let color = '#333';
          const lowerCaseStatus = bus.status.toLowerCase();
          if (lowerCaseStatus.includes('late')) color = '#a94442';
          else if (lowerCaseStatus.includes('early')) color = '#31708f';
          else if (lowerCaseStatus.includes('on time')) color = '#3c763d';
          statusHtml = ` | <span style="color:${color}; font-weight: bold;">${bus.status}</span>`;
      }

      let operatorLabel = bus.operator !== 'GNW' ? ` <span style="font-weight:bold; color:#666;">[${bus.operator}]</span>` : '';
      
      flagElement.innerHTML = `${bus.fleetNumber} | RB: ${runningBoardHtml} | ${bus.service}${operatorLabel}${directionLabel}${indicators} | ${bus.destination}${statusHtml}`;
      
      const svg = markerElement.querySelector('svg');
      if (svg && bus.bearing !== undefined) svg.style.transform = `rotate(${bus.bearing}deg)`;
      const isSelected = markerId === selectedBusId;
      const busBody = markerElement.querySelector('#bus-body');
      const infoFlag = markerElement.querySelector('.bus-info-flag') as HTMLDivElement;
      
      const defaultColor = bus.operator === 'GNW' ? '#FFC107' : 
                           bus.operator === 'MET' ? '#60a5fa' : 
                           bus.operator === 'VB' ? '#4ade80' : 
                           bus.operator === 'SC' ? '#ef4444' : 
                           bus.operator === 'FB' ? '#a855f7' : 
                           bus.operator === 'DB' ? '#f97316' : '#ef4444'; 
          
      if (busBody) busBody.setAttribute('fill', isSelected ? '#00FFFF' : defaultColor);

      if (infoFlag) {
        if (isSelected) {
          let detailedRB = bus.runningBoard;
          if (isFirstJourney || isLastJourney) detailedRB = `<span class="blinking-rb">${detailedRB}</span>`;
          infoFlag.innerHTML = `
            ${isSchoolService ? '<div style="color:red; font-weight:bold;">[SCHOOL SERVICE]</div>' : ''}
            ${isNightBus ? '<div style="color:purple; font-weight:bold;">[NIGHT BUS]</div>' : ''}
            <div><span style="font-weight:bold;">Journey:</span> ${bus.journeyRef || 'N/A'}</div>
            <div><span style="font-weight:bold;">Running Board:</span> ${detailedRB}</div>
          `;
          infoFlag.style.display = 'block';
        } else {
          infoFlag.style.display = 'none';
        }
      }
    });

    currentMarkerIds.forEach((id) => {
      if (markersRef.current[id]) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [buses, selectedBusId, setSelectedBusId, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (placeMarkerRef.current) {
      placeMarkerRef.current.remove();
      placeMarkerRef.current = null;
    }
    if (searchedPlace) {
      const el = document.createElement('div');
      el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 10.5C21 17.5 12 23 12 23C12 23 3 17.5 3 10.5C3 6.35786 7.02944 3 12 3C16.9706 3 21 6.35786 21 10.5Z" fill="#FF4136" stroke="white" stroke-width="1.5"/><circle cx="12" cy="10.5" r="3" fill="white"/></svg>`.trim();
      placeMarkerRef.current = new mapboxgl.Marker(el).setLngLat(searchedPlace).addTo(map);
      map.flyTo({ center: searchedPlace, zoom: 14, essential: true });
    } else if (mapView) {
      if (mapView.bounds) map.fitBounds(mapView.bounds, { padding: 100, maxZoom: 15 });
      else if (mapView.center) map.flyTo({ center: mapView.center, zoom: mapView.zoom || 16, essential: true });
    }
  }, [searchedPlace, mapView, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    Object.values(roadworksMarkersRef.current).forEach(m => m.remove());
    roadworksMarkersRef.current = {};
    if (roadworks && showRoadworks) {
      roadworks.forEach((work) => {
        const color = work.severity === 'high' ? '#ef4444' : work.severity === 'moderate' ? '#f97316' : '#22c55e';
        const el = document.createElement('div');
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2L2 22h20L12 2z" /></svg>`;
        const marker = new mapboxgl.Marker(el).setLngLat([work.location.lng, work.location.lat]).setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<b>${work.title}</b><br/>${work.description}`)).addTo(map);
        roadworksMarkersRef.current[work.id] = marker;
      });
    }
  }, [roadworks, showRoadworks, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    Object.values(hazardsMarkersRef.current).forEach(m => m.remove());
    hazardsMarkersRef.current = {};
    if (hazards && showHazards) {
      hazards.forEach((hazard) => {
        const el = document.createElement('div');
        const color = hazard.type === 'height' ? '#e11d48' : hazard.type === 'width' ? '#2563eb' : '#9333ea';
        el.innerHTML = `
          <div style="background:${color}; color:white; padding:2px 4px; border-radius:4px; font-size:10px; font-weight:bold; border:1px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
            ${hazard.value}
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; margin: -2px auto 0;">
            <path d="M12 2L20 20H4L12 2Z" fill="${color}" stroke="white" stroke-width="2"/>
          </svg>
        `.trim();
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([hazard.location.lng, hazard.location.lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding:4px; color:#333;">
              <div style="font-weight:bold; margin-bottom:4px;">${hazard.type.toUpperCase()} RESTRICTION</div>
              <div style="font-size:14px; font-weight:bold; color:${color};">${hazard.value}</div>
              <div style="font-size:11px; margin-top:4px;">${hazard.description}</div>
            </div>
          `))
          .addTo(map);
        hazardsMarkersRef.current[hazard.id] = marker;
      });
    }
  }, [hazards, showHazards, styleRevision]);

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />;
}

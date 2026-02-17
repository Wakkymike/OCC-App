'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Bus, LatLng, MetrolinkData, JourneyPlan } from '@/lib/types';

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
}: BusMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const placeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const journeyStartMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const journeyEndMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const animationFrameRefs = useRef<Record<string, number>>({});
  const [styleRevision, setStyleRevision] = useState(0);
  const currentStyleRef = useRef(mapStyle);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) {
      console.error('Mapbox access token is not set. The map cannot be initialized.');
      return;
    }

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
        // 3D Buildings
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
        // Traffic
        if (!map.getSource('mapbox-traffic')) {
            map.addSource('mapbox-traffic', { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' });
        }
        if (!map.getLayer('traffic-layer')) {
            map.addLayer({
                id: 'traffic-layer',
                type: 'line',
                source: 'mapbox-traffic',
                'source-layer': 'traffic',
                paint: {
                    'line-width': 2,
                    'line-color': ['case',
                        ['boolean', ['feature-state', 'hover'], false], '#ff0000',
                        ['match', ['get', 'congestion'],
                            'low', '#55c57a',
                            'moderate', '#f2d40d',
                            'heavy', '#ff9900',
                            'severe', '#ff4d4d',
                            '#000000'
                        ]
                    ],
                },
                layout: { 'visibility': 'visible' },
            });
        }
        // Bus Stops
        if (!map.getLayer('bus-stops')) {
            map.addLayer({
                id: 'bus-stops',
                type: 'circle',
                source: 'composite',
                'source-layer': 'transit_stop_label',
                filter: ['all', ['==', 'subclass', 'bus']],
                minzoom: 14.5,
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        14.5, 2,
                        18, 5
                    ],
                    'circle-color': mapStyle.includes('dark') ? '#4dabf7' : '#1971c2',
                    'circle-stroke-color': 'white',
                    'circle-stroke-width': 1.5
                },
                layout: {
                    'visibility': 'none',
                },
            });
        }
    };
    
    const handleStyleLoad = () => {
      if (!mapRef.current) return;
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};
      setupOptionalLayers(mapRef.current);
      setStyleRevision(rev => rev + 1);
    };

    map.on('load', handleStyleLoad);
    map.on('style.load', handleStyleLoad);

    map.on('error', (e) => console.error('A Mapbox error occurred:', e.error));
    map.on('click', () => setSelectedBusId(null));

    return () => {
      Object.values(animationFrameRefs.current).forEach(cancelAnimationFrame);
      animationFrameRefs.current = {};
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'bus-stop-popup'
    });

    const handleStopClick = (e: mapboxgl.MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        if (feature.geometry.type === 'Point' && feature.properties?.name) {
             const coordinates = feature.geometry.coordinates.slice();
             const stopName = feature.properties.name;
             while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }
            popup.setLngLat(coordinates as [number, number]).setHTML(stopName).addTo(map);
        }
    };

    const handleMouseEnter = (e: mapboxgl.MapLayerMouseEvent) => {
        if (e.features?.length) map.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    };

    if (showBusStops) {
        map.on('click', stopLayerId, handleStopClick);
        map.on('mouseenter', stopLayerId, handleMouseEnter);
        map.on('mouseleave', stopLayerId, handleMouseLeave);
    }

    return () => {
        if (map.isStyleLoaded()) {
            map.off('click', stopLayerId, handleStopClick);
            map.off('mouseenter', stopLayerId, handleMouseEnter);
            map.off('mouseleave', stopLayerId, handleMouseLeave);
        }
        if (popup.isOpen()) popup.remove();
    }
  }, [showBusStops, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !metrolinkData || (!metrolinkData.stops.length && !metrolinkData.lines.length)) return;

    const stopsById = new Map(metrolinkData.stops.map(s => [s.id, [s.lng, s.lat] as [number, number]]));

    const lineFeatures = metrolinkData.lines.map(line => ({
        type: 'Feature' as const,
        geometry: {
            type: 'LineString' as const,
            coordinates: line.path.map(stopId => stopsById.get(stopId)).filter((p): p is [number, number] => !!p)
        },
        properties: {
            color: line.color,
            name: line.name
        }
    }));
    
    const lineSourceId = 'metrolink-lines';
    const lineSource = map.getSource(lineSourceId) as mapboxgl.GeoJSONSource;
    if (lineSource) {
        lineSource.setData({ type: 'FeatureCollection', features: lineFeatures });
    } else {
        map.addSource(lineSourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: lineFeatures }
        });
    }

    const lineLayerId = 'metrolink-lines-layer';
    if (!map.getLayer(lineLayerId)) {
        const beforeId = map.getLayer('route-display-layer') ? 'route-display-layer' : 'bus-stops';
        map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: lineSourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.8 }
        }, beforeId);
    }
    
    const stopFeatures = metrolinkData.stops.map(stop => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [stop.lng, stop.lat] },
        properties: { name: stop.name, lines: stop.lines.join(', ') }
    }));
    
    const stopSourceId = 'metrolink-stops';
    const stopSource = map.getSource(stopSourceId) as mapboxgl.GeoJSONSource;
    if (stopSource) {
        stopSource.setData({ type: 'FeatureCollection', features: stopFeatures });
    } else {
        map.addSource(stopSourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: stopFeatures }
        });
    }

    const stopLayerId = 'metrolink-stops-layer';
    if (!map.getLayer(stopLayerId)) {
        map.addLayer({
            id: stopLayerId,
            type: 'circle',
            source: stopSourceId,
            paint: {
                'circle-radius': 6,
                'circle-color': '#ffffff',
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 2.5
            }
        });
    }
    
    const tramPopup = new mapboxgl.Popup({
      className: 'bus-stop-popup', // reuse style
      closeButton: false,
      closeOnClick: false,
    });
    
    const onTramStopEnter = (e: mapboxgl.MapLayerMouseEvent) => {
      if (!e.features?.length) return;
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      if (feature.geometry.type === 'Point' && feature.properties) {
        const coords = feature.geometry.coordinates.slice() as [number, number];
        const { name, lines } = feature.properties;
        const description = `<div class="font-bold">${name}</div><div>Lines: ${lines}</div>`;

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }
        tramPopup.setLngLat(coords).setHTML(description).addTo(map);
      }
    };
    
    const onTramStopLeave = () => {
      map.getCanvas().style.cursor = '';
      tramPopup.remove();
    };

    map.on('mouseenter', stopLayerId, onTramStopEnter);
    map.on('mouseleave', stopLayerId, onTramStopLeave);
    
    return () => {
      if (map.isStyleLoaded()) {
        map.off('mouseenter', stopLayerId, onTramStopEnter);
        map.off('mouseleave', stopLayerId, onTramStopLeave);
      }
      if (tramPopup.isOpen()) tramPopup.remove();
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
    
    if (source) {
        source.setData(lineString);
    } else {
        map.addSource(sourceId, {
            type: 'geojson',
            data: lineString
        });
    }

    if (!map.getLayer(layerId)) {
        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#8a2be2', // A distinct color like blue-violet
                'line-width': 5,
                'line-opacity': 0.8
            }
        }, 'bus-stops');
    }
    
    map.setLayoutProperty(layerId, 'visibility', routeToDisplay && routeToDisplay.length > 1 ? 'visible' : 'none');

  }, [routeToDisplay, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    const sourceId = 'journey-plan-source';
    const layerId = 'journey-plan-layer';

    // Clear old markers
    if (journeyStartMarkerRef.current) journeyStartMarkerRef.current.remove();
    if (journeyEndMarkerRef.current) journeyEndMarkerRef.current.remove();
    journeyStartMarkerRef.current = null;
    journeyEndMarkerRef.current = null;

    const lineString: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: journeyPlan ? journeyPlan.path.map(p => [p.lng, p.lat]) : []
        }
    };
    
    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
    if (source) {
        source.setData(lineString);
    } else {
        map.addSource(sourceId, {
            type: 'geojson',
            data: lineString
        });
    }

    if (!map.getLayer(layerId)) {
        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#0891b2', // A nice cyan color
                'line-width': 8,
                'line-opacity': 0.75,
                'line-dasharray': [0, 2],
            }
        }, 'route-display-layer'); // Draw below recorded routes, but above metrolink
    }
    
    map.setLayoutProperty(layerId, 'visibility', journeyPlan && journeyPlan.path.length > 1 ? 'visible' : 'none');

    // Add markers for start and end
    if (journeyPlan) {
        const startEl = document.createElement('div');
        startEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;
        journeyStartMarkerRef.current = new mapboxgl.Marker(startEl)
            .setLngLat(journeyPlan.startStop)
            .setPopup(new mapboxgl.Popup({ offset: 25, className: 'bus-stop-popup' }).setHTML(`<b>Get on:</b> Service ${journeyPlan.service}<br/>To: ${journeyPlan.destination}`))
            .addTo(map);

        const endEl = document.createElement('div');
        endEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="1.5"><path d="M21 10.5C21 17.5 12 23 12 23C12 23 3 17.5 3 10.5C3 6.35786 7.02944 3 12 3C16.9706 3 21 6.35786 21 10.5Z"/><circle cx="12" cy="10.5" r="3" fill="white"/></svg>`;
        journeyEndMarkerRef.current = new mapboxgl.Marker(endEl)
            .setLngLat(journeyPlan.endStop)
            .setPopup(new mapboxgl.Popup({ offset: 25, className: 'bus-stop-popup' }).setHTML(`<b>Get off here</b>`))
            .addTo(map);
    }

  }, [journeyPlan, styleRevision]);

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
      const isFirstJourney = isGnwBus && bus.journeyRef ? firstJourneyRefs.includes(bus.journeyRef) : false;
      const isLastJourney = isGnwBus && bus.journeyRef ? lastJourneyRefs.includes(bus.journeyRef) : false;

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
      let color = '#333';
      const lowerCaseStatus = bus.status.toLowerCase();

      if (bus.status && bus.status !== 'Unknown') {
          if (lowerCaseStatus.includes('late')) {
              color = '#a94442'; // red
          } else if (lowerCaseStatus.includes('early')) {
              color = '#31708f'; // blue
          } else if (lowerCaseStatus.includes('on time')) {
              color = '#3c763d'; // green
          } else if (lowerCaseStatus.includes('cancelled')) {
              color = '#a94442'; // red
          }
          statusHtml = ` | <span style="color:${color}; font-weight: bold;">${bus.status}</span>`;
      }

      let operatorLabel = '';
      if (bus.operator === 'MET') {
        operatorLabel = ` <span style="color:#2563eb;font-weight:bold;">[MET]</span>`;
      } else if (bus.operator === 'VB') {
        operatorLabel = ` <span style="color:#16a34a;font-weight:bold;">[VB]</span>`;
      }
      
      flagElement.innerHTML = `${bus.fleetNumber} | RB: ${runningBoardHtml} | ${bus.service}${operatorLabel}${directionLabel}${indicators} | ${bus.destination}${statusHtml}`;
      
      const svg = markerElement.querySelector('svg');
      if (svg && bus.bearing !== undefined) svg.style.transform = `rotate(${bus.bearing}deg)`;
      const isSelected = markerId === selectedBusId;
      const busBody = markerElement.querySelector('#bus-body');
      const infoFlag = markerElement.querySelector('.bus-info-flag') as HTMLDivElement;
      
      const defaultColor = bus.operator === 'GNW'
          ? '#FFC107' // Yellow for GNW
          : bus.operator === 'MET'
          ? '#60a5fa' // Blue for Metroline
          : '#4ade80'; // Green for VisionBus
          
      if (busBody) {
          busBody.setAttribute('fill', isSelected ? '#00FFFF' : defaultColor);
      }

      if (infoFlag) {
        if (isSelected) {
          let detailedRunningBoardHtml = `RB: ${bus.runningBoard}`;
          if (isFirstJourney || isLastJourney) {
            detailedRunningBoardHtml = `<span class="blinking-rb">${detailedRunningBoardHtml}</span>`;
          }
          
          const schoolInfo = isSchoolService ? `<div style="color:red; font-weight:bold; margin-bottom: 4px;">[SCHOOL SERVICE]</div>` : '';
          const nightBusInfo = isNightBus ? `<div style="color:red; font-weight:bold; margin-bottom: 4px;">[NIGHT BUS]</div>` : '';
          const journeyInfo = bus.journeyRef ? `<div><div style="font-weight: bold; color: green;">Journey Number</div><div>${bus.journeyRef}</div></div>` : '';
          const runningBoardInfo = bus.runningBoard ? `<div style="margin-top: 4px;"><div style="font-weight: bold;">Running Board</div><div>${detailedRunningBoardHtml}</div></div>` : '';
          
          let statusDisplay = '';
          if (bus.status && bus.status !== 'Unknown') {
              statusDisplay = `<div style="color:${color}; font-weight: bold; margin-bottom: 4px;">${bus.status}</div>`;
          }

          infoFlag.innerHTML = `${statusDisplay}${schoolInfo}${nightBusInfo}${journeyInfo}${runningBoardInfo}`;
          infoFlag.style.display = 'block';
        } else {
          infoFlag.style.display = 'none';
        }
      }
    });

    currentMarkerIds.forEach((id) => {
      if (markersRef.current[id]) {
        if (animationFrameRefs.current[id]) {
          cancelAnimationFrame(animationFrameRefs.current[id]);
          delete animationFrameRefs.current[id];
        }
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
      if (id === selectedBusId) setSelectedBusId(null);
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
      const marker = new mapboxgl.Marker(el).setLngLat(searchedPlace).addTo(map);
      placeMarkerRef.current = marker;
      map.flyTo({ center: searchedPlace, zoom: 14, essential: true });
    } else if (mapView) {
      if (mapView.bounds) {
        map.fitBounds(mapView.bounds, { padding: 100, maxZoom: 15 });
      } else if (mapView.center) {
        map.flyTo({ center: mapView.center, zoom: mapView.zoom || 16, essential: true });
      }
    }
  }, [searchedPlace, mapView, styleRevision]);

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />;
}

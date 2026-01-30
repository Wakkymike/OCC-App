'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Bus, LatLng } from '@/lib/types';

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
}: BusMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const placeMarkerRef = useRef<mapboxgl.Marker | null>(null);
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
      
      const isSchoolService = bus.journeyRef ? schoolJourneyRefs.includes(bus.journeyRef) : false;
      const isNightBus = bus.runningBoard ? nightBusRunningBoards.includes(bus.runningBoard) : false;

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
      let directionLabel = '';
      if (bus.direction.toLowerCase() === 'inbound') directionLabel = ` <span style="color:blue">[I]</span>`;
      else if (bus.direction.toLowerCase() === 'outbound') directionLabel = ` <span style="color:blue">[O]</span>`;
      
      const schoolLabel = isSchoolService ? ` <span style="color:red">[SCH]</span>` : '';
      const nightBusLabel = isNightBus ? ` <span style="color:red">[NIGHT BUS]</span>` : '';
      
      const isFirstJourney = bus.journeyRef ? firstJourneyRefs.includes(bus.journeyRef) : false;
      const isLastJourney = bus.journeyRef ? lastJourneyRefs.includes(bus.journeyRef) : false;
      let runningBoardHtml = `RB: ${bus.runningBoard}`;
      if (isFirstJourney || isLastJourney) {
        runningBoardHtml = `<span class="blinking-rb">${runningBoardHtml}</span>`;
      }
      
      flagElement.innerHTML = `${bus.fleetNumber} | ${bus.service}${directionLabel}${schoolLabel}${nightBusLabel} | ${bus.destination} | ${runningBoardHtml}`;
      
      const svg = markerElement.querySelector('svg');
      if (svg && bus.bearing !== undefined) svg.style.transform = `rotate(${bus.bearing}deg)`;
      const isSelected = markerId === selectedBusId;
      const busBody = markerElement.querySelector('#bus-body');
      const infoFlag = markerElement.querySelector('.bus-info-flag') as HTMLDivElement;
      if (busBody && infoFlag) {
        busBody.setAttribute('fill', isSelected ? '#00FFFF' : '#FFC107');
        if (isSelected) {
          const schoolInfo = isSchoolService ? `<div style="color:red; font-weight:bold; margin-bottom: 4px;">[SCHOOL SERVICE]</div>` : '';
          const nightBusInfo = isNightBus ? `<div style="color:red; font-weight:bold; margin-bottom: 4px;">[NIGHT BUS]</div>` : '';
          
          const journeyInfo = bus.journeyRef ? `<div><div style="font-weight: bold; color: green;">Journey Number</div><div>${bus.journeyRef}</div></div>` : '';

          const statusDisplay = bus.status && bus.status !== 'Unknown' ? `<div style="margin-top: 4px;">${bus.status}</div>` : '';

          infoFlag.innerHTML = `${schoolInfo}${nightBusInfo}${journeyInfo}${statusDisplay}`;
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

"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { initialBuses, routes } from '@/lib/bus-data';
import type { Bus, LatLng } from '@/lib/types';

const SIMULATION_SPEED = 0.00005; // Adjust to control bus speed

function interpolate(p1: LatLng, p2: LatLng, t: number): LatLng {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * t,
    lng: p1.lng + (p2.lng - p1.lng) * t,
  };
}

export const useBusTracker = () => {
  const [buses, setBuses] = useState<Bus[]>(initialBuses);
  const animationFrameId = useRef<number>();

  const moveBuses = useCallback(() => {
    setBuses(currentBuses => 
      currentBuses.map(bus => {
        let newProgress = bus.progress + SIMULATION_SPEED;
        if (newProgress >= 1) {
          newProgress = 0;
        }

        const route = routes.find(r => r.id === bus.routeId);
        if (!route || route.path.length < 2) return bus;

        const totalSegments = route.path.length - 1;
        const progressPerSegment = 1 / totalSegments;
        
        const currentSegmentIndex = Math.min(Math.floor(newProgress / progressPerSegment), totalSegments - 1);
        const progressInSegment = (newProgress - (currentSegmentIndex * progressPerSegment)) / progressPerSegment;

        const p1 = route.path[currentSegmentIndex];
        const p2 = route.path[currentSegmentIndex + 1];

        const newPosition = interpolate(p1, p2, progressInSegment);

        return { ...bus, progress: newProgress, position: newPosition };
      })
    );

    animationFrameId.current = requestAnimationFrame(moveBuses);
  }, []);

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(moveBuses);
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [moveBuses]);

  return buses;
};

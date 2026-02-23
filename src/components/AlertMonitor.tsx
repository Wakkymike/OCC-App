'use client';

import { useEffect, useRef } from 'react';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import type { MonitoredHazard } from '@/lib/types';

// Haversine formula to calculate distance in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function AlertMonitor() {
  const { user } = useUser();
  const { buses } = useBusTracker();
  const firestore = useFirestore();
  
  // Only create the collection reference if the user is signed in to avoid permission errors
  const hazardsRef = useMemoFirebase(() => user ? collection(firestore, 'monitoredHazards') : null, [firestore, user]);
  const { data: monitoredHazards } = useCollection<MonitoredHazard>(hazardsRef);
  
  const lastCheckRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user || !monitoredHazards || !buses || buses.length === 0) return;

    const gnwBuses = buses.filter(b => b.operator === 'GNW' && b.position);
    
    gnwBuses.forEach(async (bus) => {
      const busId = `${bus.fleetNumber}-${bus.service}`;
      
      for (const hazard of monitoredHazards) {
        const distance = getDistanceInMeters(
          bus.position!.lat,
          bus.position!.lng,
          hazard.location.lat,
          hazard.location.lng
        );

        if (distance <= hazard.radius) {
          const alertKey = `${busId}-${hazard.id}`;
          const now = Date.now();
          
          if (!lastCheckRef.current[alertKey] || now - lastCheckRef.current[alertKey] > 300000) {
            lastCheckRef.current[alertKey] = now;
            
            const alertsRef = collection(firestore, 'activeAlerts');
            const q = query(alertsRef, where("busId", "==", busId), where("hazardId", "==", hazard.id));
            const existing = await getDocs(q);
            
            if (existing.empty) {
              addDoc(alertsRef, {
                busId,
                fleetNumber: bus.fleetNumber,
                service: bus.service,
                hazardId: hazard.id,
                hazardValue: hazard.value,
                hazardDescription: hazard.description,
                timestamp: serverTimestamp(),
              });
            }
          }
        }
      }
    });
  }, [buses, monitoredHazards, firestore, user]);

  return null;
}
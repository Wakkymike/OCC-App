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
  
  // Fetch all active geofence monitors
  const hazardsRef = useMemoFirebase(() => user ? collection(firestore, 'monitoredHazards') : null, [firestore, user]);
  const { data: monitoredHazards } = useCollection<MonitoredHazard>(hazardsRef);
  
  // Local cache to throttle repeated alerts for the same bus/monitor pair (5 minute cooldown)
  const lastAlertTimeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user || !monitoredHazards || !buses || buses.length === 0) return;

    // We only monitor Go North West vehicles for road restriction breaches
    const gnwBuses = buses.filter(b => b.operator === 'GNW' && b.position);
    
    gnwBuses.forEach(async (bus) => {
      const busId = `${bus.fleetNumber}-${bus.service}`;
      
      for (const monitor of monitoredHazards) {
        // A monitor might be relocated, so we respect the custom center if set
        const center = monitor.geofenceCenter || monitor.location;
        const distance = getDistanceInMeters(
          bus.position!.lat,
          bus.position!.lng,
          center.lat,
          center.lng
        );

        // If the bus is within the defined radius of this specific monitor
        if (distance <= monitor.radius) {
          const alertKey = `${busId}-${monitor.id}`;
          const now = Date.now();
          
          // Throttling: only check the DB if we haven't alerted for this pair in the last 5 minutes
          if (!lastAlertTimeRef.current[alertKey] || now - lastAlertTimeRef.current[alertKey] > 300000) {
            lastAlertTimeRef.current[alertKey] = now;
            
            const alertsRef = collection(firestore, 'activeAlerts');
            
            // Check if there is an existing UNRESOLVED alert for this specific bus and monitor
            const q = query(
              alertsRef, 
              where("busId", "==", busId), 
              where("monitorId", "==", monitor.id)
            );
            
            const existing = await getDocs(q);
            
            if (existing.empty) {
              // Create a new active alert record
              addDoc(alertsRef, {
                busId,
                fleetNumber: bus.fleetNumber,
                service: bus.service,
                hazardId: monitor.hazardId, // Reference to original OSM hazard
                monitorId: monitor.id,      // Reference to this specific geofence document
                hazardValue: monitor.value,
                hazardDescription: monitor.description,
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

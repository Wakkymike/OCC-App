
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
  
  // Fetch all active geofence monitors - accessible to all logged in users
  const hazardsRef = useMemoFirebase(() => user ? collection(firestore, 'monitoredHazards') : null, [firestore, user]);
  const { data: monitoredHazards } = useCollection<MonitoredHazard>(hazardsRef);
  
  // We use a ref to track which bus-monitor pairs we are currently processing 
  // to avoid race conditions or double-triggering within the same polling cycle.
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // The monitoring happens on the client of every logged-in staff member.
    if (!user || !monitoredHazards || !buses || buses.length === 0) return;

    // We only monitor Go North West vehicles for road restriction breaches
    const gnwBuses = buses.filter(b => b.operator === 'GNW' && b.position);
    
    gnwBuses.forEach(async (bus) => {
      // Use fleet number as the primary unique identifier for the vehicle
      const busId = `${bus.fleetNumber}-${bus.service}`;
      
      for (const monitor of monitoredHazards) {
        const center = monitor.geofenceCenter || monitor.location;
        const distance = getDistanceInMeters(
          bus.position!.lat,
          bus.position!.lng,
          center.lat,
          center.lng
        );

        // If the bus is within the radius of this monitor
        if (distance <= monitor.radius) {
          const alertKey = `${busId}-${monitor.id}`;
          
          // If we're already checking or creating this specific alert, skip
          if (processingRef.current.has(alertKey)) continue;
          
          processingRef.current.add(alertKey);
          
          try {
            const alertsRef = collection(firestore, 'activeAlerts');
            const historyRef = collection(firestore, 'alertHistory');
            
            // Check if there is currently an alert for this specific bus and monitor
            const q = query(
              alertsRef, 
              where("busId", "==", busId), 
              where("monitorId", "==", monitor.id)
            );
            
            const existing = await getDocs(q);
            
            // If no active alert exists, create one
            if (existing.empty) {
              const alertData = {
                busId,
                fleetNumber: bus.fleetNumber,
                service: bus.service,
                hazardId: monitor.hazardId, 
                monitorId: monitor.id,      
                hazardValue: monitor.value,
                hazardDescription: monitor.description,
                isAcknowledged: false, // Alerts start as unacknowledged
                timestamp: serverTimestamp(),
              };

              // Create ephemeral alert for real-time display
              addDoc(alertsRef, alertData);

              // Create persistent log for historical auditing
              addDoc(historyRef, alertData);
            }
          } catch (error) {
            console.error("Alert generation failed:", error);
          } finally {
            // Remove from processing set after async operations complete
            processingRef.current.delete(alertKey);
          }
        }
      }
    });
  }, [buses, monitoredHazards, firestore, user]);

  return null;
}


'use client';

import { useEffect, useRef } from 'react';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import type { MonitoredHazard, ActiveAlert } from '@/lib/types';

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
  
  // 1. Fetch all active geofence monitors
  const hazardsRef = useMemoFirebase(() => user ? collection(firestore, 'monitoredHazards') : null, [firestore, user]);
  const { data: monitoredHazards } = useCollection<MonitoredHazard>(hazardsRef);
  
  // 2. Fetch current active alerts to check for duplicates locally
  const activeAlertsRef = useMemoFirebase(() => user ? collection(firestore, 'activeAlerts') : null, [firestore, user]);
  const { data: activeAlerts } = useCollection<ActiveAlert>(activeAlertsRef);

  // Use a ref to prevent overlapping write operations
  const isWritingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // We need the user, monitors, buses, and current alerts to make a decision
    if (!user || !monitoredHazards || !buses || !activeAlerts || buses.length === 0) return;

    // Filter for GNW buses with valid positions
    const gnwBuses = buses.filter(b => b.operator === 'GNW' && b.position);
    
    gnwBuses.forEach((bus) => {
      const busId = `${bus.fleetNumber}-${bus.service}`;
      
      for (const monitor of monitoredHazards) {
        const center = monitor.geofenceCenter || monitor.location;
        const distance = getDistanceInMeters(
          bus.position!.lat,
          bus.position!.lng,
          center.lat,
          center.lng
        );

        // If the bus is within the radius
        if (distance <= monitor.radius) {
          const alertKey = `${busId}-${monitor.id}`;
          
          // Check if we are already in the process of creating this alert
          if (isWritingRef.current.has(alertKey)) continue;

          // Check if an alert already exists in our local (synced) list
          const existingAlert = activeAlerts.find(a => a.busId === busId && a.monitorId === monitor.id);
          
          // If no active alert exists, create one
          if (!existingAlert) {
            isWritingRef.current.add(alertKey);
            
            const alertData = {
              busId,
              fleetNumber: bus.fleetNumber,
              service: bus.service,
              hazardId: monitor.hazardId, 
              monitorId: monitor.id,      
              hazardValue: monitor.value,
              hazardDescription: monitor.description,
              isAcknowledged: false,
              timestamp: serverTimestamp(),
            };

            // Write both ephemeral and persistent records
            const alertsRef = collection(firestore, 'activeAlerts');
            const historyRef = collection(firestore, 'alertHistory');

            Promise.all([
                addDoc(alertsRef, alertData),
                addDoc(historyRef, alertData)
            ]).catch(err => {
                console.error("Failed to create alert documents:", err);
            }).finally(() => {
                // Keep the key in the set for a moment to allow Firestore to sync the local collection
                setTimeout(() => {
                    isWritingRef.current.delete(alertKey);
                }, 2000);
            });
          }
        }
      }
    });
  }, [buses, monitoredHazards, activeAlerts, firestore, user]);

  return null;
}

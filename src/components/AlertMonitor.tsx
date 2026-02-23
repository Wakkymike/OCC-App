
'use client';

import { useEffect, useRef } from 'react';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { MonitoredHazard, ActiveAlert } from '@/lib/types';

/**
 * Haversine formula to calculate the great-circle distance between two points 
 * on a sphere given their longitudes and latitudes.
 */
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth's radius in metres
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

/**
 * Background component that monitors live bus positions against active geofences.
 * Triggers alerts when a Go North West vehicle enters a restricted zone.
 */
export function AlertMonitor() {
  const { user } = useUser();
  const { buses } = useBusTracker();
  const firestore = useFirestore();
  
  // Fetch all active geofence monitors
  const hazardsRef = useMemoFirebase(() => user ? collection(firestore, 'monitoredHazards') : null, [firestore, user]);
  const { data: monitoredHazards } = useCollection<MonitoredHazard>(hazardsRef);
  
  // Fetch currently active alerts to prevent duplicate triggers
  const activeAlertsRef = useMemoFirebase(() => user ? collection(firestore, 'activeAlerts') : null, [firestore, user]);
  const { data: activeAlerts } = useCollection<ActiveAlert>(activeAlertsRef);

  // Use a ref to prevent overlapping write operations for the same event
  const isWritingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Evaluation requires authenticated user, active monitors, and live bus data
    if (!user || !monitoredHazards || !buses || !activeAlerts || buses.length === 0) return;

    // Focus exclusively on GNW vehicles with valid GPS coordinates
    const gnwBuses = buses.filter(b => b.operator === 'GNW' && b.position);
    
    gnwBuses.forEach((bus) => {
      // Standardize the Bus ID by removing whitespace for reliable matching
      const fleet = String(bus.fleetNumber).replace(/\s+/g, '').toUpperCase();
      const svc = String(bus.service).replace(/\s+/g, '').toUpperCase();
      const busId = `${fleet}-${svc}`;
      
      for (const monitor of monitoredHazards) {
        const center = monitor.geofenceCenter || monitor.location;
        const distance = getDistanceInMeters(
          bus.position!.lat,
          bus.position!.lng,
          center.lat,
          center.lng
        );

        // Breach detected if bus is within radius (plus 5m buffer for GPS jitter)
        if (distance <= (monitor.radius + 5)) {
          const alertKey = `${busId}-${monitor.id}`;
          
          // Skip if a write operation for this specific breach is already in progress
          if (isWritingRef.current.has(alertKey)) continue;

          // Check if an alert for this bus in this zone already exists in the active list
          const existingAlert = activeAlerts.find(a => 
            (a.busId === busId || a.fleetNumber === bus.fleetNumber) && 
            a.monitorId === monitor.id
          );
          
          // Trigger new alert if none currently exists for this breach
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

            const alertsRef = collection(firestore, 'activeAlerts');
            const historyRef = collection(firestore, 'alertHistory');

            // Record the breach in both the live monitoring collection and the persistent audit log
            Promise.all([
                addDoc(alertsRef, alertData),
                addDoc(historyRef, alertData)
            ]).catch(err => {
                console.error("Critical: Failed to record geofence breach:", err);
            }).finally(() => {
                // Lock out re-triggering for 10 seconds to allow Firestore state to synchronize
                setTimeout(() => {
                    isWritingRef.current.delete(alertKey);
                }, 10000);
            });
          }
        }
      }
    });
  }, [buses, monitoredHazards, activeAlerts, firestore, user]);

  return null;
}

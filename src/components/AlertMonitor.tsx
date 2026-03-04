
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useBusTracker } from '@/hooks/use-bus-tracker';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { SOCKET_EVENTS } from '@/lib/socket/events';
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
  const { user } = useAuth();
  const { buses } = useBusTracker();
  const { on, off } = useSocket();
  
  const [monitoredHazards, setMonitoredHazards] = useState<MonitoredHazard[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);

  // Use a ref to prevent overlapping write operations for the same event
  const isWritingRef = useRef<Set<string>>(new Set());

  // Fetch monitored hazards
  const fetchHazards = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/monitored-hazards');
      if (res.ok) {
        const data = await res.json();
        setMonitoredHazards(data.hazards || []);
      }
    } catch (err) {
      console.error('Failed to fetch monitored hazards:', err);
    }
  }, [user]);

  // Fetch active alerts
  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/active-alerts');
      if (res.ok) {
        const data = await res.json();
        setActiveAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to fetch active alerts:', err);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchHazards();
    fetchAlerts();
  }, [fetchHazards, fetchAlerts]);

  // Listen for real-time updates via Socket.io
  useEffect(() => {
    const handleAlertChange = () => fetchAlerts();
    const handleHazardChange = () => fetchHazards();

    on(SOCKET_EVENTS.ALERT_CREATED, handleAlertChange);
    on(SOCKET_EVENTS.ALERT_ACKNOWLEDGED, handleAlertChange);
    on(SOCKET_EVENTS.ALERT_DELETED, handleAlertChange);
    on(SOCKET_EVENTS.HAZARD_CHANGED, handleHazardChange);

    return () => {
      off(SOCKET_EVENTS.ALERT_CREATED, handleAlertChange);
      off(SOCKET_EVENTS.ALERT_ACKNOWLEDGED, handleAlertChange);
      off(SOCKET_EVENTS.ALERT_DELETED, handleAlertChange);
      off(SOCKET_EVENTS.HAZARD_CHANGED, handleHazardChange);
    };
  }, [on, off, fetchAlerts, fetchHazards]);

  useEffect(() => {
    if (!user || !monitoredHazards || !buses || !activeAlerts || buses.length === 0) return;

    const gnwBuses = buses.filter(b => b.operator === 'GNW' && b.position);
    
    gnwBuses.forEach((bus) => {
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

        if (distance <= (monitor.radius + 5)) {
          const alertKey = `${busId}-${monitor.id}`;
          
          if (isWritingRef.current.has(alertKey)) continue;

          const existingAlert = activeAlerts.find(a => 
            (a.busId === busId || a.fleetNumber === bus.fleetNumber) && 
            a.monitorId === monitor.id
          );
          
          if (!existingAlert) {
            isWritingRef.current.add(alertKey);
            
            fetch('/api/active-alerts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                busId,
                fleetNumber: bus.fleetNumber,
                service: bus.service,
                hazardId: monitor.hazardId,
                monitorId: monitor.id,
                hazardValue: monitor.value,
                hazardDescription: monitor.description,
              }),
            }).catch(err => {
              console.error("Critical: Failed to record geofence breach:", err);
            }).finally(() => {
              setTimeout(() => {
                isWritingRef.current.delete(alertKey);
              }, 10000);
            });
          }
        }
      }
    });
  }, [buses, monitoredHazards, activeAlerts, user]);

  return null;
}

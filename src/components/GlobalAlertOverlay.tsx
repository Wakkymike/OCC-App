
'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { ActiveAlert } from '@/lib/types';
import { AlertTriangle, ShieldAlert, CheckCircle2, Bus as BusIcon, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

/**
 * A global, high-visibility overlay that triggers when a geofence breach is detected.
 * It only shows alerts that have not yet been acknowledged.
 */
export function GlobalAlertOverlay() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  // Listen for active alerts globally
  const alertsRef = useMemoFirebase(() => user ? collection(firestore, 'activeAlerts') : null, [firestore, user]);
  const { data: allAlerts } = useCollection<ActiveAlert>(alertsRef);
  
  // Filter for alerts that haven't been acknowledged yet
  const alerts = useMemo(() => {
    if (!allAlerts) return [];
    return allAlerts.filter(alert => !alert.isAcknowledged);
  }, [allAlerts]);

  // Only show if user is authenticated and there are unacknowledged alerts
  if (!user || !alerts || alerts.length === 0) return null;

  const handleAcknowledge = (alert: ActiveAlert) => {
    const ackData = { 
      isAcknowledged: true,
      acknowledgedBy: user?.displayName || user?.email || 'Unknown User',
      acknowledgedAt: serverTimestamp()
    };

    // Update the active alert
    updateDoc(doc(firestore, 'activeAlerts', alert.id), ackData);

    // Update the linked history log if it exists
    if (alert.historyDocId) {
      updateDoc(doc(firestore, 'alertHistory', alert.historyDocId), {
        acknowledgedBy: ackData.acknowledgedBy,
        acknowledgedAt: ackData.acknowledgedAt
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col items-center justify-center p-4 overflow-y-auto backdrop-blur-md">
      <div className="w-full max-w-2xl space-y-8 py-10">
        <div className="flex flex-col items-center text-center gap-4 text-destructive animate-pulse">
          <ShieldAlert className="h-24 w-24" />
          <h1 className="text-5xl font-extrabold uppercase tracking-tight text-white drop-shadow-lg">
            Geofence Breach
          </h1>
          <p className="text-destructive font-black text-xl bg-white px-4 py-1 rounded">
            ACTION REQUIRED
          </p>
        </div>
        
        <div className="space-y-6">
          {alerts.map((alert) => (
            <Card key={alert.id} className="border-4 border-destructive bg-card shadow-[0_0_60px_rgba(239,68,68,0.4)] overflow-hidden">
              <CardHeader className="bg-destructive/10 border-b border-destructive/20">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BusIcon className="h-7 w-7 text-destructive" />
                    <span className="text-3xl font-bold">Bus {alert.fleetNumber}</span>
                  </div>
                  <Badge variant="destructive" className="text-lg px-4 py-1 font-black">
                    Service {alert.service}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-destructive/10 p-3 rounded-full">
                    <AlertTriangle className="h-10 w-10 text-destructive shrink-0" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-black uppercase text-destructive tracking-tighter leading-none">
                      {alert.hazardValue} RESTRICTION
                    </p>
                    <p className="text-xl font-bold text-foreground/80">
                      {alert.hazardDescription}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-muted text-sm font-medium">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>Zone Monitoring ID: {alert.monitorId.substring(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground justify-end">
                    <Clock className="h-4 w-4" />
                    <span>{alert.timestamp?.toDate ? alert.timestamp.toDate().toLocaleTimeString() : 'Resolving time...'}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 p-4 border-t">
                <Button 
                  onClick={() => handleAcknowledge(alert)}
                  className="w-full h-16 text-2xl font-black bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg"
                >
                  <CheckCircle2 className="mr-3 h-8 w-8" />
                  ACKNOWLEDGE & DISMISS
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

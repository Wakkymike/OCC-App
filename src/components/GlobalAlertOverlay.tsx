
'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import type { ActiveAlert } from '@/lib/types';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

export function GlobalAlertOverlay() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const alertsRef = useMemoFirebase(() => collection(firestore, 'activeAlerts'), [firestore]);
  const { data: alerts } = useCollection<ActiveAlert>(alertsRef);
  
  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userProfileRef);
  
  const isAdmin = profile?.isAdmin || user?.email === 'michael.dodsworth@gonorthwest.co.uk';

  if (!alerts || alerts.length === 0) return null;

  const handleDismiss = (alertId: string) => {
    if (!isAdmin) return;
    deleteDoc(doc(firestore, 'activeAlerts', alertId));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex flex-col items-center justify-center p-4 overflow-y-auto gap-6">
      <div className="flex items-center gap-3 text-destructive animate-bounce-zoom">
        <ShieldAlert className="h-16 w-16" />
        <h1 className="text-4xl font-black uppercase tracking-tighter">Geofence Breach Detected</h1>
      </div>
      
      <div className="w-full max-w-2xl space-y-4">
        {alerts.map((alert) => (
          <Card key={alert.id} className="border-4 border-destructive bg-destructive/5 text-destructive-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                Bus {alert.fleetNumber} (Service {alert.service})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xl font-bold">REASON: {alert.hazardValue} Restriction Breach</p>
              <p className="opacity-80">LOCATION: {alert.hazardDescription}</p>
              <p className="text-xs opacity-50">TIME: {alert.timestamp?.toDate().toLocaleString()}</p>
            </CardContent>
            {isAdmin && (
              <CardFooter>
                <Button 
                  onClick={() => handleDismiss(alert.id)}
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Acknowledge & Dismiss Alert
                </Button>
              </CardFooter>
            )}
            {!isAdmin && (
              <CardFooter>
                <p className="text-sm font-semibold italic text-center w-full">
                  Waiting for Administrator Acknowledgment...
                </p>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import type { ActiveAlert } from '@/lib/types';
import { AlertTriangle, ShieldAlert, CheckCircle2, ArrowLeft, Home, History, Bus as BusIcon, Clock, MapPin } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function RRAListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const alertsRef = useMemoFirebase(() => user ? collection(firestore, 'activeAlerts') : null, [firestore, user]);
  const { data: alerts, isLoading } = useCollection<ActiveAlert>(alertsRef);
  
  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userProfileRef);
  
  const isAdmin = profile?.isAdmin || user?.email === 'michael.dodsworth@gonorthwest.co.uk';

  const handleDismiss = (alertId: string) => {
    if (!isAdmin) return;
    deleteDoc(doc(firestore, 'activeAlerts', alertId));
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-5xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">RRA Dashboard</h1>
              <p className="text-muted-foreground text-sm">Real-time Road Restriction Alerts & Breaches</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Home className="mr-2 h-4 w-4" /> Home
            </Link>
          </div>
        </div>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Active Breaches
            </CardTitle>
            <CardDescription>
              Currently active geofence triggers requiring attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <span className="text-sm text-muted-foreground animate-pulse">Loading active alerts...</span>
              </div>
            ) : !alerts || alerts.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center border-2 border-dashed rounded-lg bg-card/50">
                <CheckCircle2 className="h-10 w-10 text-primary opacity-20 mb-2" />
                <p className="text-muted-foreground font-medium">No active breaches detected</p>
                <p className="text-xs text-muted-foreground">The network is clear.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bus Detail</TableHead>
                        <TableHead>Restriction</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Time</TableHead>
                        {isAdmin && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id} className="group hover:bg-destructive/10">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold flex items-center gap-1">
                                <BusIcon className="h-3 w-3" /> {alert.fleetNumber}
                              </span>
                              <Badge variant="secondary" className="w-fit text-[10px] mt-1">Service {alert.service}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="uppercase font-black">
                              {alert.hazardValue}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs line-clamp-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3 opacity-50" /> {alert.hazardDescription}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" /> {alert.timestamp?.toDate().toLocaleTimeString()}
                            </span>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => handleDismiss(alert.id)}
                                className="h-8"
                              >
                                Dismiss
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile List View */}
                <div className="md:hidden space-y-3">
                  {alerts.map((alert) => (
                    <Card key={alert.id} className="border-l-4 border-l-destructive shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold flex items-center gap-1">
                              <BusIcon className="h-4 w-4" /> Bus {alert.fleetNumber}
                            </p>
                            <Badge variant="outline" className="mt-1">Service {alert.service}</Badge>
                          </div>
                          <Badge variant="destructive" className="uppercase">{alert.hazardValue}</Badge>
                        </div>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {alert.hazardDescription}</p>
                          <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {alert.timestamp?.toDate().toLocaleString()}</p>
                        </div>
                        {isAdmin && (
                          <Button 
                            className="w-full mt-2" 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDismiss(alert.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Acknowledge
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t py-4">
             <Button asChild variant="ghost" size="sm">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Link>
             </Button>
             <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
               Real-time monitoring active
             </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

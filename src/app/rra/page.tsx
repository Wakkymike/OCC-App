
'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, deleteDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import type { ActiveAlert, AlertHistory } from '@/lib/types';
import { AlertTriangle, ShieldAlert, CheckCircle2, Home, History, Bus as BusIcon, Clock, MapPin, ListFilter, CheckCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo } from 'react';

export default function RRAListPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const alertsRef = useMemoFirebase(() => user ? collection(firestore, 'activeAlerts') : null, [firestore, user]);
  const { data: allAlerts, isLoading: isAlertsLoading } = useCollection<ActiveAlert>(alertsRef);

  // Sort alerts: unacknowledged first, then by timestamp
  const alerts = useMemo(() => {
    if (!allAlerts) return null;
    return [...allAlerts].sort((a, b) => {
        if (a.isAcknowledged === b.isAcknowledged) {
            return b.timestamp?.seconds - a.timestamp?.seconds;
        }
        return a.isAcknowledged ? 1 : -1;
    });
  }, [allAlerts]);

  const historyRef = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'alertHistory'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore, user]);
  const { data: history, isLoading: isHistoryLoading } = useCollection<AlertHistory>(historyRef);

  const handleClearAlert = async (alertId: string) => {
    // This is the final resolution of an alert. 
    // Any logged-in user can clear it after verifying the incident.
    deleteDoc(doc(firestore, 'activeAlerts', alertId));
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">RRA Dashboard</h1>
              <p className="text-muted-foreground text-sm">Real-time Road Restriction Alerts & History</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Home className="mr-2 h-4 w-4" /> Home
            </Link>
          </div>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Breaches
              {alerts && alerts.filter(a => !a.isAcknowledged).length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                  {alerts.filter(a => !a.isAcknowledged).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle>Active Breaches</CardTitle>
                <CardDescription>Live geofence triggers. Acknowledged items remain here until cleared.</CardDescription>
              </CardHeader>
              <CardContent>
                {isAlertsLoading ? (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground animate-pulse">
                    Loading active alerts...
                  </div>
                ) : !alerts || alerts.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center border-2 border-dashed rounded-lg bg-card/50">
                    <CheckCircle2 className="h-10 w-10 text-primary opacity-20 mb-2" />
                    <p className="text-muted-foreground font-medium">No active breaches</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Bus Detail</TableHead>
                        <TableHead>Restriction</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id} className={`group hover:bg-destructive/10 ${alert.isAcknowledged ? 'opacity-70' : ''}`}>
                          <TableCell>
                            {alert.isAcknowledged ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                    ACKNOWLEDGED
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="animate-pulse">
                                    NEW ALERT
                                </Badge>
                            )}
                          </TableCell>
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
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant={alert.isAcknowledged ? "outline" : "destructive"}
                              onClick={() => handleClearAlert(alert.id)}
                              className="h-8 font-bold"
                            >
                              {alert.isAcknowledged ? (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Clear & Resolve
                                  </>
                              ) : "Resolve Now"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Historical Breaches</CardTitle>
                    <CardDescription>Review all past geofence incidents and locations.</CardDescription>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <ListFilter className="h-3 w-3" /> Last 50 Events
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isHistoryLoading ? (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground animate-pulse">
                    Loading history log...
                  </div>
                ) : !history || history.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                    <History className="h-10 w-10 opacity-10 mb-2" />
                    <p>No historical records found.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bus</TableHead>
                        <TableHead>Restriction</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Date & Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold">Bus {log.fleetNumber}</span>
                              <span className="text-[10px] text-muted-foreground">Service {log.service}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase font-bold border-destructive/30">
                              {log.hazardValue}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{log.hazardDescription}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-xs text-muted-foreground">
                              <span>{log.timestamp?.toDate().toLocaleDateString()}</span>
                              <span className="font-mono">{log.timestamp?.toDate().toLocaleTimeString()}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

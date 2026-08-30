'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { SOCKET_EVENTS } from '@/lib/socket/events';
import type { ActiveAlert, AlertHistory } from '@/lib/types';
import { AlertTriangle, CheckCircle2, Home, History, Bus as BusIcon, Clock, MapPin, ListFilter, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageShell from '@/components/layout/PageShell';

export default function RRAListPage() {
  const { user } = useAuth();
  const { on, off } = useSocket();
  
  const [allAlerts, setAllAlerts] = useState<ActiveAlert[]>([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(true);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/active-alerts');
      if (res.ok) {
        const data = await res.json();
        setAllAlerts(data.alerts);
      }
    } catch (e) { console.error('Failed to fetch alerts', e); }
    finally { setIsAlertsLoading(false); }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/alert-history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history);
      }
    } catch (e) { console.error('Failed to fetch history', e); }
    finally { setIsHistoryLoading(false); }
  };

  useEffect(() => {
    if (user) {
      fetchAlerts();
      fetchHistory();
    }
  }, [user]);

  useEffect(() => {
    const handleAlertChange = () => { fetchAlerts(); fetchHistory(); };
    on(SOCKET_EVENTS.ALERT_CREATED, handleAlertChange);
    on(SOCKET_EVENTS.ALERT_ACKNOWLEDGED, handleAlertChange);
    on(SOCKET_EVENTS.ALERT_DELETED, handleAlertChange);
    return () => {
      off(SOCKET_EVENTS.ALERT_CREATED, handleAlertChange);
      off(SOCKET_EVENTS.ALERT_ACKNOWLEDGED, handleAlertChange);
      off(SOCKET_EVENTS.ALERT_DELETED, handleAlertChange);
    };
  }, [on, off]);

  // Sort alerts: unacknowledged first, then by timestamp
  const alerts = useMemo(() => {
    if (!allAlerts) return null;
    return [...allAlerts].sort((a: any, b: any) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        if (a.isAcknowledged === b.isAcknowledged) {
            return timeB - timeA;
        }
        return a.isAcknowledged ? 1 : -1;
    });
  }, [allAlerts]);

  const handleClearAlert = async (alertId: string) => {
    await fetch(`/api/active-alerts/${alertId}`, { method: 'DELETE' });
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return '--:--';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (ts: any) => {
    if (!ts) return '--/--/--';
    return new Date(ts).toLocaleDateString();
  };

  return (
    <PageShell
      title="RRA Dashboard"
      description="Real-time Road Restriction Alerts and history."
      actions={(
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            <Home className="mr-2 h-4 w-4" /> Home
          </Link>
        </Button>
      )}
    >

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[420px]">
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
            <Card className="occ-panel border-destructive/20 bg-destructive/5">
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
                                <div className="flex flex-col gap-1">
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 w-fit">
                                      ACKNOWLEDGED
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground italic truncate max-w-[100px]" title={`Acknowledged by ${alert.acknowledgedBy}`}>
                                    by {alert.acknowledgedBy || 'System'}
                                  </span>
                                </div>
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
                              <Clock className="h-3 w-3" /> {formatTimestamp(alert.timestamp)}
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
            <Card className="occ-panel">
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
                        <TableHead>Acknowledged By</TableHead>
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
                            <span className="text-xs italic text-muted-foreground">
                              {log.acknowledgedBy || '--'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-xs text-muted-foreground">
                              <span>{formatDate(log.timestamp)}</span>
                              <span className="font-mono">{formatTimestamp(log.timestamp)}</span>
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
    </PageShell>
  );
}

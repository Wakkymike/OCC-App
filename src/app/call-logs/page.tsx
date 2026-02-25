
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Phone, User, Hash, Bus, Route, MapPin, Clock, Calendar, Trash2, ShieldAlert, Home, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import type { CallLog } from '@/lib/types';

export default function CallLogsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    callTime: '',
    employeeNumber: '',
    fleetNumber: '',
    serviceNumber: '',
    depot: '',
    phoneNumber: '',
    timeFrom: '',
    timeTo: '',
    details: '',
    isTeamsRelated: false,
    isTicketerRelated: false,
    isEPMRelated: false,
    isIRRelated: false,
    isTSIRelated: false,
    isDriverReportRelated: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoize collection reference for current user
  const callLogsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'callLogs');
  }, [firestore, user]);

  const callLogsQuery = useMemoFirebase(() => {
    if (!callLogsRef) return null;
    return query(callLogsRef, orderBy('createdAt', 'desc'));
  }, [callLogsRef]);

  const { data: logs, isLoading } = useCollection<CallLog>(callLogsQuery);

  // Auto-retention logic: Purge records older than 5 days
  useEffect(() => {
    if (!callLogsRef || !logs || logs.length === 0) return;

    const fiveDaysAgo = subDays(new Date(), 5);
    const oldLogs = logs.filter(log => {
      if (!log.createdAt) return false;
      return log.createdAt.toDate() < fiveDaysAgo;
    });

    if (oldLogs.length > 0) {
      console.log(`Auto-purge: Found ${oldLogs.length} records older than 5 days.`);
      oldLogs.forEach(log => {
        deleteDocumentNonBlocking(doc(callLogsRef, log.id));
      });
    }
  }, [logs, callLogsRef]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Strictly limit Phone Number to 3 digits
    if (name === 'phoneNumber') {
      const numericValue = value.replace(/\D/g, '').slice(0, 3);
      setFormData(prev => ({ ...prev, [name]: numericValue }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !callLogsRef) return;

    setIsSubmitting(true);
    const logData = {
      ...formData,
      userId: user.uid,
      createdAt: serverTimestamp(),
    };

    addDocumentNonBlocking(callLogsRef, logData)
      .then(() => {
        toast({ title: 'Log Entry Created', description: 'Operational record saved successfully.' });
        setFormData({
          callTime: '',
          employeeNumber: '',
          fleetNumber: '',
          serviceNumber: '',
          depot: '',
          phoneNumber: '',
          timeFrom: '',
          timeTo: '',
          details: '',
          isTeamsRelated: false,
          isTicketerRelated: false,
          isEPMRelated: false,
          isIRRelated: false,
          isTSIRelated: false,
          isDriverReportRelated: false,
        });
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleDeleteAll = async () => {
    if (!user || !callLogsRef || !logs || logs.length === 0) return;

    if (confirm('Are you sure you want to clear all your logs for this shift? This action cannot be undone.')) {
      logs.forEach(log => {
        deleteDocumentNonBlocking(doc(callLogsRef, log.id));
      });
      toast({ title: 'Logs Cleared', description: 'Your shift session has been wiped.' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-6xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Operational Call Logs</h1>
              <p className="text-muted-foreground text-sm">Secure logging for OCC staff.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleDeleteAll} variant="destructive" size="sm" disabled={!logs || logs.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear All Logs
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/"><Home className="mr-2 h-4 w-4" /> Home</Link>
            </Button>
          </div>
        </div>

        <Card className="border-destructive/20 bg-destructive/5 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Info className="h-4 w-4" />
              DATA SECURITY NOTICE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-bold text-destructive/80 uppercase tracking-wide">
              REQUIREMENT: All users must delete their logs at the end of each shift for data security. Records older than 5 days are purged automatically.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 shadow-md h-fit sticky top-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                New Entry
              </CardTitle>
              <CardDescription>Enter call details accurately.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="callTime">Call Time</Label>
                    <Input type="time" name="callTime" value={formData.callTime} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeNumber">Emp No.</Label>
                    <Input name="employeeNumber" placeholder="12345" value={formData.employeeNumber} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fleetNumber">Fleet No.</Label>
                    <Input name="fleetNumber" placeholder="67001" value={formData.fleetNumber} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serviceNumber">Service No.</Label>
                    <Input name="serviceNumber" placeholder="582" value={formData.serviceNumber} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="depot">Depot</Label>
                    <Input name="depot" placeholder="Bolton" value={formData.depot} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone (3 Dig)</Label>
                    <Input name="phoneNumber" placeholder="999" value={formData.phoneNumber} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timeFrom">Time From</Label>
                    <Input type="time" name="timeFrom" value={formData.timeFrom} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeTo">Time To</Label>
                    <Input type="time" name="timeTo" value={formData.timeTo} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details">Details</Label>
                  <Textarea name="details" placeholder="Detailed notes about the incident or call..." value={formData.details} onChange={handleInputChange} required className="min-h-[100px]" />
                </div>

                <div className="grid grid-cols-2 gap-y-3 pt-2">
                  {[
                    { id: 'isTeamsRelated', label: 'Teams' },
                    { id: 'isTicketerRelated', label: 'Ticketer' },
                    { id: 'isEPMRelated', label: 'EPM' },
                    { id: 'isIRRelated', label: 'IR' },
                    { id: 'isTSIRelated', label: 'TSI' },
                    { id: 'isDriverReportRelated', label: 'Driver Report' },
                  ].map(item => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <Checkbox id={item.id} checked={(formData as any)[item.id]} onCheckedChange={(v) => handleCheckboxChange(item.id, !!v)} />
                      <label htmlFor={item.id} className="text-xs font-medium cursor-pointer">{item.label}</label>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 pt-6">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Clock className="mr-2 h-4 w-4" />}
                  Save Log Record
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="lg:col-span-2 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Logs</CardTitle>
                  <CardDescription>Private operational records for your session.</CardDescription>
                </div>
                {logs && logs.length > 0 && (
                  <Badge variant="outline" className="font-bold">
                    {logs.length} RECORDS
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p>Syncing call logs...</p>
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[80px]">Time</TableHead>
                        <TableHead>Fleet/Svc</TableHead>
                        <TableHead>Depot/Phone</TableHead>
                        <TableHead>Related</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="group hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">{log.callTime}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">Bus {log.fleetNumber}</span>
                              <span className="text-[10px] text-muted-foreground">Svc {log.serviceNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{log.depot}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Phone className="h-2 w-2" /> Ext: {log.phoneNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {log.isTeamsRelated && <Badge variant="secondary" className="text-[8px] h-4">Teams</Badge>}
                              {log.isTicketerRelated && <Badge variant="secondary" className="text-[8px] h-4">Ticketer</Badge>}
                              {log.isIRRelated && <Badge variant="destructive" className="text-[8px] h-4">IR</Badge>}
                              {log.isDriverReportRelated && <Badge variant="outline" className="text-[8px] h-4">Report</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-destructive h-8 w-8"
                              onClick={() => deleteDocumentNonBlocking(doc(callLogsRef!, log.id))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed m-6 rounded-lg bg-muted/5">
                  <Clock className="h-12 w-12 opacity-10 mb-4" />
                  <p className="font-medium">No operational logs found.</p>
                  <p className="text-xs">New entries will appear here instantly.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

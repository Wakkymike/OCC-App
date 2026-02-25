
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
import { collection, query, orderBy, serverTimestamp, doc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Phone, Trash2, ShieldAlert, Home, Loader2, Info, Clock, Calendar, CheckCircle2, Plus } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { subDays, format } from 'date-fns';
import type { CallLog } from '@/lib/types';

export default function CallLogsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    date: '',
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
      // Handle Firestore Timestamp conversion
      const createdDate = log.createdAt instanceof Timestamp ? log.createdAt.toDate() : new Date(log.createdAt);
      return createdDate < fiveDaysAgo;
    });

    if (oldLogs.length > 0) {
      console.log(`Auto-purge: Deleting ${oldLogs.length} records older than 5 days.`);
      oldLogs.forEach(log => {
        deleteDocumentNonBlocking(doc(callLogsRef, log.id));
      });
    }
  }, [logs, callLogsRef]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Strictly limit Phone Number to 3 digits only
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

  const handleStartNewEntry = () => {
    const now = new Date();
    setFormData({
      date: format(now, 'dd/MM/yyyy'),
      callTime: format(now, 'HH:mm'),
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
    toast({ title: 'New Entry Started', description: 'Current date and time have been autofilled.' });
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
        toast({ title: 'Log Saved', description: 'Call record added successfully.' });
        setFormData({
          date: '',
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

    if (confirm('Permanently delete all call logs for your current shift session?')) {
      logs.forEach(log => {
        deleteDocumentNonBlocking(doc(callLogsRef, log.id));
      });
      toast({ title: 'Shift Logs Cleared' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-6xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="p-2 border-primary/20">
              <Clock className="h-6 w-6 text-primary" />
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">OCC Call Logs</h1>
              <p className="text-muted-foreground text-sm font-medium italic">Personal operational log tracker.</p>
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

        <Card className="border-destructive/30 bg-destructive/5 shadow-none ring-1 ring-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs flex items-center gap-2 text-destructive font-black uppercase tracking-widest">
              <Info className="h-4 w-4" />
              Operational Security Requirement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-bold text-destructive/90 leading-relaxed">
              All staff are required to delete their private logs at the end of each shift. Records are strictly private to your account. Automated purging occurs for records older than 5 days.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 shadow-lg border-primary/5 h-fit sticky top-8">
            <CardHeader className="bg-muted/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  New Entry
                </CardTitle>
                <CardDescription>Log event details accurately.</CardDescription>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleStartNewEntry}
                className="font-bold border-primary/30 text-primary hover:bg-primary/10"
              >
                <Plus className="mr-1 h-4 w-4" /> Start New
              </Button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-[10px] font-bold uppercase text-muted-foreground">Date</Label>
                    <Input name="date" placeholder="DD/MM/YYYY" value={formData.date} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="callTime" className="text-[10px] font-bold uppercase text-muted-foreground">Call Time</Label>
                    <Input type="time" name="callTime" value={formData.callTime} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeNumber" className="text-[10px] font-bold uppercase text-muted-foreground">Emp No.</Label>
                    <Input name="employeeNumber" placeholder="12345" value={formData.employeeNumber} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fleetNumber" className="text-[10px] font-bold uppercase text-muted-foreground">Fleet No.</Label>
                    <Input name="fleetNumber" placeholder="67001" value={formData.fleetNumber} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serviceNumber" className="text-[10px] font-bold uppercase text-muted-foreground">Svc No.</Label>
                    <Input name="serviceNumber" placeholder="582" value={formData.serviceNumber} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depot" className="text-[10px] font-bold uppercase text-muted-foreground">Depot</Label>
                    <Input name="depot" placeholder="Bolton" value={formData.depot} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-[10px] font-bold uppercase text-muted-foreground">Phone (3-Dig)</Label>
                    <Input name="phoneNumber" placeholder="999" value={formData.phoneNumber} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    {/* Empty cell for layout alignment if needed */}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timeFrom" className="text-[10px] font-bold uppercase text-muted-foreground">Time From</Label>
                    <Input type="time" name="timeFrom" value={formData.timeFrom} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeTo" className="text-[10px] font-bold uppercase text-muted-foreground">Time To</Label>
                    <Input type="time" name="timeTo" value={formData.timeTo} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details" className="text-[10px] font-bold uppercase text-muted-foreground">Details</Label>
                  <Textarea name="details" placeholder="Shift notes..." value={formData.details} onChange={handleInputChange} required className="min-h-[80px]" />
                </div>

                <div className="grid grid-cols-2 gap-y-3 pt-4 border-t border-dashed">
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
                      <label htmlFor={item.id} className="text-xs font-semibold cursor-pointer select-none text-foreground/80">{item.label}</label>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 mt-4 pt-6 pb-6">
                <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Save Record
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="lg:col-span-2 shadow-sm border-muted/40">
            <CardHeader className="bg-muted/10 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Recent Shift Logs</CardTitle>
                  <CardDescription className="text-xs">Your operational history for the last 5 days.</CardDescription>
                </div>
                {logs && logs.length > 0 && (
                  <Badge variant="secondary" className="font-black text-[10px]">
                    {logs.length} RECORDS
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="font-bold text-sm tracking-widest uppercase opacity-50">Syncing database...</p>
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                        <TableHead className="w-[100px] text-[10px] font-black uppercase">Time</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Fleet/Svc</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Depot/Ext</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Tags</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="group hover:bg-primary/5 transition-colors">
                          <TableCell className="font-mono text-xs font-bold text-muted-foreground">{log.date || '--/--/--'}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">{log.callTime}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-black text-sm">{log.fleetNumber}</span>
                              <span className="text-[9px] text-muted-foreground font-bold tracking-tighter uppercase">Service {log.serviceNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{log.depot}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Phone className="h-2 w-2" /> Ext: {log.phoneNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {log.isTeamsRelated && <Badge className="text-[8px] h-4 bg-blue-500">Teams</Badge>}
                              {log.isTicketerRelated && <Badge className="text-[8px] h-4 bg-orange-500">Ticketer</Badge>}
                              {log.isIRRelated && <Badge variant="destructive" className="text-[8px] h-4">IR</Badge>}
                              {log.isDriverReportRelated && <Badge variant="outline" className="text-[8px] h-4 border-destructive/50 text-destructive">Report</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-destructive h-8 w-8 rounded-full"
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
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border-2 border-dashed m-6 rounded-xl bg-muted/5">
                  <Calendar className="h-16 w-16 opacity-5 mb-4" />
                  <p className="font-black text-xs uppercase tracking-[0.2em] opacity-40">No entries found for this session</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

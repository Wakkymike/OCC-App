
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Phone, Trash2, Home, Loader2, Info, Clock, Calendar, CheckCircle2, Plus, X, User as UserIcon, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { subDays, format } from 'date-fns';
import type { CallLog } from '@/lib/types';

export default function CallLogsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
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
      const createdDate = log.createdAt instanceof Timestamp ? log.createdAt.toDate() : new Date(log.createdAt);
      return createdDate < fiveDaysAgo;
    });

    if (oldLogs.length > 0) {
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
    setShowForm(true);
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
        setShowForm(false);
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
            <Button onClick={handleStartNewEntry} className="font-bold">
              <Plus className="mr-2 h-4 w-4" /> Start New Entry
            </Button>
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

        {showForm && (
          <div ref={formRef} className="animate-in fade-in slide-in-from-top-4 duration-300">
            <Card className="shadow-lg border-primary/20 bg-muted/5">
              <CardHeader className="bg-muted/30 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    Record New Event
                  </CardTitle>
                  <CardDescription>Populate all fields accurately for operational tracking.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Time & User Info Section */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Date</Label>
                          <Input name="date" placeholder="DD/MM/YYYY" value={formData.date} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Call Time</Label>
                          <Input type="time" name="callTime" value={formData.callTime} onChange={handleInputChange} required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Emp No.</Label>
                          <Input name="employeeNumber" placeholder="12345" value={formData.employeeNumber} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Ext (3-Dig)</Label>
                          <Input name="phoneNumber" placeholder="999" value={formData.phoneNumber} onChange={handleInputChange} required />
                        </div>
                      </div>
                    </div>

                    {/* Operational Section */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Fleet No.</Label>
                          <Input name="fleetNumber" placeholder="67001" value={formData.fleetNumber} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Svc No.</Label>
                          <Input name="serviceNumber" placeholder="582" value={formData.serviceNumber} onChange={handleInputChange} required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Depot</Label>
                        <Input name="depot" placeholder="Bolton" value={formData.depot} onChange={handleInputChange} required />
                      </div>
                    </div>

                    {/* Window & Logic Section */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Time From</Label>
                          <Input type="time" name="timeFrom" value={formData.timeFrom} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Time To</Label>
                          <Input type="time" name="timeTo" value={formData.timeTo} onChange={handleInputChange} required />
                        </div>
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
                            <label htmlFor={item.id} className="text-xs font-bold cursor-pointer text-foreground/80">{item.label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-6">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Event Details</Label>
                    <Textarea name="details" placeholder="Operational notes..." value={formData.details} onChange={handleInputChange} required className="min-h-[100px] bg-background" />
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/20 py-4 px-6 mt-6">
                  <Button type="submit" className="w-full font-bold h-12" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                    Save Operational Record
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-2xl font-black tracking-tighter uppercase">Recent Operational History</h2>
            {logs && logs.length > 0 && <Badge className="font-black">{logs.length} RECORDS</Badge>}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-black text-xs uppercase tracking-widest opacity-50">Fetching Encrypted Logs...</p>
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {logs.map((log) => (
                <Card key={log.id} className="overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      {/* Left Column: Identifiers */}
                      <div className="space-y-4 flex-shrink-0 w-full md:w-48">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-primary">
                            <Calendar className="h-4 w-4" />
                            <span className="font-bold text-sm">{log.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <span className="text-2xl font-black tabular-nums">{log.callTime}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Badge variant="secondary" className="w-full justify-center py-1 font-bold text-[10px]">
                            <UserIcon className="h-3 w-3 mr-1" /> EMP: {log.employeeNumber}
                          </Badge>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="flex-1 justify-center bg-muted/50 text-[9px] font-black">
                              FLT: {log.fleetNumber}
                            </Badge>
                            <Badge variant="outline" className="flex-1 justify-center bg-muted/50 text-[9px] font-black">
                              SVC: {log.serviceNumber}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Middle Column: Operational Info */}
                      <div className="flex-grow space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Depot & Extension</Label>
                            <div className="flex items-center gap-2 font-bold text-sm">
                              <Home className="h-3.5 w-3.5 text-primary" />
                              <span>{log.depot}</span>
                              <span className="text-muted-foreground">|</span>
                              <Phone className="h-3.5 w-3.5 text-primary" />
                              <span>Ext: {log.phoneNumber}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Incident Duration</Label>
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <Badge variant="outline" className="rounded-sm font-black">{log.timeFrom}</Badge>
                              <span className="text-muted-foreground font-bold">to</span>
                              <Badge variant="outline" className="rounded-sm font-black">{log.timeTo}</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 pt-2">
                          <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Incident Details</Label>
                          <div className="text-sm text-foreground bg-muted/20 p-4 rounded-lg border border-dashed border-primary/20 leading-relaxed italic">
                            {log.details || "No details provided."}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Tags & Management */}
                      <div className="flex flex-col justify-between w-full md:w-44 gap-4">
                        <div className="flex flex-wrap gap-1.5 content-start">
                          {log.isTeamsRelated && <Badge className="bg-blue-600 hover:bg-blue-600 text-[8px] font-black h-5">TEAMS</Badge>}
                          {log.isTicketerRelated && <Badge className="bg-orange-600 hover:bg-orange-600 text-[8px] font-black h-5">TICKETER</Badge>}
                          {log.isEPMRelated && <Badge className="bg-green-600 hover:bg-green-600 text-[8px] font-black h-5">EPM</Badge>}
                          {log.isIRRelated && <Badge variant="destructive" className="text-[8px] font-black h-5">IR</Badge>}
                          {log.isTSIRelated && <Badge className="bg-purple-600 hover:bg-purple-600 text-[8px] font-black h-5">TSI</Badge>}
                          {log.isDriverReportRelated && <Badge variant="secondary" className="border border-foreground/30 text-[8px] font-black h-5">REPORT</Badge>}
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-destructive self-end font-bold text-xs"
                          onClick={() => {
                            if(confirm("Delete this record?")) {
                              deleteDocumentNonBlocking(doc(callLogsRef!, log.id));
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Entry
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-muted-foreground border-4 border-dashed rounded-2xl bg-muted/5">
              <Plus className="h-16 w-16 opacity-10 mb-4" />
              <p className="font-black text-sm uppercase tracking-[0.3em] opacity-40">No shift logs found</p>
              <Button variant="link" onClick={handleStartNewEntry} className="mt-2 font-bold">Create first entry now</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

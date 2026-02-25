'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Clock, Plus, Trash2, Save, AlertTriangle, User, Hash, History, Home, Coffee, FileText } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface DrivingSegment {
  start: string;
  end: string;
}

interface Record {
  id: string;
  driverName: string;
  employeeNumber: string;
  date: string;
  segments: DrivingSegment[];
  totalDrivingMinutes: number;
  totalShiftMinutes: number;
  maxContinuousMins: number;
  hasBreach: boolean;
  breachTypes: string[];
  createdAt: any;
}

const LIMIT_CONTINUOUS_MINS = 5.5 * 60; // 330 mins
const LIMIT_DAILY_DRIVING_MINS = 10 * 60; // 600 mins
const LIMIT_SHIFT_MINS = 16 * 60; // 960 mins

export default function DriversHoursPage() {
  const [driverName, setDriverName] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [segments, setSegments] = useState<DrivingSegment[]>([{ start: '', end: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  const historyQuery = useMemoFirebase(() => 
    query(collection(firestore, 'driverHours'), orderBy('createdAt', 'desc'), limit(50)),
    [firestore]
  );
  const { data: history, isLoading: isHistoryLoading } = useCollection<Record>(historyQuery);

  const addSegment = () => setSegments([...segments, { start: '', end: '' }]);
  
  const removeSegment = (index: number) => {
    if (segments.length > 1) {
      setSegments(segments.filter((_, i) => i !== index));
    }
  };

  const updateSegment = (index: number, field: keyof DrivingSegment, value: string) => {
    const newSegments = [...segments];
    newSegments[index][field] = value;
    setSegments(newSegments);
  };

  const calculations = useMemo(() => {
    const sortedSegments = [...segments]
      .filter(s => s.start && s.end)
      .sort((a, b) => a.start.localeCompare(b.start));

    let totalDrivingMinutes = 0;
    let maxContinuousMins = 0;
    let currentContinuousMins = 0;
    let earliestStart = '';
    let latestEnd = '';
    let breaksDetected = 0;

    sortedSegments.forEach((s, idx) => {
      const [h1, m1] = s.start.split(':').map(Number);
      const [h2, m2] = s.end.split(':').map(Number);
      const startMins = h1 * 60 + m1;
      const endMins = h2 * 60 + m2;
      const duration = endMins >= startMins ? endMins - startMins : (1440 - startMins + endMins);

      totalDrivingMinutes += duration;

      if (idx > 0) {
        const prev = sortedSegments[idx - 1];
        const [ph2, pm2] = prev.end.split(':').map(Number);
        const prevEndMins = ph2 * 60 + pm2;
        
        let gap = startMins - prevEndMins;
        if (gap < 0) gap += 1440; // Overnight gap

        if (gap >= 30) {
          // Meal break detected (>= 30 mins)
          breaksDetected++;
          currentContinuousMins = duration;
        } else {
          // Continuity maintained
          currentContinuousMins += duration;
        }
      } else {
        currentContinuousMins = duration;
      }

      if (currentContinuousMins > maxContinuousMins) {
        maxContinuousMins = currentContinuousMins;
      }

      if (!earliestStart || s.start < earliestStart) earliestStart = s.start;
      if (!latestEnd || s.end > latestEnd) latestEnd = s.end;
    });

    let totalShiftMinutes = 0;
    if (earliestStart && latestEnd) {
      const [h1, m1] = earliestStart.split(':').map(Number);
      const [h2, m2] = latestEnd.split(':').map(Number);
      const startMins = h1 * 60 + m1;
      const endMins = h2 * 60 + m2;
      totalShiftMinutes = endMins >= startMins ? endMins - startMins : (1440 - startMins + endMins);
    }

    const breaches = [];
    if (maxContinuousMins > LIMIT_CONTINUOUS_MINS) breaches.push('Continuous Driving (> 5.5h between breaks)');
    if (totalDrivingMinutes > LIMIT_DAILY_DRIVING_MINS) breaches.push('Daily Driving (> 10h total)');
    if (totalShiftMinutes > LIMIT_SHIFT_MINS) breaches.push('Shift Duration (> 16h)');

    return { totalDrivingMinutes, totalShiftMinutes, maxContinuousMins, breaches, breaksDetected };
  }, [segments]);

  const handleSave = async () => {
    if (!driverName || !employeeNumber) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter driver details.' });
      return;
    }

    if (segments.some(s => !s.start || !s.end)) {
        toast({ variant: 'destructive', title: 'Incomplete Entry', description: 'Please fill in all start and end times.' });
        return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'driverHours'), {
        driverName,
        employeeNumber,
        date: new Date().toISOString().split('T')[0],
        segments,
        totalDrivingMinutes: calculations.totalDrivingMinutes,
        totalShiftMinutes: calculations.totalShiftMinutes,
        maxContinuousMins: calculations.maxContinuousMins,
        hasBreach: calculations.breaches.length > 0,
        breachTypes: calculations.breaches,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Success', description: 'Record saved successfully.' });
      setSegments([{ start: '', end: '' }]);
      setDriverName('');
      setEmployeeNumber('');
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'driverHours', id));
    toast({ title: 'Record Deleted' });
  };

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Drivers Hours Tracker</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/"><Home className="mr-2 h-4 w-4" /> Home</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Shift Entry Form */}
          <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  New Shift Entry
              </CardTitle>
              <CardDescription>Log driving segments. Gaps of 30+ mins count as legal breaks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="driver-name">Driver Name</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="driver-name" 
                      placeholder="John Doe" 
                      className="pl-9 bg-muted/20"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-number">Employee Number</Label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="employee-number" 
                      placeholder="12345" 
                      className="pl-9 bg-muted/20"
                      value={employeeNumber}
                      onChange={(e) => setEmployeeNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Driving Segments</Label>
                {segments.map((seg, idx) => (
                  <div key={idx} className="flex items-end gap-3 p-3 rounded-lg bg-muted/10 border border-transparent hover:border-primary/20 transition-colors group">
                    <div className="grid grid-cols-2 gap-4 flex-grow">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Start Time</span>
                        <Input 
                          type="time" 
                          className="bg-background"
                          value={seg.start} 
                          onChange={(e) => updateSegment(idx, 'start', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">End Time</span>
                        <Input 
                          type="time" 
                          className="bg-background"
                          value={seg.end} 
                          onChange={(e) => updateSegment(idx, 'end', e.target.value)}
                        />
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0"
                      onClick={() => removeSegment(idx)}
                      disabled={segments.length === 1}
                      title="Delete segment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" className="w-full border-dashed py-6 hover:bg-primary/5 hover:border-primary/50 transition-all" onClick={addSegment}>
                  <Plus className="mr-2 h-4 w-4" /> Add Segment
                </Button>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 pt-6 rounded-b-lg">
              <Button className="w-full h-12 text-lg font-bold" onClick={handleSave} disabled={isSubmitting}>
                <Save className="mr-2 h-5 w-5" /> Save Records to Log
              </Button>
            </CardFooter>
          </Card>

          {/* Real-time Compliance Check */}
          <Card className="border-primary/20 bg-primary/5 shadow-md h-fit">
            <CardHeader>
              <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Real-time Compliance Check</CardTitle>
                  {calculations.breaksDetected > 0 && (
                      <Badge variant="outline" className="bg-white/80 border-primary/20 text-[10px] font-bold">
                          <Coffee className="h-3 w-3 mr-1 text-primary" /> {calculations.breaksDetected} BREAKS
                      </Badge>
                  )}
              </div>
              <CardDescription>GB Domestic Hours Calculations for Current Entry</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-primary/10 pb-4 sm:pb-0 pr-4">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Daily Driving</span>
                  <span className={`text-2xl font-black tabular-nums ${calculations.totalDrivingMinutes > LIMIT_DAILY_DRIVING_MINS ? 'text-destructive' : 'text-primary'}`}>
                    {formatMins(calculations.totalDrivingMinutes)}
                  </span>
                </div>
                <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-primary/10 pb-4 sm:pb-0 pr-4">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Peak block</span>
                  <span className={`text-2xl font-black tabular-nums ${calculations.maxContinuousMins > LIMIT_CONTINUOUS_MINS ? 'text-destructive' : 'text-foreground'}`}>
                    {formatMins(calculations.maxContinuousMins)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Shift length</span>
                  <span className={`text-2xl font-black tabular-nums ${calculations.totalShiftMinutes > LIMIT_SHIFT_MINS ? 'text-destructive' : 'text-foreground'}`}>
                    {formatMins(calculations.totalShiftMinutes)}
                  </span>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                    <span>Break Requirement (5.5h)</span>
                    <span className="text-primary">{formatMins(Math.max(0, LIMIT_CONTINUOUS_MINS - calculations.maxContinuousMins))} LEFT</span>
                  </div>
                  <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden border border-primary/5">
                    <div 
                      className={`h-full transition-all duration-500 ${calculations.maxContinuousMins > LIMIT_CONTINUOUS_MINS ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, (calculations.maxContinuousMins / LIMIT_CONTINUOUS_MINS) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                    <span>Daily 10h Limit</span>
                    <span className="text-orange-600">{formatMins(Math.max(0, LIMIT_DAILY_DRIVING_MINS - calculations.totalDrivingMinutes))} LEFT</span>
                  </div>
                  <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden border border-primary/5">
                    <div 
                      className={`h-full transition-all duration-500 ${calculations.totalDrivingMinutes > LIMIT_DAILY_DRIVING_MINS ? 'bg-destructive' : 'bg-orange-500'}`}
                      style={{ width: `${Math.min(100, (calculations.totalDrivingMinutes / LIMIT_DAILY_DRIVING_MINS) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {calculations.breaches.length > 0 && (
                <Alert variant="destructive" className="border-4 shadow-lg animate-pulse mt-4">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="font-black text-xs uppercase">Regulation Breach</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-[10px] mt-2 font-bold space-y-1">
                      {calculations.breaches.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History Log */}
        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Drivers Hours Log</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-bold">Latest 50 Records</Badge>
          </CardHeader>
          <CardContent>
            {isHistoryLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <Clock className="h-8 w-8 animate-pulse" />
                    <p className="text-sm">Loading records...</p>
                </div>
            ) : history && history.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Driving Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => (
                    <TableRow key={record.id} className="group">
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{record.date}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{record.driverName}</span>
                          <span className="text-[10px] text-muted-foreground">ID: {record.employeeNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold">{formatMins(record.totalDrivingMinutes)} total</span>
                            <span className="text-[10px] text-muted-foreground italic">Max block: {formatMins(record.maxContinuousMins)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.hasBreach ? (
                          <Badge variant="destructive" className="font-black text-[10px]">BREACH</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 text-[10px]">COMPLIANT</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteRecord(record.id)} 
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <History className="h-10 w-10 opacity-20 mb-2" />
                    <p className="text-sm font-medium">No driving records found in history.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

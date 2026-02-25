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
import { Clock, Plus, Trash2, Save, AlertTriangle, User, Hash, History, Home, Coffee, FileText, Info, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Custom Steering Wheel Icon
const SteeringWheelIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="9" x2="12" y2="2" />
    <line x1="9.39" y1="13.5" x2="3.34" y2="15.5" />
    <line x1="14.61" y1="13.5" x2="20.66" y2="15.5" />
  </svg>
);

interface DrivingSegment {
  start: string;
  end: string;
  type: 'driving' | 'break';
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
  const [segments, setSegments] = useState<DrivingSegment[]>([{ start: '', end: '', type: 'driving' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  const historyQuery = useMemoFirebase(() => 
    query(collection(firestore, 'driverHours'), orderBy('createdAt', 'desc'), limit(50)),
    [firestore]
  );
  const { data: history, isLoading: isHistoryLoading } = useCollection<Record>(historyQuery);

  const addDrivingSegment = () => setSegments([...segments, { start: '', end: '', type: 'driving' }]);
  const addBreakSegment = () => setSegments([...segments, { start: '', end: '', type: 'break' }]);
  
  const removeSegment = (index: number) => {
    if (segments.length > 1) {
      setSegments(segments.filter((_, i) => i !== index));
    }
  };

  const updateSegment = (index: number, field: keyof DrivingSegment, value: string) => {
    const newSegments = [...segments];
    (newSegments[index][field] as string) = value;
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

    sortedSegments.forEach((s) => {
      const [h1, m1] = s.start.split(':').map(Number);
      const [h2, m2] = s.end.split(':').map(Number);
      const startMins = h1 * 60 + m1;
      const endMins = h2 * 60 + m2;
      const duration = endMins >= startMins ? endMins - startMins : (1440 - startMins + endMins);

      if (s.type === 'driving') {
        totalDrivingMinutes += duration;
        currentContinuousMins += duration;
      } else {
        // It's a break
        if (duration >= 30) {
          breaksDetected++;
          currentContinuousMins = 0; // Reset continuous block if break is >= 30 mins
        }
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
    if (maxContinuousMins > LIMIT_CONTINUOUS_MINS) breaches.push('Continuous Driving (> 5.5h without 30m break)');
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
      setSegments([{ start: '', end: '', type: 'driving' }]);
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
              <CardDescription>Log driving and breaks. 30+ min breaks reset the 5.5h clock.</CardDescription>
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
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Shift Timeline</Label>
                {segments.map((seg, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-end gap-3 p-3 rounded-lg border transition-colors group",
                      seg.type === 'break' ? "bg-muted/30 border-blue-200/50" : "bg-muted/10 border-transparent hover:border-primary/20"
                    )}
                  >
                    <div className="grid grid-cols-2 gap-4 flex-grow">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1.5 h-5">
                          {seg.type === 'break' ? <Coffee className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {seg.type === 'driving' ? 'Driving Start' : 'Break Start'}
                        </span>
                        <Input 
                          type="time" 
                          className="bg-background mt-1.5"
                          value={seg.start} 
                          onChange={(e) => updateSegment(idx, 'start', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1.5 h-5">
                          <span className="w-3.5" /> {/* Invisible spacer matching icon width */}
                          {seg.type === 'driving' ? 'Driving End' : 'Break End'}
                        </span>
                        <Input 
                          type="time" 
                          className="bg-background mt-1.5"
                          value={seg.end} 
                          onChange={(e) => updateSegment(idx, 'end', e.target.value)}
                        />
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0 mb-[1px]"
                      onClick={() => removeSegment(idx)}
                      disabled={segments.length === 1}
                      title="Delete segment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 border-dashed py-6 hover:bg-primary/5 hover:border-primary/50 transition-all" onClick={addDrivingSegment}>
                    <SteeringWheelIcon className="mr-2 h-4 w-4" /> Add Driving
                  </Button>
                  <Button variant="outline" className="flex-1 border-dashed py-6 border-blue-200 hover:bg-blue-50 transition-all" onClick={addBreakSegment}>
                    <Coffee className="mr-2 h-4 w-4 text-blue-500" /> Add Break
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 pt-6 rounded-b-lg">
              <Button className="w-full h-12 text-lg font-bold" onClick={handleSave} disabled={isSubmitting}>
                <Save className="mr-2 h-5 w-5" /> Save Records to Log
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-8 h-fit">
            {/* Real-time Compliance Check */}
            <Card className="border-primary/20 bg-primary/5 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Real-time Compliance Check</CardTitle>
                    {calculations.breaksDetected > 0 && (
                        <Badge variant="outline" className="bg-white/80 border-primary/20 text-[10px] font-bold">
                            <Coffee className="h-3 w-3 mr-1 text-primary" /> {calculations.breaksDetected} BREAKS (30m+)
                        </Badge>
                    )}
                </div>
                <CardDescription>GB Domestic Hours Calculations for Current Entry</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
                  <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-primary/10 pb-4 sm:pb-0 sm:pr-4">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Daily Driving</span>
                    <span className={cn(
                      "text-2xl font-black tabular-nums leading-none",
                      calculations.totalDrivingMinutes > LIMIT_DAILY_DRIVING_MINS ? 'text-destructive' : 'text-primary'
                    )}>
                      {formatMins(calculations.totalDrivingMinutes)}
                    </span>
                  </div>
                  <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-primary/10 py-4 sm:py-0 sm:px-4">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Cont. Driving</span>
                    <span className={cn(
                      "text-2xl font-black tabular-nums leading-none",
                      calculations.maxContinuousMins > LIMIT_CONTINUOUS_MINS ? 'text-destructive' : 'text-foreground'
                    )}>
                      {formatMins(calculations.maxContinuousMins)}
                    </span>
                  </div>
                  <div className="flex flex-col pt-4 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Shift length</span>
                    <span className={cn(
                      "text-2xl font-black tabular-nums leading-none",
                      calculations.totalShiftMinutes > LIMIT_SHIFT_MINS ? 'text-destructive' : 'text-foreground'
                    )}>
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

            {/* GB Domestic Rules Quick Guide */}
            <Card className="border-muted bg-muted/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  GB Domestic Rules Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <div className="flex items-start gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-bold">Daily Driving Limit</p>
                    <p className="text-muted-foreground">Maximum of <span className="text-foreground font-semibold">10 hours</span> driving in any working day.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-bold">Continuous Driving & Breaks</p>
                    <p className="text-muted-foreground">After <span className="text-foreground font-semibold">5.5 hours</span> of driving, a break of at least <span className="text-foreground font-semibold">30 minutes</span> must be taken for rest or refreshment.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-bold">Shift Length (Duty)</p>
                    <p className="text-muted-foreground">The maximum working day (spreadover) should not exceed <span className="text-foreground font-semibold">16 hours</span>.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">4</span>
                  </div>
                  <div>
                    <p className="font-bold">Daily Rest</p>
                    <p className="text-muted-foreground">Drivers must have at least <span className="text-foreground font-semibold">10 hours</span> rest between working days (can be reduced to 8.5h in some cases).</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
                            <span className="text-[10px] text-muted-foreground italic">Continuous: {formatMins(record.maxContinuousMins)}</span>
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

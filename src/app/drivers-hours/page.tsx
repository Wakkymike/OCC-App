'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Clock, Plus, Trash2, Save, AlertTriangle, User, Hash, History, Home, Coffee, FileText, Info, ChevronDown, ChevronUp, FileDown, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const { user } = useAuth();
  const [driverName, setDriverName] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [segments, setSegments] = useState<DrivingSegment[]>([{ start: '', end: '', type: 'driving' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Record[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  
  const { toast } = useToast();

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/driver-hours');
      if (res.ok) setHistory(await res.json());
    } catch (e) {
      console.error('Failed to fetch driver hours', e);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

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

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
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
        if (duration >= 30) {
          breaksDetected++;
          currentContinuousMins = 0;
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

    return { totalDrivingMinutes, totalShiftMinutes, maxContinuousMins, currentContinuousMins, breaches, breaksDetected };
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
      const res = await fetch('/api/driver-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName,
          employeeNumber,
          date: new Date().toLocaleDateString('en-GB'),
          segments,
          totalDrivingMinutes: calculations.totalDrivingMinutes,
          totalShiftMinutes: calculations.totalShiftMinutes,
          maxContinuousMins: calculations.maxContinuousMins,
          hasBreach: calculations.breaches.length > 0,
          breachTypes: calculations.breaches,
        }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Record saved successfully.' });
        setSegments([{ start: '', end: '', type: 'driving' }]);
        setDriverName('');
        setEmployeeNumber('');
        fetchHistory();
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!history || history.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No history records found to export.' });
      return;
    }

    setIsExporting(true);
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    
    try {
      const img = new Image();
      img.src = '/logo.jpg';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      if (img.complete && img.width > 0) {
        doc.addImage(img, 'JPEG', 10, 10, 40, 12);
      }
    } catch (e) {}

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Operational Drivers Hours Log', 60, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Exported by: ${user?.displayName || user?.email}`, 60, 24);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 60, 29);

    const tableData = history.map(record => {
      const timeline = record.segments.map(s => `${s.start}-${s.end} [${s.type === 'driving' ? 'D' : 'B'}]`).join(', ');
      return [
        record.date,
        record.driverName,
        record.employeeNumber,
        formatMins(record.totalDrivingMinutes),
        formatMins(record.totalShiftMinutes),
        record.hasBreach ? 'BREACH' : 'COMPLIANT',
        timeline
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Driver', 'ID', 'Driving Time', 'Shift Time', 'Status', 'Timeline']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        6: { cellWidth: 80 }
      }
    });

    doc.save(`Drivers-Hours-Export-${new Date().getTime()}.pdf`);
    setIsExporting(false);
    toast({ title: 'PDF Exported' });
  };

  const handleDeleteRecord = async (id: string) => {
    await fetch(`/api/driver-hours/${id}`, { method: 'DELETE' });
    setHistory(prev => prev.filter(r => r.id !== id));
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
                          <span className="w-3.5" />
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
                <CardDescription>GB Domestic Hours Calculations</CardDescription>
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
                      {formatMins(calculations.currentContinuousMins)}
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
                      <span className="text-primary">{formatMins(Math.max(0, LIMIT_CONTINUOUS_MINS - calculations.currentContinuousMins))} LEFT</span>
                    </div>
                    <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden border border-primary/5">
                      <div 
                        className={`h-full transition-all duration-500 ${calculations.currentContinuousMins > LIMIT_CONTINUOUS_MINS ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${Math.min(100, (calculations.currentContinuousMins / LIMIT_CONTINUOUS_MINS) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                      <span>Daily 10h Limit</span>
                      <span className="text-orange-700 font-bold">{formatMins(Math.max(0, LIMIT_DAILY_DRIVING_MINS - calculations.totalDrivingMinutes))} LEFT</span>
                    </div>
                    <div className="h-3 w-full bg-white/60 rounded-full overflow-hidden border border-primary/10 shadow-inner">
                      <div 
                        className={`h-full transition-all duration-500 ${calculations.totalDrivingMinutes > LIMIT_DAILY_DRIVING_MINS ? 'bg-destructive' : 'bg-orange-600'}`}
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

        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Drivers Hours Log</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isExporting || !history?.length}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Download Full Log (PDF)
              </Button>
              <Badge variant="outline" className="text-[10px] uppercase font-bold">Latest 50 Records</Badge>
            </div>
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
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Driving Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => (
                    <Fragment key={record.id}>
                      <TableRow className="group">
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRow(record.id)}>
                            {expandedRows.has(record.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
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
                              <span className="text-[10px] text-muted-foreground italic">Cont. Driving: {formatMins(record.maxContinuousMins)}</span>
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
                      {expandedRows.has(record.id) && (
                        <TableRow className="bg-muted/30 border-l-4 border-primary">
                          <TableCell colSpan={6} className="p-4">
                            <div className="space-y-3">
                              <p className="font-black text-[10px] uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                Shift Timeline Details
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {record.segments.map((seg, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2.5 rounded border bg-background shadow-sm">
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-muted-foreground font-bold uppercase">{seg.type}</span>
                                      <span className="font-mono text-sm font-black">{seg.start} - {seg.end}</span>
                                    </div>
                                    <Badge variant={seg.type === 'break' ? 'secondary' : 'outline'} className="text-[8px] font-black h-5">
                                      {seg.type.substring(0, 1).toUpperCase()}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                              {record.hasBreach && (
                                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                                  <p className="text-[10px] font-bold text-destructive uppercase mb-1">Identified Violations:</p>
                                  <ul className="text-xs font-medium text-destructive list-disc list-inside">
                                    {record.breachTypes.map((b, i) => <li key={i}>{b}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
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

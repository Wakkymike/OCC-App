'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Link as LinkIcon, 
  Clock, 
  MapPin, 
  AlertCircle, 
  Save, 
  Coffee,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  Settings,
  X,
  User as UserIcon,
  FileDown
} from 'lucide-react';
import { 
  format, 
  isAfter, 
  addDays, 
  isWithinInterval, 
  isSameDay, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths,
  addWeeks,
  subWeeks,
  startOfToday,
  startOfYear,
  endOfYear
} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Shift {
  id: string;
  summary: string;
  start: string; // ISO string from API
  end: string;   // ISO string from API
  location: string;
}

export default function ShiftDisplay({ userProfile }: { userProfile: any }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [icalUrl, setIcalUrl] = useState(userProfile?.icalUrl || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [calendarName, setCalendarName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View state - Strictly normalized to start of period
  const [viewType, setViewType] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(() => startOfMonth(new Date()));
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);

  const today = startOfToday();
  const todayRef = useRef<HTMLDivElement>(null);

  const fetchShifts = async (url: string) => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/shifts?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch shifts');
      setShifts(data.shifts);
      setCalendarName(data.calendarName || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.icalUrl) {
      fetchShifts(userProfile.icalUrl);
    }
  }, [userProfile?.icalUrl]);

  // Handle automatic jump to today on initial load or reset
  useEffect(() => {
    if (!isLoading && shifts.length > 0 && todayRef.current && !hasScrolledToToday) {
      // Small timeout to ensure DOM is fully ready within the scroll area
      const timeout = setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHasScrolledToToday(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, shifts, hasScrolledToToday]);

  const handleSaveUrl = () => {
    if (!user) return;
    setIsUpdating(true);
    const userDocRef = doc(firestore, 'userProfiles', user.uid);
    updateDocumentNonBlocking(userDocRef, { icalUrl });
    toast({ title: 'iCal Link Saved', description: 'Your rota calendar has been updated.' });
    fetchShifts(icalUrl);
    setIsUpdating(false);
    setShowSettings(false);
  };

  const currentShift = useMemo(() => {
    const now = new Date();
    return shifts.find(s => 
      isWithinInterval(now, { start: new Date(s.start), end: new Date(s.end) })
    );
  }, [shifts]);

  const nextShift = useMemo(() => {
    const now = new Date();
    return shifts.find(s => isAfter(new Date(s.start), now));
  }, [shifts]);

  const handleDownloadPDF = async (period: 'week' | 'month' | 'year') => {
    if (!shifts || shifts.length === 0) {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'No shift data found to download.' });
      return;
    }

    setIsExporting(true);
    const doc = new jsPDF();
    const now = new Date();
    
    // Determine interval
    let start, end, periodLabel;
    if (period === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      periodLabel = `Week of ${format(start, 'do MMM yyyy')}`;
    } else if (period === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
      periodLabel = format(now, 'MMMM yyyy');
    } else {
      start = startOfYear(now);
      end = endOfYear(now);
      periodLabel = `Year ${format(now, 'yyyy')}`;
    }

    // Add Logo - Using logo.jpg as requested
    try {
      const logoUrl = '/logo.jpg';
      const img = new Image();
      img.src = logoUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      doc.addImage(img, 'JPEG', 10, 10, 40, 12);
    } catch (e) {
      console.warn("PDF Logo could not be loaded, skipping.");
    }

    // Header Info
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Operational Rota Report', 60, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`User: ${user?.displayName || user?.email}`, 60, 24);
    doc.text(`Period: ${periodLabel}`, 60, 29);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 60, 34);

    // Filter and prepare data
    const daysInPeriod = eachDayOfInterval({ start, end });
    const tableData = daysInPeriod.map(day => {
      const dayShifts = shifts.filter(s => isSameDay(new Date(s.start), day));
      
      if (dayShifts.length === 0) {
        return [
          format(day, 'dd/MM/yyyy'),
          format(day, 'EEEE'),
          '--', '--',
          'REST DAY',
          '--'
        ];
      }

      // Handle multiple shifts on same day if any
      return dayShifts.map(s => [
        format(new Date(s.start), 'dd/MM/yyyy'),
        format(new Date(s.start), 'EEEE'),
        format(new Date(s.start), 'HH:mm'),
        format(new Date(s.end), 'HH:mm'),
        s.summary,
        s.location || '--'
      ]);
    }).flat();

    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Day', 'Start', 'End', 'Duty / Summary', 'Location']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.row.cells[4].text[0] === 'REST DAY') {
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.textColor = [150, 150, 150];
        }
      }
    });

    doc.save(`Rota-Export-${period}-${format(now, 'yyyyMMdd')}.pdf`);
    setIsExporting(false);
    toast({ title: 'PDF Generated', description: `Your ${period} rota has been downloaded.` });
  };

  // Generate selectable months (current + 11 more)
  const selectableMonths = useMemo(() => {
    const months = [];
    const start = startOfMonth(today);
    for (let i = 0; i < 12; i++) {
      months.push(addMonths(start, i));
    }
    return months;
  }, [today]);

  // Generate the timeline based on viewType and currentDate
  const timelineDays = useMemo(() => {
    let start, end;
    if (viewType === 'month') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    } else {
      start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    }

    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayShifts = shifts.filter(s => isSameDay(new Date(s.start), day));
      return {
        date: day,
        shifts: dayShifts,
        isRestDay: dayShifts.length === 0
      };
    });
  }, [shifts, viewType, currentDate]);

  const goToPrev = () => {
    setCurrentDate(prev => {
      if (viewType === 'month') {
        return startOfMonth(subMonths(prev, 1));
      } else {
        return startOfWeek(subWeeks(prev, 1), { weekStartsOn: 1 });
      }
    });
    setHasScrolledToToday(true); // Don't snap to today when manually navigating
  };

  const goToNext = () => {
    setCurrentDate(prev => {
      if (viewType === 'month') {
        return startOfMonth(addMonths(prev, 1));
      } else {
        return startOfWeek(addWeeks(prev, 1), { weekStartsOn: 1 });
      }
    });
    setHasScrolledToToday(true); // Don't snap to today when manually navigating
  };

  const handleViewTypeChange = (newView: 'month' | 'week') => {
    setViewType(newView);
    setCurrentDate(prev => {
      if (newView === 'month') {
        return startOfMonth(prev);
      } else {
        return startOfWeek(prev, { weekStartsOn: 1 });
      }
    });
  };

  const handleMonthSelect = (val: string) => {
    setCurrentDate(startOfMonth(new Date(val)));
    setViewType('month');
    setHasScrolledToToday(true);
  };

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      {(showSettings || !userProfile?.icalUrl) && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-primary" />
                <CardTitle>Rota Integration</CardTitle>
              </div>
              <CardDescription>Paste your iCal subscription link from your rota system here.</CardDescription>
            </div>
            {userProfile?.icalUrl && (
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="ical-url">iCal Subscription URL</Label>
              <Input 
                id="ical-url" 
                placeholder="https://example.com/rota.ics" 
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveUrl} disabled={isUpdating} className="self-end">
              {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
              Save Link
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Syncing your rota...</p>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-6 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Error: {error}. Check your link and try again.</p>
          </CardContent>
        </Card>
      ) : !userProfile?.icalUrl ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Provide an iCal link above to see your shifts here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  {calendarName || user?.displayName || 'My'} Rota
                </h2>
                <p className="text-xs text-muted-foreground italic">
                  {calendarName ? `Synced from ${calendarName}` : 'Personal shift schedule'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8" disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    Download PDF Rota
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownloadPDF('week')}>Current Week</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadPDF('month')}>Current Month</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadPDF('year')}>Current Year</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {!showSettings && (
                <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="h-8">
                  <Settings className="h-4 w-4 mr-2" />
                  Update iCal Link
                </Button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
              <Card className={currentShift ? "border-green-500 bg-green-50/50" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase text-muted-foreground font-bold flex items-center justify-between">
                    Current Status
                    {currentShift && <Badge className="bg-green-600">ON DUTY</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentShift ? (
                    <div className="space-y-2">
                      <h3 className="text-xl font-black">{currentShift.summary}</h3>
                      <div className="flex items-center text-sm gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{format(new Date(currentShift.start), 'HH:mm')} - {format(new Date(currentShift.end), 'HH:mm')}</span>
                      </div>
                      {currentShift.location && (
                        <div className="flex items-center text-xs text-muted-foreground gap-2">
                          <MapPin className="h-3 w-3" />
                          <span>{currentShift.location}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Coffee className="h-4 w-4" />
                      <span className="italic">Off Duty</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase text-muted-foreground font-bold">Next Shift</CardTitle>
                </CardHeader>
                <CardContent>
                  {nextShift ? (
                    <div className="space-y-2">
                      <h3 className="text-xl font-black">{nextShift.summary}</h3>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-sm font-bold gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{format(new Date(nextShift.start), 'EEEE, do MMM')}</span>
                        </div>
                        <div className="flex items-center text-sm gap-2 text-primary">
                          <Clock className="h-4 w-4" />
                          <span>Starts at {format(new Date(nextShift.start), 'HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">No future shifts found.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="md:col-span-2">
              <CardHeader className="border-b bg-muted/10 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>Shift Timeline</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Tabs value={viewType} onValueChange={(v: any) => handleViewTypeChange(v)} className="w-auto">
                      <TabsList className="h-8">
                        <TabsTrigger value="week" className="text-xs px-2 h-7"><CalendarRange className="h-3 w-3 mr-1"/> Week</TabsTrigger>
                        <TabsTrigger value="month" className="text-xs px-2 h-7"><CalendarDays className="h-3 w-3 mr-1"/> Month</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    
                    <Select onValueChange={handleMonthSelect} value={startOfMonth(currentDate).toISOString()}>
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue placeholder="Select Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableMonths.map((m) => (
                          <SelectItem key={m.toISOString()} value={m.toISOString()}>
                            {format(m, 'MMMM yyyy')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <Button variant="outline" size="sm" onClick={goToPrev} className="h-7 px-2">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {viewType === 'month' ? 'Prev Month' : 'Prev Week'}
                  </Button>
                  <span className="text-sm font-bold">
                    {viewType === 'month' 
                      ? format(currentDate, 'MMMM yyyy') 
                      : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'do MMM')}`
                    }
                  </span>
                  <Button variant="outline" size="sm" onClick={goToNext} className="h-7 px-2">
                    {viewType === 'month' ? 'Next Month' : 'Next Week'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]" key={`${viewType}-${currentDate.toISOString()}`}>
                  <div className="divide-y">
                    {timelineDays.map((item, idx) => {
                      const isToday = isSameDay(item.date, today);
                      return (
                        <div 
                          key={idx} 
                          ref={isToday ? todayRef : null}
                          className={cn(
                            "flex items-start gap-4 p-4 transition-colors",
                            item.isRestDay ? "bg-muted/5 opacity-60" : "hover:bg-muted/30",
                            isToday && "bg-green-50/50 border-l-4 border-green-500"
                          )}
                        >
                          <div className="w-16 shrink-0 text-center">
                            <p className={cn(
                              "text-[10px] uppercase font-bold",
                              item.date.getDay() === 0 || item.date.getDay() === 6 ? "text-destructive" : "text-muted-foreground"
                            )}>{format(item.date, 'EEE')}</p>
                            <p className="text-xl font-black leading-none">{format(item.date, 'd')}</p>
                            <p className="text-[10px] text-muted-foreground">{format(item.date, 'MMM')}</p>
                          </div>
                          
                          <div className="flex-grow pt-1">
                            {item.isRestDay ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Coffee className="h-3.5 w-3.5" />
                                <span className="text-sm font-medium italic">Rest Day</span>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {item.shifts.map(s => (
                                  <div key={s.id} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm leading-tight">{s.summary}</p>
                                      {isToday && currentShift?.id === s.id && (
                                        <Badge variant="outline" className="text-[8px] h-4 py-0 bg-green-100 text-green-700 border-green-200">ACTIVE</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(s.start), 'HH:mm')} - {format(new Date(s.end), 'HH:mm')}</span>
                                      {s.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.location}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

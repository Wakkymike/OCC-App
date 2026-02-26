'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, Timestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Phone, Trash2, Home, Loader2, Info, Clock, Calendar, CheckCircle2, Plus, X, User as UserIcon, MapPin, Bus, Hash, Building2, Pencil, Search, LayoutList, FileDown } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { subDays, format } from 'date-fns';
import type { CallLog } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SearchCategory = 'employeeNumber' | 'fleetNumber' | 'runningBoard';

export default function CallLogsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const hasCheckedRetention = useRef(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('employeeNumber');
  const [isExporting, setIsExporting] = useState(false);
  
  const [formData, setFormData] = useState({
    date: '',
    callTime: '',
    employeeNumber: '',
    fleetNumber: '',
    runningBoard: '',
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

  // Search filter logic - Strict filtering by category
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(log => {
      const valueToSearch = (log as any)[searchCategory];
      return valueToSearch?.toLowerCase().includes(q);
    });
  }, [logs, searchQuery, searchCategory]);

  // Auto-retention logic: Purge records older than 5 days
  useEffect(() => {
    if (!callLogsRef || !logs || logs.length === 0 || hasCheckedRetention.current) return;

    hasCheckedRetention.current = true;
    const fiveDaysAgo = subDays(new Date(), 5);
    
    const oldLogs = logs.filter(log => {
      if (!log.createdAt) return false;
      const createdDate = log.createdAt instanceof Timestamp ? log.createdAt.toDate() : new Timestamp(log.createdAt.seconds, log.createdAt.nanoseconds).toDate();
      return createdDate < fiveDaysAgo;
    });

    if (oldLogs.length > 0) {
      const batch = writeBatch(firestore);
      oldLogs.forEach(log => {
        batch.delete(doc(callLogsRef, log.id));
      });
      batch.commit().catch(e => console.error("Auto-purge failed", e));
    }
  }, [logs, callLogsRef, firestore]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Strictly limit Phone Number to 3 digits only
    if (name === 'phoneNumber') {
      const numericValue = value.replace(/\D/g, '').slice(0, 3);
      setFormData(prev => ({ ...prev, [name]: numericValue }));
      return;
    }

    // Force Depot to all capitals
    if (name === 'depot') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
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
      runningBoard: '',
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
    setEditingId(null);
    setShowForm(true);
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleEditLog = (log: CallLog) => {
    setFormData({
      date: log.date,
      callTime: log.callTime,
      employeeNumber: log.employeeNumber,
      fleetNumber: log.fleetNumber,
      runningBoard: log.runningBoard || '',
      serviceNumber: log.serviceNumber,
      depot: log.depot,
      phoneNumber: log.phoneNumber,
      timeFrom: log.timeFrom,
      timeTo: log.timeTo,
      details: log.details,
      isTeamsRelated: log.isTeamsRelated,
      isTicketerRelated: log.isTicketerRelated,
      isEPMRelated: log.isEPMRelated,
      isIRRelated: log.isIRRelated,
      isTSIRelated: log.isTSIRelated,
      isDriverReportRelated: log.isDriverReportRelated,
    });
    setEditingId(log.id);
    setShowForm(true);
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !callLogsRef) return;

    setIsSubmitting(true);

    if (editingId) {
      const logDocRef = doc(firestore, 'users', user.uid, 'callLogs', editingId);
      updateDocumentNonBlocking(logDocRef, formData);
      toast({ title: 'Log Updated', description: 'Changes saved successfully.' });
      setShowForm(false);
      setEditingId(null);
      setIsSubmitting(false);
    } else {
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
    }
  };

  const handleDeleteSingle = (logId: string) => {
    if (!callLogsRef) return;
    deleteDocumentNonBlocking(doc(callLogsRef, logId));
    toast({ title: 'Record Deleted' });
  };

  const handleDownloadPDF = async () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'No records found to download.' });
      return;
    }

    setIsExporting(true);
    const doc = new jsPDF();
    
    // Add Logo to top left
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

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Operational Call Log Report', 60, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated by: ${user?.displayName || user?.email}`, 60, 24);
    doc.text(`Date: ${new Date().toLocaleString()}`, 60, 29);
    doc.text(`Total Records: ${filteredLogs.length}`, 60, 34);

    const tableData = filteredLogs.map(log => {
      const activeTags = [];
      if (log.isTeamsRelated) activeTags.push('Teams');
      if (log.isTicketerRelated) activeTags.push('Ticketer');
      if (log.isEPMRelated) activeTags.push('EPM');
      if (log.isIRRelated) activeTags.push('IR');
      if (log.isTSIRelated) activeTags.push('TSI');
      if (log.isDriverReportRelated) activeTags.push('Report');

      return [
        log.date,
        log.callTime,
        log.employeeNumber,
        log.depot,
        log.fleetNumber,
        log.runningBoard || '--',
        log.serviceNumber,
        log.details,
        activeTags.join(', ') || '--',
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Time', 'Emp', 'Depot', 'Fleet', 'RB', 'Svc', 'Details', 'Tags']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        7: { cellWidth: 50 },
        8: { cellWidth: 30 }
      }
    });

    doc.save(`OCC-Log-Export-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
    setIsExporting(false);
    toast({ title: 'PDF Generated', description: 'Operational report downloaded successfully.' });
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-6xl space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="p-2 border-primary/20 bg-primary/5">
              <Clock className="h-6 w-6 text-primary" />
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">OCC Call Logs</h1>
              <p className="text-muted-foreground text-sm font-medium italic">Personal operational log tracker.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showForm && (
              <Button onClick={handleStartNewEntry} className="font-bold">
                <Plus className="mr-2 h-4 w-4" /> Start New Entry
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isExporting || !filteredLogs.length}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              {isExporting ? 'Downloading...' : 'Download Shift Report (PDF)'}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/"><Home className="mr-2 h-4 w-4" /> Home</Link>
            </Button>
          </div>
        </div>

        {/* Disclaimer Section */}
        <Card className="border-destructive/30 bg-destructive/5 shadow-none ring-1 ring-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs flex items-center gap-2 text-destructive font-black uppercase tracking-widest">
              <Info className="h-4 w-4" />
              Operational Security Requirement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-bold text-destructive/90 leading-relaxed">
              All staff are required to manage their private logs. Records are strictly private to your account. Automated purging occurs for records older than 5 days.
            </p>
          </CardContent>
        </Card>

        {/* Form Section */}
        {showForm && (
          <div ref={formRef} className="animate-in fade-in slide-in-from-top-4 duration-300">
            <Card className="shadow-lg border-primary/20 bg-muted/5">
              <CardHeader className="bg-muted/30 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                    {editingId ? 'Edit Operational Record' : 'Record New Event'}
                  </CardTitle>
                  <CardDescription>Populate all fields accurately for operational tracking.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Date</Label>
                      <Input name="date" placeholder="DD/MM/YYYY" value={formData.date} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Time</Label>
                      <Input type="time" name="callTime" value={formData.callTime} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Employee Number</Label>
                      <Input name="employeeNumber" value={formData.employeeNumber} onChange={handleInputChange} required />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Depot</Label>
                      <Input name="depot" value={formData.depot} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Fleet Number</Label>
                      <Input name="fleetNumber" value={formData.fleetNumber} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Running Board</Label>
                      <Input name="runningBoard" value={formData.runningBoard} onChange={handleInputChange} required />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Service Number</Label>
                      <Input name="serviceNumber" value={formData.serviceNumber} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Phone Number (3-Dig)</Label>
                      <Input name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Time From</Label>
                      <Input type="time" name="timeFrom" value={formData.timeFrom} onChange={handleInputChange} required />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Time To</Label>
                      <Input type="time" name="timeTo" value={formData.timeTo} onChange={handleInputChange} required />
                    </div>

                    {/* Checkboxes Row */}
                    <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-3 pt-6 border-t">
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

                  <div className="space-y-2 mt-6">
                    <Label className="text-xs font-black uppercase text-muted-foreground">Event Details</Label>
                    <Textarea name="details" value={formData.details} onChange={handleInputChange} required className="min-h-[100px] bg-background" />
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/20 py-4 px-6 mt-6 rounded-b-lg">
                  <Button type="submit" className="w-full font-bold h-12" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                    {editingId ? 'Save Changes' : 'Save Operational Record'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* History Section */}
        <div className="space-y-6">
          <div className="flex flex-col gap-4 border-b pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tighter uppercase">Recent Operational History</h2>
              {logs && logs.length > 0 && <Badge className="font-black bg-primary text-primary-foreground">{logs.length} RECORDS</Badge>}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl">
              <div className="flex-grow relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={`Search records...`} 
                  className="pl-10 h-10 bg-muted/20 border-primary/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={searchCategory} onValueChange={(v: SearchCategory) => setSearchCategory(v)}>
                <SelectTrigger className="w-full sm:w-[200px] h-10 bg-muted/20 border-primary/10">
                  <SelectValue placeholder="Search by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employeeNumber">Employee Number</SelectItem>
                  <SelectItem value="fleetNumber">Fleet Number</SelectItem>
                  <SelectItem value="runningBoard">Running Board</SelectItem>
                </SelectContent>
              </Select>
              {searchQuery && (
                <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')} className="h-10 w-10">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-black text-xs uppercase tracking-widest opacity-50">Syncing Secure Logs...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredLogs.map((log) => (
                <Card key={log.id} className="overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-all">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-4 flex-shrink-0 w-full md:w-48 border-r md:pr-6">
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
                        
                        <div className="space-y-1 pt-2 border-t">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="text-xs uppercase font-black tracking-widest">Depot</span>
                          </div>
                          <div className="text-xl font-black text-foreground truncate leading-none uppercase" title={log.depot}>
                            {log.depot}
                          </div>
                        </div>
                      </div>

                      <div className="flex-grow space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest">Fleet Number</Label>
                            <div className="flex items-center gap-2 font-bold text-sm">
                              <Bus className="h-3.5 w-3.5 text-primary" />
                              <span>{log.fleetNumber}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest">Running Board</Label>
                            <div className="flex items-center gap-2 font-bold text-sm">
                              <LayoutList className="h-3.5 w-3.5 text-primary" />
                              <span>{log.runningBoard || '--'}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest">Employee</Label>
                            <div className="flex items-center gap-2 font-bold text-sm">
                              <UserIcon className="h-3.5 w-3.5 text-primary" />
                              <span>{log.employeeNumber}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest">Service</Label>
                            <div className="flex items-center gap-2 font-bold text-sm">
                              <Hash className="h-3.5 w-3.5 text-primary" />
                              <span>{log.serviceNumber}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest">Phone Number</Label>
                            <div className="flex items-center gap-2 font-bold text-sm">
                              <Phone className="h-3.5 w-3.5 text-primary" />
                              <span>{log.phoneNumber}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest">Time From / To</Label>
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <Badge variant="outline" className="rounded-sm font-black">{log.timeFrom}</Badge>
                              <span className="text-muted-foreground font-bold">-</span>
                              <Badge variant="outline" className="rounded-sm font-black">{log.timeTo}</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 pt-2">
                          <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest">Incident Narrative</Label>
                          <div className="text-sm text-foreground bg-muted/20 p-4 rounded-lg border border-dashed border-primary/20 leading-relaxed italic">
                            {log.details || "No details recorded."}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between w-full md:w-44 gap-4 border-l md:pl-6">
                        <div className="flex flex-wrap gap-1.5 content-start">
                          {log.isTeamsRelated && <Badge className="bg-blue-600 hover:bg-blue-600 text-[8px] font-black h-5">TEAMS</Badge>}
                          {log.isTicketerRelated && <Badge className="bg-orange-600 hover:bg-orange-600 text-[8px] font-black h-5">TICKETER</Badge>}
                          {log.isEPMRelated && <Badge className="bg-green-600 hover:bg-green-600 text-[8px] font-black h-5">EPM</Badge>}
                          {log.isIRRelated && <Badge variant="destructive" className="text-[8px] font-black h-5">IR</Badge>}
                          {log.isTSIRelated && <Badge className="bg-purple-600 hover:bg-purple-600 text-[8px] font-black h-5">TSI</Badge>}
                          {log.isDriverReportRelated && <Badge variant="secondary" className="border border-foreground/30 text-[8px] font-black h-5">REPORT</Badge>}
                        </div>
                        
                        <div className="flex flex-col gap-2 mt-auto">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 font-bold text-xs justify-start"
                            onClick={() => handleEditLog(log)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Record
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-bold text-xs justify-start"
                            onClick={() => handleDeleteSingle(log.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Record
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-muted-foreground border-4 border-dashed rounded-2xl bg-muted/5">
              {searchQuery ? (
                <Search className="h-16 w-16 opacity-10 mb-4" />
              ) : (
                <Plus className="h-16 w-16 opacity-10 mb-4" />
              )}
              <p className="font-black text-sm uppercase tracking-[0.3em] opacity-40">
                {searchQuery ? 'No matching logs found' : 'No shift logs found'}
              </p>
              {!showForm && !searchQuery && (
                <Button variant="link" onClick={handleStartNewEntry} className="mt-2 font-bold">Create first entry now</Button>
              )}
              {searchQuery && (
                <Button variant="link" onClick={() => setSearchQuery('')} className="mt-2 font-bold">Clear search filter</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

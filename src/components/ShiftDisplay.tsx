
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Link as LinkIcon, Clock, MapPin, AlertCircle, Save } from 'lucide-react';
import { format, isAfter, isBefore, addDays, isWithinInterval } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = async (url: string) => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/shifts?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch shifts');
      setShifts(data.shifts);
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

  const handleSaveUrl = () => {
    if (!user) return;
    setIsUpdating(true);
    const userDocRef = doc(firestore, 'userProfiles', user.uid);
    updateDocumentNonBlocking(userDocRef, { icalUrl });
    toast({ title: 'iCal Link Saved', description: 'Your rota calendar has been updated.' });
    fetchShifts(icalUrl);
    setIsUpdating(false);
  };

  const now = new Date();

  const currentShift = useMemo(() => {
    return shifts.find(s => 
      isWithinInterval(now, { start: new Date(s.start), end: new Date(s.end) })
    );
  }, [shifts, now]);

  const nextShift = useMemo(() => {
    return shifts.find(s => isAfter(new Date(s.start), now));
  }, [shifts, now]);

  const upcomingShifts = useMemo(() => {
    const nextWeek = addDays(now, 7);
    return shifts.filter(s => 
      isAfter(new Date(s.start), now) && 
      isBefore(new Date(s.start), nextWeek) &&
      s.id !== nextShift?.id
    );
  }, [shifts, now, nextShift]);

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            <CardTitle>Rota Integration</CardTitle>
          </div>
          <CardDescription>Paste your iCal subscription link from your rota system here.</CardDescription>
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
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Provide an iCal link above to see your shifts here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className={currentShift ? "border-green-500 bg-green-50/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase text-muted-foreground font-bold flex items-center justify-between">
                  Current Shift
                  {currentShift && <Badge className="bg-green-600">LIVE</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentShift ? (
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black">{currentShift.summary}</h3>
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
                  <p className="text-muted-foreground italic">You are currently off duty.</p>
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
                    <h3 className="text-2xl font-black">{nextShift.summary}</h3>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center text-sm font-bold gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(nextShift.start), 'EEEE, do MMMM')}</span>
                      </div>
                      <div className="flex items-center text-sm gap-2 text-primary">
                        <Clock className="h-4 w-4" />
                        <span>Starts at {format(new Date(nextShift.start), 'HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No upcoming shifts found in calendar.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Schedule</CardTitle>
              <CardDescription>Next 7 days of duty</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingShifts.length > 0 ? upcomingShifts.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-bold text-sm">{s.summary}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(s.start), 'EEE d MMM, HH:mm')}</p>
                    </div>
                    <Badge variant="outline">{format(new Date(s.start), 'EEE')}</Badge>
                  </div>
                )) : (
                  <p className="text-center py-8 text-muted-foreground text-sm">No further shifts scheduled for this week.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

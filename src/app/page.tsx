
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Map, Radio, Shield, Route, Loader2, ShieldAlert, Clock, Calendar, Coffee, ClipboardList } from 'lucide-react';
import UserMenu from '@/components/auth/UserMenu';
import TickerTape from '@/components/TickerTape';
import BreakingNewsTicker from '@/components/BreakingNewsTicker';
import NetworkUpdatesBox from '@/components/NetworkUpdatesBox';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { format, isWithinInterval, isAfter } from 'date-fns';

export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

  const [shifts, setShifts] = useState<any[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);

  useEffect(() => {
    if (userProfile?.icalUrl) {
      setIsLoadingShifts(true);
      fetch(`/api/shifts?url=${encodeURIComponent(userProfile.icalUrl)}`)
        .then(res => res.json())
        .then(data => {
          if (data.shifts) {
            setShifts(data.shifts);
          }
        })
        .catch(err => console.error("Failed to fetch shifts for header:", err))
        .finally(() => setIsLoadingShifts(false));
    }
  }, [userProfile?.icalUrl]);

  const now = new Date();
  const currentShift = shifts.find(s => 
    isWithinInterval(now, { start: new Date(s.start), end: new Date(s.end) })
  );
  const nextShift = shifts.find(s => isAfter(new Date(s.start), now));

  const isSuperAdmin = user?.email === 'michael.dodsworth@gonorthwest.co.uk';
  const isAdmin = userProfile?.isAdmin === true || isSuperAdmin;
  const isContentCreator = userProfile?.isContentCreator === true;
  const canAccessAdmin = isAdmin || isContentCreator;

  return (
    <div className="flex flex-col h-screen bg-background">
        <BreakingNewsTicker />
        <div className="relative flex-grow overflow-y-auto">
            <div className="absolute top-4 right-4 z-10">
                <UserMenu />
            </div>
            
            <main className="flex flex-col items-center p-8 gap-8">
                <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-6xl mb-4 gap-6 px-4">
                    {/* Left: Current Status */}
                    <div className="flex-1 flex justify-start w-full md:w-auto h-20">
                        {userProfile?.icalUrl && !isLoadingShifts && (
                            <div className="text-left w-full">
                                {currentShift ? (
                                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                                        <Badge className="bg-green-600 hover:bg-green-700 mb-1 font-black text-[10px]">ON DUTY</Badge>
                                        <p className="text-sm font-bold truncate max-w-[200px] lg:max-w-[300px] leading-tight">{currentShift.summary}</p>
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <Clock className="h-3 w-3" />
                                            Finishes at {format(new Date(currentShift.end), 'HH:mm')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground opacity-60">
                                        <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <Coffee className="h-3 w-3" /> Current Status
                                        </p>
                                        <p className="text-sm font-bold italic">Off Duty</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {isLoadingShifts && <div className="h-4 w-24 bg-muted animate-pulse rounded self-center" />}
                    </div>

                    {/* Center: Main Title */}
                    <div className="text-center shrink-0 px-4">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl drop-shadow-sm">
                        OCC App
                        </h1>
                        <p className="mt-4 text-lg leading-8 text-muted-foreground max-w-md mx-auto hidden sm:block">
                        Live bus tracking and service information.
                        </p>
                    </div>

                    {/* Right: Next Shift */}
                    <div className="flex-1 flex justify-end w-full md:w-auto h-20">
                        {userProfile?.icalUrl && !isLoadingShifts && (
                            <div className="text-right w-full">
                                {nextShift ? (
                                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center justify-end gap-1">
                                            <Calendar className="h-3 w-3" /> Next Duty
                                        </p>
                                        <p className="text-sm font-bold leading-tight truncate max-w-[200px] lg:max-w-[300px] ml-auto">{nextShift.summary}</p>
                                        <p className="text-xs text-primary font-bold mt-0.5">
                                            {format(new Date(nextShift.start), 'EEE, do MMM @ HH:mm')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground opacity-60">
                                        <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                                            <Calendar className="h-3 w-3" /> Next Duty
                                        </p>
                                        <p className="text-sm font-bold italic">None Scheduled</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {isLoadingShifts && <div className="h-4 w-24 bg-muted animate-pulse rounded self-center" />}
                    </div>
                </div>

                <div className="w-full max-w-6xl space-y-12">
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                      <Button asChild size="lg">
                          <Link href="/map">
                          <Map className="mr-2 h-5 w-5" />
                          Live Bus Map
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="destructive" className="bg-destructive hover:bg-destructive/90 animate-pulse">
                          <Link href="/rra">
                          <ShieldAlert className="mr-2 h-5 w-5" />
                          RRA Dashboard
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="secondary">
                          <Link href="/call-logs">
                          <ClipboardList className="mr-2 h-5 w-5" />
                          Call Logs
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="outline">
                          <Link href="/journey-planner">
                          <Route className="mr-2 h-5 w-5" />
                          Journey Planner
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="outline">
                          <Link href="/shifts">
                          <Calendar className="mr-2 h-5 w-5" />
                          My Shifts
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="outline">
                          <Link href="/drivers-hours">
                          <Clock className="mr-2 h-5 w-5" />
                          Drivers Hours
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="outline">
                          <Link href="/timetable">
                          <Radio className="mr-2 h-5 w-5" />
                          Live Service Board
                          </Link>
                      </Button>

                      {isUserLoading || isProfileLoading ? (
                           <Button size="lg" variant="secondary" disabled>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Checking Access...
                          </Button>
                      ) : canAccessAdmin ? (
                          <Button asChild size="lg" variant="secondary">
                              <Link href="/admin">
                              <Shield className="mr-2 h-5 w-5" />
                              Admin Panel
                              </Link>
                          </Button>
                      ) : null}
                    </div>

                    <div className="flex justify-center">
                      <NetworkUpdatesBox />
                    </div>
                </div>
            </main>
        </div>
        <footer className="w-full flex-shrink-0">
            <TickerTape />
        </footer>
    </div>
  );
}

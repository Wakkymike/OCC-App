'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Map, Radio, Shield, Route, Loader2 } from 'lucide-react';
import UserMenu from '@/components/auth/UserMenu';
import TickerTape from '@/components/TickerTape';
import BreakingNewsTicker from '@/components/BreakingNewsTicker';
import NetworkUpdatesBox from '@/components/NetworkUpdatesBox';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<{ 
    isAdmin: boolean; 
    isContentCreator: boolean 
  }>(userProfileRef);

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
            <main className="flex flex-col items-center justify-center p-8 gap-12">
                <div className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                    OCC App
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-muted-foreground">
                    Your portal for live bus tracking and service information.
                    </p>
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                    <Button asChild size="lg">
                        <Link href="/map">
                        <Map className="mr-2 h-5 w-5" />
                        Live Bus Map
                        </Link>
                    </Button>
                    <Button asChild size="lg">
                        <Link href="/journey-planner">
                        <Route className="mr-2 h-5 w-5" />
                        Journey Planner
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                        <Link href="/timetable">
                        <Radio className="mr-2 h-5 w-5" />
                        Live Service Board
                        </Link>
                    </Button>

                    {/* Conditional rendering of Admin Panel button */}
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
                </div>

                <NetworkUpdatesBox />

            </main>
        </div>
        <footer className="w-full flex-shrink-0">
            <TickerTape />
        </footer>
    </div>
  );
}

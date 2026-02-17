import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Map, Radio, Shield } from 'lucide-react';
import UserMenu from '@/components/auth/UserMenu';
import TickerTape from '@/components/TickerTape';
import BreakingNewsTicker from '@/components/BreakingNewsTicker';
import JourneyPlanner from '@/components/journey-planner';

export default function HomePage() {
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
                    Go North West Tracker
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
                    <Button asChild size="lg" variant="outline">
                        <Link href="/timetable">
                        <Radio className="mr-2 h-5 w-5" />
                        Live Service Board
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary">
                        <Link href="/admin">
                        <Shield className="mr-2 h-5 w-5" />
                        Admin Panel
                        </Link>
                    </Button>
                    </div>
                </div>

                <div className="w-full max-w-4xl">
                    <JourneyPlanner />
                </div>
            </main>
        </div>
        <footer className="w-full flex-shrink-0">
            <TickerTape />
        </footer>
    </div>
  );
}

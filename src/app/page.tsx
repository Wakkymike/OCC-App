import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Map, Radio, Clock, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          Go North West Tracker
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Your portal for live bus tracking and service timetables.
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
          <Button asChild size="lg" variant="outline">
            <Link href="/timetables">
              <Clock className="mr-2 h-5 w-5" />
              Service Timetables
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
    </main>
  );
}

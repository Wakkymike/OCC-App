import JourneyPlanner from '@/components/journey-planner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function JourneyPlannerPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 gap-8">
            <div className="w-full max-w-4xl">
                <JourneyPlanner />
                <div className="mt-8 flex justify-start">
                     <Button asChild variant="outline">
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Home
                        </Link>
                     </Button>
                </div>
            </div>
        </div>
    );
}

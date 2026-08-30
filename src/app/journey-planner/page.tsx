import JourneyPlanner from '@/components/journey-planner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';

export default function JourneyPlannerPage() {
    return (
        <PageShell
            title="Journey Planner"
            description="Plan bus journeys across the TfGM network with live routing data."
            actions={
                <Button asChild variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            }
        >
            <JourneyPlanner />
        </PageShell>
    );
}

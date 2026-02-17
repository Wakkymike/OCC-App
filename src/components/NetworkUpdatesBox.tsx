'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { NetworkUpdate } from '@/lib/types';
import { Rss, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NetworkUpdatesBox() {
  const firestore = useFirestore();
  
  // Simplified query to fetch all documents. Filtering and sorting will be done client-side.
  const updatesQuery = useMemoFirebase(
    () => collection(firestore, 'networkUpdates'),
    [firestore]
  );
  const { data: allUpdates, isLoading } = useCollection<NetworkUpdate>(updatesQuery);

  // Memoized client-side filtering and sorting.
  const updates = useMemo(() => {
    if (!allUpdates) return null;
    return allUpdates
      .filter(update => update.isVisible)
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
  }, [allUpdates]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // This effect manages the cycling of updates.
  useEffect(() => {
    // When the list of updates changes, reset the ticker to show the first item.
    setCurrentIndex(0);

    if (updates && updates.length > 1) {
      const timer = setInterval(() => {
        // Cycle to the next update. The modulo operator handles wrapping around.
        setCurrentIndex((prevIndex) => (prevIndex + 1) % updates.length);
      }, 25000); // 25 seconds
      return () => clearInterval(timer); // Clean up the interval on unmount or when updates change.
    }
  }, [updates]);
  
  const currentUpdate = useMemo(() => {
    if (!updates || updates.length === 0) return null;
    return updates[currentIndex];
  }, [updates, currentIndex]);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Rss className="h-5 w-5" />
          Network Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="h-24 overflow-hidden relative">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Loading updates...</span>
          </div>
        )}
        {!isLoading && !currentUpdate && (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No active network updates at this time.</p>
            </div>
        )}
        {!isLoading && currentUpdate && (
          <div key={currentUpdate.id} className="animate-scroll-up absolute inset-0 p-1">
            <h3 className="font-bold text-lg">{currentUpdate.title}</h3>
            <p className="text-muted-foreground">{currentUpdate.details}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

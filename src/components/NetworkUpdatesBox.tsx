'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { NetworkUpdate } from '@/lib/types';
import { Rss, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NetworkUpdatesBox() {
  const firestore = useFirestore();
  const updatesQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, 'networkUpdates'),
        where('isVisible', '==', true),
        orderBy('priority', 'asc'),
        orderBy('createdAt', 'desc')
      ),
    [firestore]
  );
  const { data: updates, isLoading } = useCollection<NetworkUpdate>(updatesQuery);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (updates && updates.length > 1) {
      const timer = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % updates.length);
      }, 60000); // 1 minute
      return () => clearInterval(timer);
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

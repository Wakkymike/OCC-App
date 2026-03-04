'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSocket } from '@/contexts/socket-context';
import { SOCKET_EVENTS } from '@/lib/socket/events';
import type { NetworkUpdate } from '@/lib/types';
import { Rss, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NetworkUpdatesBox() {
  const { on, off } = useSocket();
  const [allUpdates, setAllUpdates] = useState<NetworkUpdate[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUpdates = useCallback(async () => {
    try {
      const res = await fetch('/api/network-updates');
      if (res.ok) {
        const data = await res.json();
        setAllUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Failed to fetch network updates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  // Listen for real-time changes
  useEffect(() => {
    const handleChange = () => fetchUpdates();
    on(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, handleChange);
    return () => {
      off(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, handleChange);
    };
  }, [on, off, fetchUpdates]);

  const updates = useMemo(() => {
    if (!allUpdates) return null;
    return allUpdates
      .filter(update => update.isVisible)
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });
  }, [allUpdates]);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);

    if (updates && updates.length > 1) {
      const timer = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % updates.length);
      }, 25000); // 25 seconds
      return () => clearInterval(timer);
    }
  }, [updates]);
  
  const currentUpdate = useMemo(() => {
    if (!updates || updates.length === 0) return null;
    return updates[currentIndex];
  }, [updates, currentIndex]);

  return (
    <Card className="w-full max-w-5xl shadow-md border-primary/10">
      <CardHeader className="pb-3 border-b bg-muted/5">
        <CardTitle className="flex items-center gap-2 text-xl font-bold uppercase tracking-tight text-primary">
          <Rss className="h-5 w-5" />
          Live Network Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-[12rem] h-48 overflow-hidden relative bg-card">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="font-bold text-xs uppercase tracking-widest">Syncing Updates...</span>
          </div>
        )}
        {!isLoading && !currentUpdate && (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="italic font-medium">No active network updates at this time.</p>
            </div>
        )}
        {!isLoading && currentUpdate && (
          <div key={currentUpdate.id} className="animate-scroll-up absolute inset-0 p-6">
            <h3 className="font-black text-2xl mb-3 text-foreground leading-tight">{currentUpdate.title}</h3>
            <div 
              className="text-muted-foreground rich-content text-lg leading-relaxed"
              dangerouslySetInnerHTML={{ __html: currentUpdate.details }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

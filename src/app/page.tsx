'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { SOCKET_EVENTS } from '@/lib/socket/events';
import type { NetworkUpdate } from '@/lib/types';
import { Rss, Loader2, AlertTriangle, Clock, Coffee, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, isWithinInterval, isAfter } from 'date-fns';
import BreakingNewsTicker from '@/components/BreakingNewsTicker';
import TickerTape from '@/components/TickerTape';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function HomePage() {
  const { user } = useAuth();
  const { on, off } = useSocket();

  const logoImage = PlaceHolderImages.find(img => img.id === 'app-logo');

  /* ---- shifts ---- */
  const [shifts, setShifts] = useState<any[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);

  useEffect(() => {
    if (user?.icalUrl) {
      setIsLoadingShifts(true);
      fetch(`/api/shifts?url=${encodeURIComponent(user.icalUrl)}`)
        .then((r) => r.json())
        .then((d) => { if (d.shifts) setShifts(d.shifts); })
        .catch(console.error)
        .finally(() => setIsLoadingShifts(false));
    }
  }, [user?.icalUrl]);

  const now = new Date();
  const currentShift = shifts.find((s) =>
    isWithinInterval(now, { start: new Date(s.start), end: new Date(s.end) }),
  );
  const nextShift = shifts.find((s) => isAfter(new Date(s.start), now));

  /* ---- network updates ---- */
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

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  useEffect(() => {
    const handleChange = () => fetchUpdates();
    on(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, handleChange);
    return () => { off(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, handleChange); };
  }, [on, off, fetchUpdates]);

  const updates = useMemo(() => {
    if (!allUpdates) return null;
    return allUpdates
      .filter((u) => u.isVisible)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.createdAt && b.createdAt)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return 0;
      });
  }, [allUpdates]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <BreakingNewsTicker />

      <div className="flex-grow overflow-y-auto">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* ---- Logo ---- */}
          <div className="flex justify-center">
            <Image
              src={logoImage?.imageUrl || 'https://picsum.photos/seed/occ-logo/400/120'}
              alt="OCC App Logo"
              width={400}
              height={120}
              priority
              className="h-auto w-auto max-h-20 sm:max-h-28 drop-shadow-sm"
              data-ai-hint={logoImage?.imageHint || 'transport logo'}
            />
          </div>

          {/* ---- Shift status strip ---- */}
          {user?.icalUrl && !isLoadingShifts && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
              {/* Current */}
              <div className="flex-1 min-w-0">
                {currentShift ? (
                  <div>
                    <Badge className="bg-green-600 hover:bg-green-700 font-black text-[10px] mb-1">
                      ON DUTY
                    </Badge>
                    <p className="text-sm font-bold truncate leading-tight">
                      {currentShift.summary}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      Finishes at {format(new Date(currentShift.end), 'HH:mm')}
                    </p>
                  </div>
                ) : (
                  <div className="text-muted-foreground opacity-60">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 flex items-center gap-1">
                      <Coffee className="h-3 w-3" /> Status
                    </p>
                    <p className="text-sm font-bold italic">Off Duty</p>
                  </div>
                )}
              </div>

              {/* Next */}
              <div className="flex-1 min-w-0 text-right hidden sm:block">
                {nextShift ? (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5 flex items-center justify-end gap-1">
                      <Calendar className="h-3 w-3" /> Next Duty
                    </p>
                    <p className="text-sm font-bold truncate leading-tight ml-auto max-w-[280px]">
                      {nextShift.summary}
                    </p>
                    <p className="text-xs text-primary font-bold mt-0.5">
                      {format(new Date(nextShift.start), 'EEE, do MMM @ HH:mm')}
                    </p>
                  </div>
                ) : (
                  <div className="text-muted-foreground opacity-60">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 flex items-center justify-end gap-1">
                      <Calendar className="h-3 w-3" /> Next Duty
                    </p>
                    <p className="text-sm font-bold italic">None Scheduled</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {isLoadingShifts && (
            <div className="h-12 rounded-xl border bg-card animate-pulse" />
          )}

          {/* ---- Live Network Alerts header ---- */}
          <div className="flex items-center gap-2">
            <Rss className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold uppercase tracking-tight text-primary">
              Live Network Alerts
            </h1>
          </div>

          {/* ---- Alerts list ---- */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="text-sm font-bold uppercase tracking-widest">
                Syncing Updates…
              </span>
            </div>
          ) : !updates || updates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mb-3 opacity-30" />
              <p className="italic font-medium">
                No active network updates at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map((update) => (
                <article
                  key={update.id}
                  className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h2 className="font-black text-lg leading-tight mb-2">
                    {update.title}
                  </h2>
                  {update.details && (
                    <div
                      className="text-muted-foreground text-sm leading-relaxed rich-content"
                      dangerouslySetInnerHTML={{ __html: update.details }}
                    />
                  )}
                  {update.createdAt && (
                    <p className="text-[10px] text-muted-foreground/60 mt-3 uppercase tracking-widest">
                      {format(new Date(update.createdAt), 'EEE do MMM yyyy, HH:mm')}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      <footer className="w-full flex-shrink-0">
        <TickerTape />
      </footer>
    </div>
  );
}

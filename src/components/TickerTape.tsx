'use client';

import { useEffect, useState, useCallback } from 'react';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewsItem {
  title: string;
  description: string;
  pubDate: string;
}

export default function TickerTape() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    // Don't set loading to true here to prevent flicker on refresh
    try {
      const response = await fetch('/api/tfgm-news');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }
      const cleanedItems = data.items.map((item: any) => ({
        title: item.title,
        description: String(item.description).replace(/<[^>]*>?/gm, ''), // Basic HTML stripping
        pubDate: item.pubDate,
      }));
      setItems(cleanedItems);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unknown error occurred while loading travel news.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const intervalId = setInterval(fetchNews, 60000); // Refresh every minute
    return () => clearInterval(intervalId);
  }, [fetchNews]);

  const allNewsString = items.map(item => `${item.title}: ${item.description}`).join(' • ');
  const hasContentToScroll = !isLoading && !error && items.length > 0;

  const renderStaticContent = () => {
    if (isLoading) {
      return 'Loading latest travel news...';
    }
    if (error) {
      return <span className="font-semibold text-destructive">Error: {error}</span>;
    }
    return 'No travel news to display.';
  }

  return (
    <div className="w-full bg-secondary text-secondary-foreground h-12 flex items-center overflow-hidden">
      <div className="flex-shrink-0 flex items-center bg-accent text-accent-foreground h-full px-4 z-10">
        <Megaphone className="h-6 w-6" />
      </div>
      <div className="flex-grow min-w-0 whitespace-nowrap">
        <div className={cn(
            "inline-block",
            hasContentToScroll && "ticker-animation"
        )}>
          {hasContentToScroll ? (
            <>
              <span className="mx-4">{allNewsString}</span>
              <span className="mx-4">{allNewsString}</span>
            </>
          ) : (
            <span className="px-4">{renderStaticContent()}</span>
          )}
        </div>
      </div>
    </div>
  );
}

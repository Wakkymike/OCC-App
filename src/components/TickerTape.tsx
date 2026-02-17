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
    setIsLoading(true);
    try {
      const response = await fetch('/api/tfgm-news');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }
      const cleanedItems = data.items.map((item: any) => ({
        title: item.title,
        description: String(item.description).replace(/<[^>]*>?/gm, ''),
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

  const renderScrollingContent = () => {
    if (isLoading) {
      return <span className="px-4">Loading latest travel news...</span>;
    }
    if (error) {
      return <span className="px-4 font-semibold text-destructive">Error: {error}</span>;
    }
    if (items.length > 0) {
      const allNewsString = items.map(item => `${item.title}: ${item.description}`).join(' • ');
      // Render the content twice for a seamless loop
      return (
        <>
          <span className="mx-4">{allNewsString}</span>
          <span className="mx-4">{allNewsString}</span>
        </>
      );
    }
    return <span className="px-4">No travel news to display.</span>;
  };
  
  const hasContentToScroll = !isLoading && !error && items.length > 0;

  return (
    <div className="w-full bg-secondary text-secondary-foreground h-12 flex items-center overflow-hidden">
      <div className="flex-shrink-0 flex items-center bg-accent text-accent-foreground h-full px-4 z-10">
        <Megaphone className="h-6 w-6" />
      </div>
      <div className="flex-grow min-w-0 whitespace-nowrap">
        <div className={cn(
            "inline-block", 
            // Only apply animation if there is content to prevent an empty ticker from scrolling
            hasContentToScroll && "animate-marquee"
        )}>
            {renderScrollingContent()}
        </div>
      </div>
    </div>
  );
}

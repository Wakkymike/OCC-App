'use client';

import { useEffect, useState, useRef } from 'react';
import { Megaphone } from 'lucide-react';

interface NewsItem {
  title: string;
  description: string;
  pubDate: string;
}

export default function TickerTape() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [animationDuration, setAnimationDuration] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('/api/tfgm-news');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch news');
        }
        const cleanedItems = data.items.map((item: NewsItem) => ({
            ...item,
            description: item.description.replace(/<[^>]*>?/gm, '')
        }));
        setItems(cleanedItems);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An unknown error occurred while loading travel news.');
      } finally {
        if (isLoading) {
          setIsLoading(false);
        }
      }
    }

    fetchNews();
    const intervalId = setInterval(fetchNews, 60000);
    return () => clearInterval(intervalId);
  }, [isLoading]);

  useEffect(() => {
    // We need a small delay to allow the browser to render the new items and calculate the width
    const timeoutId = setTimeout(() => {
      if (contentRef.current) {
        const contentWidth = contentRef.current.scrollWidth;
        // Define a constant speed in pixels per second. A smaller number means a slower scroll.
        const pixelsPerSecond = 50; 
        // The animation distance is half the total width (because the content is duplicated)
        const distanceToTravel = contentWidth / 2;
        
        if (distanceToTravel > 0) {
          const duration = distanceToTravel / pixelsPerSecond;
          setAnimationDuration(`${duration}s`);
        } else {
          setAnimationDuration(undefined); // No animation if there's no content
        }
      }
    }, 100); // 100ms delay

    return () => clearTimeout(timeoutId);

  }, [items, isLoading]); // Recalculate whenever the news items change

  const TickerItems = ({ isDuplicate }: { isDuplicate: boolean }) => (
    <>
      {items.map((item, index) => (
        <div key={isDuplicate ? `dup-${index}` : index} className="flex items-center">
          <span className="mx-8 font-semibold">{item.title}:</span>
          <span className="mx-8">{item.description}</span>
          <span className="mx-8 text-muted-foreground text-sm">({new Date(item.pubDate).toLocaleTimeString()})</span>
          {index < items.length - 1 && <span className="text-muted-foreground">||</span>}
        </div>
      ))}
    </>
  );

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex items-center"><span className="mx-8">Loading latest travel news...</span></div>;
    }
    if (error) {
      return <div className="flex items-center font-semibold text-destructive"><span className="mx-8">Error: {error}</span></div>;
    }
    if (items.length > 0) {
      return (
        <div className="ticker-wrapper">
          <div 
            className="ticker-content" 
            ref={contentRef}
            style={animationDuration ? { animationDuration } : {}}
          >
            <TickerItems isDuplicate={false} />
            <TickerItems isDuplicate={true} />
          </div>
        </div>
      );
    }
    return <div className="flex items-center"><span className="mx-8">No travel news to display.</span></div>;
  };

  return (
    <div className="w-full bg-secondary text-secondary-foreground overflow-hidden h-12 flex items-center ticker-container">
      <div className="flex items-center bg-accent text-accent-foreground h-full px-4 z-10">
        <Megaphone className="h-6 w-6" />
      </div>
      {renderContent()}
    </div>
  );
}

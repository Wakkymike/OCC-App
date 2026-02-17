'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  const animationFrameId = useRef<number>();

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

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || isLoading || error || items.length === 0) {
      // If there's nothing to scroll, cancel any existing animation and stop.
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    // This ensures we get the full width after the component has rendered with the items
    const scrollWidth = contentElement.scrollWidth / 2;
    if (scrollWidth === 0) return;

    const speed = 40; // pixels per second
    let position = 0;
    let lastTimestamp: number | null = null;

    const animate = (timestamp: number) => {
      if (!contentElement) return;

      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }
      
      const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
      lastTimestamp = timestamp;

      position -= speed * deltaTime;

      if (Math.abs(position) >= scrollWidth) {
        position += scrollWidth; // Reset position for seamless loop
      }

      contentElement.style.transform = `translateX(${position}px)`;
      animationFrameId.current = requestAnimationFrame(animate);
    };
    
    // Start the animation
    animationFrameId.current = requestAnimationFrame(animate);
    
    // Cleanup function
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [items, isLoading, error]);

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
        {hasContentToScroll ? (
          <div ref={contentRef} className="inline-block">
            <span className="mx-4">{allNewsString}</span>
            <span className="mx-4">{allNewsString}</span>
          </div>
        ) : (
          <span className="px-4">{renderStaticContent()}</span>
        )}
      </div>
    </div>
  );
}
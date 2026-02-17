'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface NewsItem {
  title: string;
  description: string;
  pubDate: string;
}

const StylizedGlobeIcon = () => (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className="h-6 w-6 mr-2"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.41 3.59-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.41-3.59 8-8 8z" />
    </svg>
);


export default function BreakingNewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch('/api/bbc-news');
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
      setError(err.message || 'An unknown error occurred while loading breaking news.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const intervalId = setInterval(fetchNews, 60000 * 5); // Refresh every 5 minutes
    return () => clearInterval(intervalId);
  }, [fetchNews]);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || isLoading || error || items.length === 0) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const scrollWidth = contentElement.scrollWidth / 2;
    if (scrollWidth === 0) return;

    const speed = 75; // pixels per second
    let position = 0;
    let lastTimestamp: number | null = null;

    const animate = (timestamp: number) => {
      if (!contentElement) return;

      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      const deltaTime = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      position -= speed * deltaTime;

      if (Math.abs(position) >= scrollWidth) {
        position += scrollWidth;
      }

      contentElement.style.transform = `translateX(${position}px)`;
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [items, isLoading, error]);

  const allNewsString = items.map(item => item.title).join(' • ');
  const hasContentToScroll = !isLoading && !error && items.length > 0;

  const renderStaticContent = () => {
    if (isLoading) {
      return 'Loading breaking news...';
    }
    if (error) {
      return <span className="font-semibold text-white">Error: {error}</span>;
    }
    return 'No breaking news to display.';
  }

  return (
    <div className="w-full bg-destructive text-destructive-foreground h-12 flex items-center overflow-hidden">
      <div className="flex-shrink-0 flex items-center bg-red-700 text-white h-full px-4 z-10 font-bold text-sm tracking-wider">
        <StylizedGlobeIcon />
        <span className="inline-block animate-bounce-zoom">BREAKING NEWS</span>
      </div>
      <div className="flex-grow min-w-0 whitespace-nowrap">
        {hasContentToScroll ? (
          <div ref={contentRef} className="inline-block">
            <span className="mx-4 font-semibold">{allNewsString}</span>
            <span className="mx-4 font-semibold">{allNewsString}</span>
          </div>
        ) : (
          <span className="px-4 font-semibold">{renderStaticContent()}</span>
        )}
      </div>
    </div>
  );
}

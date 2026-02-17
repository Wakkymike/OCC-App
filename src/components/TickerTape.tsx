'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const fetchNews = async () => {
      // Note: We don't set loading to true on subsequent polls
      // to avoid a flicker in the UI.
      try {
        const response = await fetch('/api/tfgm-news');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch news');
        }

        // Clean up descriptions (remove HTML tags)
        const cleanedItems = data.items.map((item: NewsItem) => ({
            ...item,
            description: item.description.replace(/<[^>]*>?/gm, '')
        }));
        setItems(cleanedItems);
        setError(null); // Clear any previous error on success
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An unknown error occurred while loading travel news.');
        // We don't clear old items, so the last good data can still be shown if a fetch fails
      } finally {
        // This will only run once to remove the initial "Loading..." message
        if (isLoading) {
          setIsLoading(false);
        }
      }
    }

    fetchNews(); // Fetch immediately on mount
    const intervalId = setInterval(fetchNews, 60000); // And then every minute

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [isLoading]);

  const hasContent = !isLoading && (items.length > 0 || error);

  const renderContent = () => {
    if (isLoading) {
        return <div className="flex items-center"><span className="mx-8">Loading latest travel news...</span></div>;
    }
    if (error) {
        return <div className="flex items-center font-semibold text-destructive"><span className="mx-8">Error: {error}</span></div>;
    }
    if (items.length > 0) {
        return items.map((item, index) => (
            <div key={index} className="flex items-center">
                <span className="mx-8 font-semibold">{item.title}:</span>
                <span className="mx-8">{item.description}</span>
                <span className="mx-8 text-muted-foreground text-sm">({new Date(item.pubDate).toLocaleTimeString()})</span>
                {index < items.length - 1 && <span className="text-muted-foreground">||</span>}
            </div>
        ));
    }
    return null;
  };

  const content = renderContent();

  return (
    <div className="w-full bg-secondary text-secondary-foreground overflow-hidden h-12 flex items-center ticker-container">
      <div className="flex items-center bg-accent text-accent-foreground h-full px-4 z-10">
        <Megaphone className="h-6 w-6" />
      </div>
      {hasContent ? (
        <div className="ticker-wrapper">
            <div className="ticker-content">
                {content}
                {/* Duplicate content for seamless looping */}
                {items.length > 0 && content}
            </div>
        </div>
      ) : (
         <div className="ticker-wrapper"><div className="ticker-content">{content}</div></div>
      )}
    </div>
  );
}

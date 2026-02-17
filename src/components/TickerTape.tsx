'use client';

import { useEffect, useState, useCallback } from 'react';
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

  const fetchNews = useCallback(async () => {
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
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const intervalId = setInterval(fetchNews, 60000); // Refresh every minute
    return () => clearInterval(intervalId);
  }, [fetchNews]);

  const TickerItems = ({ isDuplicate }: { isDuplicate: boolean }) => (
    <>
      {items.map((item, index) => (
        <div key={isDuplicate ? `dup-${index}` : index} className="flex items-center flex-shrink-0">
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
          <div className="ticker-content">
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

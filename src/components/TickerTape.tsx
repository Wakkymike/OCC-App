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

  const renderContent = () => {
    if (isLoading) {
      return <span className="mx-4">Loading latest travel news...</span>;
    }
    if (error) {
      return <span className="mx-4 font-semibold text-destructive">Error: {error}</span>;
    }
    if (items.length > 0) {
      const firstItem = items[0];
      return (
        <div className="mx-4 flex items-center truncate">
          <span className="font-semibold mr-2">{firstItem.title}:</span>
          <span className="truncate">{firstItem.description}</span>
        </div>
      );
    }
    return <span className="mx-4">No travel news to display.</span>;
  };

  return (
    <div className="w-full bg-secondary text-secondary-foreground overflow-hidden h-12 flex items-center">
      <div className="flex items-center bg-accent text-accent-foreground h-full px-4 z-10">
        <Megaphone className="h-6 w-6" />
      </div>
      <div className="flex-grow min-w-0">
        {renderContent()}
      </div>
    </div>
  );
}

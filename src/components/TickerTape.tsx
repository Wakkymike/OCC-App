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

  useEffect(() => {
    async function fetchNews() {
      try {
        const response = await fetch('/api/tfgm-news');
        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }
        const data = await response.json();
        // Clean up descriptions (remove HTML tags)
        const cleanedItems = data.items.map((item: NewsItem) => ({
            ...item,
            description: item.description.replace(/<[^>]*>?/gm, '')
        }));
        setItems(cleanedItems);
      } catch (error) {
        console.error(error);
        // Set a single item to show the error message in the ticker
        setItems([{ title: 'Error', description: 'Could not load travel news.', pubDate: new Date().toISOString() }]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNews();
  }, []);

  const content = isLoading ? (
    <div className="flex items-center">
        <span className="mx-8">Loading latest travel news...</span>
    </div>
  ) : (
    items.map((item, index) => (
      <div key={index} className="flex items-center">
        <span className="mx-8 font-semibold">{item.title}:</span>
        <span className="mx-8">{item.description}</span>
        <span className="mx-8 text-muted-foreground text-sm">({new Date(item.pubDate).toLocaleTimeString()})</span>
        {index < items.length - 1 && <span className="text-muted-foreground">||</span>}
      </div>
    ))
  );

  return (
    <div className="w-full bg-secondary text-secondary-foreground overflow-hidden h-12 flex items-center ticker-container">
      <div className="flex items-center bg-accent text-accent-foreground h-full px-4 z-10">
        <Megaphone className="h-6 w-6" />
      </div>
      <div className="ticker-wrapper">
        <div className="ticker-content">
          {content}
          {/* Duplicate content for seamless looping */}
          {!isLoading && items.length > 0 && <div className="ticker-content">{content}</div>}
        </div>
      </div>
    </div>
  );
}

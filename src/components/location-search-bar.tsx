'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, MapPin } from 'lucide-react';

interface LocationSearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
}

export default function LocationSearchBar({ onSearch, onClear }: LocationSearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if(query) {
        onSearch(query);
    }
  };

  const handleClear = () => {
    setQuery('');
    onClear();
  };
  
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value === '') {
        onClear();
    }
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex items-center gap-2 bg-card p-2 rounded-lg shadow-md w-full max-w-md"
    >
      <MapPin className="h-5 w-5 text-muted-foreground ml-1" />
      <Input
        type="text"
        placeholder="Search location or postcode..."
        value={query}
        onChange={handleQueryChange}
        className="flex-grow"
      />
      <Button type="submit" size="icon" aria-label="Search Location" disabled={!query}>
        <Search className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Clear Location Search"
        onClick={handleClear}
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

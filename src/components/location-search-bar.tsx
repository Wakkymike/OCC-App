'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, MapPin, Loader2 } from 'lucide-react';

interface LocationSearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
}

interface Suggestion {
    name: string;
    place_formatted: string;
    mapbox_id: string;
}

export default function LocationSearchBar({ onSearch, onClear }: LocationSearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // crypto.randomUUID is available in secure contexts (HTTPS) and modern browsers.
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        setSessionToken(crypto.randomUUID());
    } else {
        // Fallback for non-secure contexts or older browsers
        const random = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        setSessionToken(`${random()}${random()}-${random()}-${random()}-${random()}-${random()}${random()}${random()}`);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBarRef.current && !searchBarRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 3 || !sessionToken) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/geocode-suggestions?query=${encodeURIComponent(searchQuery)}&session_token=${sessionToken}`);
      const data = await response.json();
      if (response.ok) {
        setSuggestions(data.suggestions || []);
        setShowSuggestions(data.suggestions && data.suggestions.length > 0);
      } else {
        console.error('Failed to fetch suggestions:', data.error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
    }

    if (newQuery.length > 2) {
        debounceTimeoutRef.current = setTimeout(() => {
            fetchSuggestions(newQuery);
        }, 300);
    } else {
        setSuggestions([]);
        setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    const fullAddress = `${suggestion.name}, ${suggestion.place_formatted}`;
    setQuery(fullAddress);
    setShowSuggestions(false);
    onSearch(fullAddress);
  };
  
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if(query) {
        setShowSuggestions(false);
        onSearch(query);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onClear();
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex items-center gap-2 bg-card p-2 rounded-lg shadow-md w-full max-w-md"
    >
      <div className="relative w-full" ref={searchBarRef}>
        <MapPin className="absolute h-5 w-5 text-muted-foreground left-3 top-1/2 -translate-y-1/2" />
        <Input
            type="text"
            placeholder="Search location or postcode..."
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query.length > 2 && suggestions.length > 0 && setShowSuggestions(true)}
            className="flex-grow pl-10"
            autoComplete="off"
        />
        {loading && <Loader2 className="absolute h-4 w-4 animate-spin right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
            {suggestions.map((suggestion) => (
                <li
                key={suggestion.mapbox_id}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-2 cursor-pointer hover:bg-accent"
                >
                <p className="font-semibold">{suggestion.name}</p>
                <p className="text-sm text-muted-foreground">{suggestion.place_formatted}</p>
                </li>
            ))}
            </ul>
        )}
      </div>

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

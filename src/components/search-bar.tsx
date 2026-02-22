'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (
    searchType: string,
    query: string,
    direction: 'all' | 'inbound' | 'outbound'
  ) => void;
  onClear: () => void;
}

export default function SearchBar({ onSearch, onClear }: SearchBarProps) {
  const [searchType, setSearchType] = useState('fleetNumber');
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>(
    'all'
  );

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSearch(searchType, query, direction);
  };

  const handleClear = () => {
    setQuery('');
    setDirection('all');
    onClear();
  };

  const handleSearchTypeChange = (value: string) => {
    setSearchType(value);
    // Reset query and direction when search type changes
    setQuery('');
    setDirection('all');
    onSearch(value, '', 'all');
  };
  
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value === '') {
        onSearch(searchType, '', direction);
    }
  };


  return (
    <form
      onSubmit={handleSearch}
      className="flex items-center gap-2 bg-card p-2 rounded-lg shadow-md w-full max-w-xl"
    >
      <Select value={searchType} onValueChange={handleSearchTypeChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Search buses by..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fleetNumber">Fleet Number</SelectItem>
          <SelectItem value="runningBoard">Running Board</SelectItem>
          <SelectItem value="service">Service Number</SelectItem>
          <SelectItem value="journey">Journey Number</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="text"
        placeholder={'Enter search term...'}
        value={query}
        onChange={handleQueryChange}
        className="flex-grow"
      />

      {searchType === 'service' && (
        <RadioGroup
          value={direction}
          onValueChange={(value: 'all' | 'inbound' | 'outbound') => {
            setDirection(value)
            onSearch(searchType, query, value);
          }}
          className="flex items-center gap-4 text-sm"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="r-all" />
            <Label htmlFor="r-all">All</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="inbound" id="r-inbound" />
            <Label htmlFor="r-inbound">Inbound</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="outbound" id="r-outbound" />
            <Label htmlFor="r-outbound">Outbound</Label>
          </div>
        </RadioGroup>
      )}

      <Button type="submit" size="icon" aria-label="Search">
        <Search className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Clear Search"
        onClick={handleClear}
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

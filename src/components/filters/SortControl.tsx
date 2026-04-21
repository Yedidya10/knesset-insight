'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortOption } from './types';

interface SortControlProps {
  options: SortOption[];
  sortField: string;
  sortDir: 'asc' | 'desc';
  onFieldChange: (value: string) => void;
  onDirChange: (dir: 'asc' | 'desc') => void;
  dirAscLabel?: string;
  dirDescLabel?: string;
}

export default function SortControl({
  options,
  sortField,
  sortDir,
  onFieldChange,
  onDirChange,
  dirAscLabel = 'Ascending',
  dirDescLabel = 'Descending',
}: SortControlProps) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  const currentField = sortField || options[0]?.value || '';

  return (
    <div className="flex items-center gap-1">
      <Select
        value={currentField}
        onValueChange={(val) => onFieldChange(val ?? '')}
        items={items}
      >
        <SelectTrigger className="gap-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => onDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
        aria-label={sortDir === 'asc' ? dirAscLabel : dirDescLabel}
        title={sortDir === 'asc' ? dirAscLabel : dirDescLabel}
      >
        {sortDir === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

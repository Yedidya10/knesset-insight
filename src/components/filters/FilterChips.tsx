'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ActiveFilter } from './types';

interface FilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
}

export default function FilterChips({ filters, onRemove }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-1.5 pb-1">
        {filters.map((f) => (
          <Badge
            key={f.key}
            variant="secondary"
            className="shrink-0 gap-1 pe-1"
          >
            <span className="text-xs whitespace-nowrap">
              {f.label}: {f.displayValue}
            </span>
            <button
              type="button"
              onClick={() => onRemove(f.key)}
              className="hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

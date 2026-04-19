'use client';

import { ArrowUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortOption } from './types';

interface SortSelectProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
  defaultValue?: string;
}

export default function SortSelect({
  options,
  value,
  onChange,
  defaultValue,
}: SortSelectProps) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  const currentValue = value || defaultValue || options[0]?.value || '';

  return (
    <Select
      value={currentValue}
      onValueChange={(val) => onChange(val ?? '')}
      items={items}
    >
      <SelectTrigger className="gap-1.5">
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
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
  );
}

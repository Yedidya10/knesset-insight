'use client';

import { cn } from '@/lib/utils';
import type { MultiSelectFilterField } from './types';

interface FilterMultiSelectProps {
  field: MultiSelectFilterField;
  value: string;
  onChange: (value: string) => void;
}

export default function FilterMultiSelect({
  field,
  value,
  onChange,
}: FilterMultiSelectProps) {
  const separator = field.separator ?? ',';
  const selected = value ? value.split(separator).filter(Boolean) : [];

  const toggle = (optionValue: string) => {
    const set = new Set(selected);
    if (set.has(optionValue)) {
      set.delete(optionValue);
    } else {
      set.add(optionValue);
    }
    onChange(Array.from(set).join(separator));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {field.options.map((opt) => {
        const isActive = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

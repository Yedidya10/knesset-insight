'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
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
  const variant = field.variant ?? 'pills';
  const [query, setQuery] = useState('');
  const t = useTranslations('filters');

  const toggle = (optionValue: string) => {
    const set = new Set(selected);
    if (set.has(optionValue)) {
      set.delete(optionValue);
    } else {
      set.add(optionValue);
    }
    onChange(Array.from(set).join(separator));
  };

  if (variant === 'checkbox') {
    const filtered = query
      ? field.options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase()),
        )
      : field.options;

    return (
      <div className="space-y-2">
        {/* Inline search */}
        <div className="relative">
          <Search className="text-muted-foreground absolute inset-s-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border py-1.5 ps-8 pe-3 text-sm focus-visible:ring-1 focus-visible:outline-none"
            placeholder={t('search')}
          />
        </div>
        {/* Scrollable checkbox list */}
        <div className="max-h-48 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">
              {t('noResults')}
            </p>
          ) : (
            filtered.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                    isChecked
                      ? 'bg-primary/5 text-foreground'
                      : 'hover:bg-muted/50 text-foreground',
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggle(opt.value)}
                    className="shrink-0"
                  />
                  <span className="min-w-0 truncate">{opt.label}</span>
                </label>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {t('selectedCount', { count: selected.length })}
          </p>
        )}
      </div>
    );
  }

  // Default: pills
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

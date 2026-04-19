'use client';

import { useTranslations } from 'next-intl';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import FilterSelect from './FilterSelect';
import FilterMultiSelect from './FilterMultiSelect';
import FilterRange from './FilterRange';
import FilterToggle from './FilterToggle';
import type {
  FilterFieldConfig,
  RangeFilterField,
  SelectFilterField,
  MultiSelectFilterField,
  ToggleFilterField,
} from './types';

interface FilterSheetProps {
  fields: FilterFieldConfig[];
  filters: Record<string, string>;
  activeCount: number;
  onUpdateFilter: (key: string, value: string) => void;
  onClearAll: () => void;
  /** Custom render slots for specific filter keys (e.g. status tabs) */
  customRenderers?: Record<string, React.ReactNode>;
}

export default function FilterSheet({
  fields,
  filters,
  activeCount,
  onUpdateFilter,
  onClearAll,
  customRenderers,
}: FilterSheetProps) {
  const t = useTranslations('filters');

  // Only show non-search fields in the sheet
  const sheetFields = fields.filter((f) => f.type !== 'search');

  // Group fields
  const groups = new Map<string, FilterFieldConfig[]>();
  for (const field of sheetFields) {
    const group = field.group ?? '';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(field);
  }

  const renderField = (field: FilterFieldConfig) => {
    // Check for custom renderer
    if (customRenderers?.[field.key]) {
      return customRenderers[field.key];
    }

    switch (field.type) {
      case 'select':
        return (
          <FilterSelect
            field={field as SelectFilterField}
            value={filters[field.key] ?? ''}
            onChange={(val) => onUpdateFilter(field.key, val)}
          />
        );
      case 'multiSelect':
        return (
          <FilterMultiSelect
            field={field as MultiSelectFilterField}
            value={filters[field.key] ?? ''}
            onChange={(val) => onUpdateFilter(field.key, val)}
          />
        );
      case 'range': {
        const rf = field as RangeFilterField;
        const fromKey = rf.fromKey ?? `${rf.key}From`;
        const toKey = rf.toKey ?? `${rf.key}To`;
        return (
          <FilterRange
            field={rf}
            fromValue={filters[fromKey] ?? ''}
            toValue={filters[toKey] ?? ''}
            onFromChange={(val) => onUpdateFilter(fromKey, val)}
            onToChange={(val) => onUpdateFilter(toKey, val)}
          />
        );
      }
      case 'toggle':
        return (
          <FilterToggle
            field={field as ToggleFilterField}
            value={filters[field.key] ?? ''}
            onChange={(val) => onUpdateFilter(field.key, val)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl" />
        }
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('openPanel')}</span>
        {activeCount > 0 && (
          <Badge variant="default" className="ms-1 h-5 min-w-5 px-1 text-xs">
            {activeCount}
          </Badge>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="flex w-80 flex-col sm:w-96">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>
            {activeCount > 0
              ? t('activeCount', { count: activeCount })
              : t('noActiveFilters')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {Array.from(groups.entries()).map(([groupName, groupFields], gi) => (
            <div key={groupName || gi}>
              {groupName && (
                <>
                  {gi > 0 && <Separator className="my-3" />}
                  <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                    {groupName}
                  </h3>
                </>
              )}
              <div className="space-y-4">
                {groupFields.map((field) => (
                  <div key={field.key}>
                    {field.type !== 'toggle' && (
                      <label className="text-foreground mb-1.5 block text-sm font-medium">
                        {field.label}
                      </label>
                    )}
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <SheetFooter>
          {activeCount > 0 && (
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  className="gap-1.5"
                  onClick={onClearAll}
                />
              }
            >
              <X className="h-3.5 w-3.5" />
              {t('clearAll')}
            </SheetClose>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

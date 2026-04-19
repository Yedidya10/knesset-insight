'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterBar } from '@/components/filters';
import { useFilterParams } from '@/hooks/use-filter-params';
import type { FilterFieldConfig, SortOption } from '@/components/filters';

interface MembersFilterProps {
  factions: Array<{ id: number; name: string }>;
  knessetNumbers: number[];
  currentKnessetNumber: number;
  showDetails: boolean;
}

export default function MembersFilter({
  factions,
  knessetNumbers,
  currentKnessetNumber,
  showDetails,
}: MembersFilterProps) {
  const t = useTranslations('members.filter');

  const fields: FilterFieldConfig[] = useMemo(
    () => [
      {
        key: 'search',
        type: 'search' as const,
        label: t('searchPlaceholder'),
        placeholder: t('searchPlaceholder'),
        debounceMs: 350,
      },
      {
        key: 'party',
        type: 'select' as const,
        label: t('allFactions'),
        primary: true,
        options: [
          { value: '_all', label: t('allFactions') },
          ...factions.map((f) => ({
            value: String(f.id),
            label: f.name,
          })),
        ],
      },
      {
        key: 'coalition',
        type: 'select' as const,
        label: t('coalitionAll'),
        primary: true,
        options: [
          { value: '_all', label: t('coalitionAll') },
          { value: 'coalition', label: t('coalition') },
          { value: 'opposition', label: t('opposition') },
        ],
      },
      {
        key: 'gender',
        type: 'select' as const,
        label: t('genderAll'),
        primary: true,
        options: [
          { value: '_all', label: t('genderAll') },
          { value: 'male', label: t('genderMale') },
          { value: 'female', label: t('genderFemale') },
        ],
      },
    ],
    [t, factions],
  );

  const sortOptions: SortOption[] = useMemo(
    () => [
      { value: 'name', label: t('sortByName') },
      { value: 'mostBills', label: t('sortByMostBills') },
      { value: 'mostAbsent', label: t('sortByMostAbsent') },
      { value: 'seniority', label: t('sortBySeniority') },
      { value: 'age', label: t('sortByAge') },
    ],
    [t],
  );

  const {
    filters,
    updateFilter,
    updateFilters,
    clearFilter,
    clearAll,
    activeCount,
    hasActiveFilters,
    activeFilters,
    searchValue,
    setSearchValue,
    commitSearch,
  } = useFilterParams({ fields });

  const currentKnesset = filters.knesset || String(currentKnessetNumber);
  const isCurrentKnesset = Number(currentKnesset) === currentKnessetNumber;
  const currentStatus = filters.status || 'current';

  // Knesset selector + status tabs — rendered above filters via beforeFilters slot
  const beforeFilters = (
    <div className="flex flex-wrap items-center gap-3">
      {knessetNumbers.length > 1 && (
        <Select
          value={currentKnesset}
          onValueChange={(val) => {
            updateFilters({
              knesset: val === String(currentKnessetNumber) ? '' : String(val),
              party: '',
              status: '',
            });
          }}
          items={Object.fromEntries(
            knessetNumbers.map((num) => [
              String(num),
              `${t('knessetNum')} ${num}`,
            ]),
          )}
        >
          <SelectTrigger className="font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {knessetNumbers.map((num) => (
              <SelectItem key={num} value={String(num)}>
                {t('knessetNum')} {num}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isCurrentKnesset && (
        <div className="bg-muted/60 flex gap-1.5 rounded-xl p-1.5 backdrop-blur-sm">
          {(['current', 'past'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() =>
                updateFilter('status', status === 'current' ? '' : status)
              }
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                currentStatus === status
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {status === 'current' ? t('statusCurrent') : t('statusPast')}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Details toggle — rendered after inline filters
  const afterFilters = (
    <Button
      variant={showDetails ? 'default' : 'outline'}
      size="sm"
      onClick={() => updateFilter('details', showDetails ? '' : 'true')}
      className="h-9 gap-1.5 rounded-xl"
    >
      {showDetails ? (
        <EyeOff className="h-3.5 w-3.5" />
      ) : (
        <Eye className="h-3.5 w-3.5" />
      )}
      {showDetails ? t('hideDetails') : t('showDetails')}
    </Button>
  );

  return (
    <FilterBar
      fields={fields}
      filters={filters}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onSearchCommit={commitSearch}
      onUpdateFilter={updateFilter}
      onClearFilter={clearFilter}
      onClearAll={clearAll}
      activeCount={activeCount}
      hasActiveFilters={hasActiveFilters}
      activeFilters={activeFilters}
      sortOptions={sortOptions}
      sortValue={filters.sort ?? 'name'}
      sortDefault="name"
      onSortChange={(val) => updateFilter('sort', val)}
      beforeFilters={beforeFilters}
      afterFilters={afterFilters}
    />
  );
}

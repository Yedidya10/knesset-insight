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
import { SUPPORTED_KNESSETS } from '@/lib/constants/knessets';

interface MembersFilterProps {
  factions: Array<{ id: number; name: string }>;
  politicalGroups: Array<{ id: number; name: string }>;
  knessetNumbers: number[];
  currentKnessetNumber: number;
  showDetails: boolean;
  committees: Array<{ id: number; name: string }>;
}

export default function MembersFilter({
  factions,
  politicalGroups,
  knessetNumbers,
  currentKnessetNumber,
  showDetails,
  committees,
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
        type: 'multiSelect' as const,
        label: t('allFactions'),
        primary: true,
        variant: 'checkbox',
        options: factions.map((f) => ({
          value: String(f.id),
          label: f.name,
        })),
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
      // ── Advanced filters (shown in FilterSheet) ──
      {
        key: 'politicalGroup',
        type: 'multiSelect' as const,
        label: t('politicalGroup'),
        group: t('advancedGroup'),
        variant: 'checkbox',
        options: politicalGroups.map((g) => ({
          value: String(g.id),
          label: g.name,
        })),
      },
      {
        key: 'knessetTerms',
        type: 'multiSelect' as const,
        label: t('knessetTerms'),
        group: t('advancedGroup'),
        variant: 'pills',
        options: SUPPORTED_KNESSETS.map((n) => ({
          value: String(n),
          label: `${t('knessetNum')} ${n}`,
        })),
      },
      {
        key: 'committee',
        type: 'multiSelect' as const,
        label: t('committee'),
        group: t('advancedGroup'),
        variant: 'checkbox',
        options: committees.map((c) => ({
          value: String(c.id),
          label: c.name,
        })),
      },
      {
        key: 'committeeRole',
        type: 'select' as const,
        label: t('committeeRole'),
        group: t('advancedGroup'),
        options: [
          { value: '_all', label: t('committeeRoleAll') },
          { value: 'chair', label: t('committeeRoleChair') },
          { value: 'deputy', label: t('committeeRoleDeputy') },
          { value: 'member', label: t('committeeRoleMember') },
        ],
      },
      {
        key: 'age',
        type: 'range' as const,
        label: t('ageRange'),
        group: t('advancedGroup'),
        inputType: 'number',
        fromPlaceholder: t('ageFrom'),
        toPlaceholder: t('ageTo'),
      },
      {
        key: 'seniority',
        type: 'range' as const,
        label: t('seniorityRange'),
        group: t('advancedGroup'),
        inputType: 'number',
        fromPlaceholder: t('seniorityFrom'),
        toPlaceholder: t('seniorityTo'),
      },
    ],
    [t, factions, politicalGroups, committees],
  );

  const sortFieldOptions: SortOption[] = useMemo(
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
  const sortField = filters.sort || 'name';
  const sortDir = (filters.sortDir as 'asc' | 'desc') || 'asc';

  // Knesset selector + status tabs
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
      sortFieldOptions={sortFieldOptions}
      sortField={sortField}
      sortDir={sortDir}
      onSortFieldChange={(val) => updateFilter('sort', val)}
      onSortDirChange={(dir) =>
        updateFilter('sortDir', dir === 'asc' ? '' : dir)
      }
      beforeFilters={beforeFilters}
      afterFilters={afterFilters}
    />
  );
}

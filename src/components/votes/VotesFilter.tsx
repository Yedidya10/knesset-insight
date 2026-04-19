'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { FilterBar } from '@/components/filters';
import { useFilterParams } from '@/hooks/use-filter-params';
import type { FilterFieldConfig, SortOption } from '@/components/filters';

const KNESSET_NUMBERS = [25, 24, 23, 22, 21, 20];

export default function VotesFilter() {
  const t = useTranslations('votes');

  const fields: FilterFieldConfig[] = useMemo(
    () => [
      {
        key: 'search',
        type: 'search' as const,
        label: t('filter.searchPlaceholder'),
        placeholder: t('filter.searchPlaceholder'),
        debounceMs: 400,
      },
      {
        key: 'knesset',
        type: 'select' as const,
        label: t('filter.allKnessets'),
        primary: true,
        options: [
          { value: '_all', label: t('filter.allKnessets') },
          ...KNESSET_NUMBERS.map((n) => ({
            value: String(n),
            label: `${t('knessetNum')} ${n}`,
          })),
        ],
      },
      {
        key: 'result',
        type: 'select' as const,
        label: t('filter.allResults'),
        primary: true,
        options: [
          { value: '_all', label: t('filter.allResults') },
          { value: 'approved', label: t('approved') },
          { value: 'rejected', label: t('rejected') },
        ],
      },
      // ── Advanced filters (shown in FilterSheet) ──
      {
        key: 'date',
        type: 'range' as const,
        label: t('filter.dateRange'),
        inputType: 'date' as const,
        fromKey: 'dateFrom',
        toKey: 'dateTo',
        fromPlaceholder: t('filter.dateFrom'),
        toPlaceholder: t('filter.dateTo'),
        group: t('filter.advancedGroup'),
      },
      {
        key: 'voteType',
        type: 'select' as const,
        label: t('filter.voteMethod'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '_all', label: t('filter.allMethods') },
          { value: '1', label: t('filter.methodElectronic') },
          { value: '2', label: t('filter.methodHandRaise') },
          { value: '3', label: t('filter.methodRollCall') },
        ],
      },
      {
        key: 'stage',
        type: 'select' as const,
        label: t('filter.billStage'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '_all', label: t('filter.allStages') },
          { value: '1', label: t('filter.stageFirst') },
          { value: '3', label: t('filter.stageSecondThird') },
          { value: '5', label: t('filter.stageReservation') },
          { value: '6', label: t('filter.stageOther') },
        ],
      },
      {
        key: 'reservation',
        type: 'toggle' as const,
        label: t('filter.reservationsOnly'),
        onValue: 'true',
        group: t('filter.advancedGroup'),
      },
    ],
    [t],
  );

  const sortOptions: SortOption[] = useMemo(
    () => [
      { value: 'dateDesc', label: t('sort.dateDesc') },
      { value: 'dateAsc', label: t('sort.dateAsc') },
      { value: 'mostVotes', label: t('sort.mostVotes') },
      { value: 'mostControversial', label: t('sort.mostControversial') },
    ],
    [t],
  );

  const {
    filters,
    updateFilter,
    clearFilter,
    clearAll,
    activeCount,
    hasActiveFilters,
    activeFilters,
    searchValue,
    setSearchValue,
    commitSearch,
  } = useFilterParams({ fields });

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
      sortValue={filters.sort ?? 'dateDesc'}
      sortDefault="dateDesc"
      onSortChange={(val) => updateFilter('sort', val)}
    />
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { FilterBar } from '@/components/filters';
import { useFilterParams } from '@/hooks/use-filter-params';
import type { FilterFieldConfig, SortOption } from '@/components/filters';

const KNESSET_NUMBERS = [25, 24, 23, 22, 21, 20];

interface VotesFilterProps {
  factions: Array<{ id: number; name: string }>;
  currentMembers: Array<{ id: number; name: string }>;
}

export default function VotesFilter({
  factions,
  currentMembers,
}: VotesFilterProps) {
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
        key: 'activityType',
        type: 'select' as const,
        label: t('filter.activityType'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '_all', label: t('filter.allActivities') },
          { value: 'bill', label: t('filter.activityBill') },
          { value: 'noConfidence', label: t('filter.activityNoConfidence') },
          { value: 'agenda', label: t('filter.activityAgenda') },
          { value: 'plenary', label: t('filter.activityPlenary') },
        ],
      },
      {
        key: 'voteType',
        type: 'select' as const,
        label: t('filter.voteMethod'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '_all', label: t('filter.allMethods') },
          { value: '1', label: t('filter.methodElectronic') },
          { value: '2', label: t('filter.methodByName') },
          { value: '3', label: t('filter.methodSecret') },
          { value: '4', label: t('filter.methodHandRaise') },
        ],
      },
      {
        key: 'factionId',
        type: 'select' as const,
        label: t('filter.faction'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '_all', label: t('filter.allFactions') },
          ...factions.map((f) => ({
            value: String(f.id),
            label: f.name,
          })),
        ],
      },
      {
        key: 'memberId',
        type: 'select' as const,
        label: t('filter.votingMember'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '_all', label: t('filter.allMembers') },
          ...currentMembers.map((m) => ({
            value: String(m.id),
            label: m.name,
          })),
        ],
      },
      {
        key: 'voteDirection',
        type: 'select' as const,
        label: t('filter.voteDirection'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '_all', label: t('filter.allDirections') },
          { value: 'for', label: t('filter.directionFor') },
          { value: 'against', label: t('filter.directionAgainst') },
          { value: 'present', label: t('filter.directionPresent') },
          { value: 'abstain', label: t('filter.directionAbstain') },
        ],
      },
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
    [t, factions, currentMembers],
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

'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { FilterBar } from '@/components/filters';
import { useFilterParams } from '@/hooks/use-filter-params';
import type { FilterFieldConfig, SortOption } from '@/components/filters';
import { SUPPORTED_KNESSETS } from '@/lib/constants/knessets';

interface VotesFilterProps {
  factions: Array<{ id: number; name: string }>;
  currentMembers: Array<{ id: number; name: string }>;
}

export default function VotesFilter({
  factions,
  currentMembers,
}: VotesFilterProps) {
  const t = useTranslations('votes');
  const searchParams = useSearchParams();

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
        type: 'multiSelect' as const,
        label: t('filter.knesset'),
        primary: true,
        options: SUPPORTED_KNESSETS.map((n) => ({
          value: String(n),
          label: `${t('knessetNum')} ${n}`,
        })),
      },
      // ── Result (multi-select: approved / rejected) ──
      {
        key: 'result',
        type: 'multiSelect' as const,
        label: t('filter.allResults'),
        options: [
          { value: 'approved', label: t('approved') },
          { value: 'rejected', label: t('rejected') },
        ],
      },
      // ── Advanced filters (shown in FilterSheet) ──
      {
        key: 'activityType',
        type: 'multiSelect' as const,
        label: t('filter.activityType'),
        group: t('filter.advancedGroup'),
        options: [
          { value: 'bill', label: t('filter.activityBill') },
          { value: 'noConfidence', label: t('filter.activityNoConfidence') },
          { value: 'agenda', label: t('filter.activityAgenda') },
          { value: 'plenary', label: t('filter.activityPlenary') },
        ],
      },
      {
        key: 'voteType',
        type: 'multiSelect' as const,
        label: t('filter.voteMethod'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '1', label: t('filter.methodElectronic') },
          { value: '2', label: t('filter.methodByName') },
          { value: '3', label: t('filter.methodSecret') },
          { value: '4', label: t('filter.methodHandRaise') },
        ],
      },
      {
        key: 'factionId',
        type: 'multiSelect' as const,
        variant: 'checkbox' as const,
        label: t('filter.faction'),
        group: t('filter.advancedGroup'),
        options: factions.map((f) => ({
          value: String(f.id),
          label: f.name,
        })),
      },
      {
        key: 'memberId',
        type: 'multiSelect' as const,
        variant: 'checkbox' as const,
        label: t('filter.votingMember'),
        group: t('filter.advancedGroup'),
        options: currentMembers.map((m) => ({
          value: String(m.id),
          label: m.name,
        })),
      },
      {
        key: 'voteDirection',
        type: 'multiSelect' as const,
        label: t('filter.voteDirection'),
        group: t('filter.advancedGroup'),
        options: [
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
        type: 'multiSelect' as const,
        label: t('filter.billStage'),
        group: t('filter.advancedGroup'),
        options: [
          { value: '1', label: t('filter.stageFirst') },
          { value: '3', label: t('filter.stageSecondThird') },
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

  const sortFieldOptions: SortOption[] = useMemo(
    () => [
      { value: 'date', label: t('sort.date') },
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

  // Sort state read directly from URL (not registered as filter fields)
  const sortField = searchParams.get('sort') ?? 'date';
  const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc';

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
      onSortDirChange={(dir) => updateFilter('sortDir', dir)}
    />
  );
}

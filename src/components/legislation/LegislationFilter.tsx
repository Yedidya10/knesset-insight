'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { FilterBar } from '@/components/filters';
import { useFilterParams } from '@/hooks/use-filter-params';
import type { FilterFieldConfig, SortOption } from '@/components/filters';
import { SUPPORTED_KNESSETS } from '@/lib/constants/knessets';

interface StatusOption {
  value: string;
  label: string;
}

interface LegislationFilterProps {
  billTypes: string[];
  statusOptions: StatusOption[];
  factions: Array<{ id: number; name: string }>;
  members: Array<{ id: number; name: string }>;
  committees: Array<{ id: number; name: string }>;
}

export default function LegislationFilter({
  billTypes,
  statusOptions,
  factions,
  members,
  committees,
}: LegislationFilterProps) {
  const t = useTranslations('legislation');

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
          ...SUPPORTED_KNESSETS.map((n) => ({
            value: String(n),
            label: `${t('knesset')} ${n}`,
          })),
        ],
      },
      ...(billTypes.length > 0
        ? [
            {
              key: 'type',
              type: 'select' as const,
              label: t('filter.allTypes'),
              primary: true,
              options: [
                { value: '_all', label: t('filter.allTypes') },
                ...billTypes.map((bt) => ({
                  value: bt,
                  label: t(`billType.${bt}`),
                })),
              ],
            },
          ]
        : []),
      {
        key: 'stage',
        type: 'multiSelect' as const,
        label: t('filter.stage'),
        primary: true,
        variant: 'pills' as const,
        options: [
          { value: '0', label: t('stages.submitted') },
          { value: '1', label: t('stages.preliminary') },
          { value: '2', label: t('stages.committeeFirst') },
          { value: '3', label: t('stages.firstReading') },
          { value: '4', label: t('stages.committeeSecond') },
          { value: '5', label: t('stages.secondThirdReading') },
          { value: '6', label: t('stages.passed') },
        ],
      },
      {
        key: 'dateProposed',
        type: 'range' as const,
        label: t('filter.proposedDateRange'),
        primary: true,
        inputType: 'date' as const,
        fromKey: 'dateFrom',
        toKey: 'dateTo',
        fromPlaceholder: t('filter.dateFrom'),
        toPlaceholder: t('filter.dateTo'),
      },
      ...(statusOptions.length > 0
        ? [
            {
              key: 'status',
              type: 'select' as const,
              label: t('filter.allStatuses'),
              group: t('filter.advancedGroup'),
              options: [
                { value: '_all', label: t('filter.allStatuses') },
                ...statusOptions.map((s) => ({
                  value: s.value,
                  label: s.label,
                })),
              ],
            },
          ]
        : []),
      {
        key: 'initiatorFaction',
        type: 'multiSelect' as const,
        label: t('filter.initiatorFaction'),
        group: t('filter.advancedGroup'),
        variant: 'checkbox' as const,
        options: factions.map((f) => ({
          value: String(f.id),
          label: f.name,
        })),
      },
      {
        key: 'initiatorMember',
        type: 'multiSelect' as const,
        label: t('filter.initiatorMember'),
        group: t('filter.advancedGroup'),
        variant: 'checkbox' as const,
        options: members.map((m) => ({
          value: String(m.id),
          label: m.name,
        })),
      },
      {
        key: 'committee',
        type: 'multiSelect' as const,
        label: t('filter.committee'),
        group: t('filter.advancedGroup'),
        variant: 'checkbox' as const,
        options: committees.map((c) => ({
          value: String(c.id),
          label: c.name,
        })),
      },
    ],
    [t, billTypes, statusOptions, factions, members, committees],
  );

  const sortFieldOptions: SortOption[] = useMemo(
    () => [
      { value: 'date', label: t('sort.date') },
      { value: 'name', label: t('sort.name') },
      { value: 'stage', label: t('sort.stage') },
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

  const sortField = filters.sort || 'date';
  const sortDir = (filters.sortDir as 'asc' | 'desc') || 'desc';

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
        updateFilter('sortDir', dir === 'desc' ? '' : dir)
      }
    />
  );
}

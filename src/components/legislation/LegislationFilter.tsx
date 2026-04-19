'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { FilterBar } from '@/components/filters';
import { useFilterParams } from '@/hooks/use-filter-params';
import type { FilterFieldConfig, SortOption } from '@/components/filters';

interface StatusOption {
  value: string;
  label: string;
}

interface LegislationFilterProps {
  currentSearch: string;
  currentKnessetNum: string;
  currentBillType: string;
  currentStatus: string;
  currentSort: string;
  billTypes: string[];
  statusOptions: StatusOption[];
}

const KNESSET_NUMBERS = [25, 24, 23, 22, 21, 20];

export default function LegislationFilter({
  billTypes,
  statusOptions,
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
          ...KNESSET_NUMBERS.map((n) => ({
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
      ...(statusOptions.length > 0
        ? [
            {
              key: 'status',
              type: 'select' as const,
              label: t('filter.allStatuses'),
              primary: true,
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
    ],
    [t, billTypes, statusOptions],
  );

  const sortOptions: SortOption[] = useMemo(
    () => [
      { value: 'dateDesc', label: t('sort.dateDesc') },
      { value: 'dateAsc', label: t('sort.dateAsc') },
      { value: 'nameAsc', label: t('sort.nameAsc') },
      { value: 'nameDesc', label: t('sort.nameDesc') },
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

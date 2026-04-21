'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { FilterBar } from '@/components/filters';
import { useFilterParams } from '@/hooks/use-filter-params';
import type { FilterFieldConfig, SortOption } from '@/components/filters';

interface CommitteesFilterProps {
  knessetNumbers: number[];
  committeeTypes: string[];
  chairmen: Array<{ id: number; name: string }>;
}

export default function CommitteesFilter({
  knessetNumbers,
  committeeTypes,
  chairmen,
}: CommitteesFilterProps) {
  const t = useTranslations('committees');
  const searchParams = useSearchParams();

  const fields: FilterFieldConfig[] = useMemo(
    () => [
      {
        key: 'search',
        type: 'search' as const,
        label: t('filter.searchPlaceholder'),
        placeholder: t('filter.searchPlaceholder'),
        debounceMs: 350,
      },
      {
        key: 'knesset',
        type: 'multiSelect' as const,
        label: t('filter.knesset'),
        primary: true,
        options: knessetNumbers.map((n) => ({
          value: String(n),
          label: `${t('knesset')} ${n}`,
        })),
      },
      {
        key: 'type',
        type: 'multiSelect' as const,
        label: t('filter.type'),
        primary: true,
        options: committeeTypes.map((ct) => ({ value: ct, label: ct })),
      },
      {
        key: 'active',
        type: 'toggle' as const,
        label: t('filter.activeOnly'),
        primary: true,
        onValue: 'true',
      },
      {
        key: 'chairmanId',
        type: 'multiSelect' as const,
        variant: 'checkbox' as const,
        label: t('filter.chairman'),
        group: t('filter.advancedGroup'),
        options: chairmen.map((m) => ({
          value: String(m.id),
          label: m.name,
        })),
      },
      {
        key: 'memberCount',
        type: 'range' as const,
        label: t('filter.memberCountRange'),
        inputType: 'number' as const,
        fromKey: 'memberCountFrom',
        toKey: 'memberCountTo',
        fromPlaceholder: t('filter.from'),
        toPlaceholder: t('filter.to'),
        group: t('filter.advancedGroup'),
      },
    ],
    [t, knessetNumbers, committeeTypes, chairmen],
  );

  const sortFieldOptions: SortOption[] = useMemo(
    () => [
      { value: 'name', label: t('sort.name') },
      { value: 'memberCount', label: t('sort.memberCount') },
      { value: 'knesset', label: t('sort.knesset') },
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

  const sortField = searchParams.get('sort') ?? 'name';
  const sortDir = (searchParams.get('sortDir') ?? 'asc') as 'asc' | 'desc';

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

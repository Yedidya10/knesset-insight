'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { FilterBar } from '@/components/filters';
import { useFilterParams } from '@/hooks/use-filter-params';
import type { FilterFieldConfig } from '@/components/filters';
import {
  POLICY_DOMAINS,
  POLICY_DOMAIN_LIST,
} from '@/lib/knesset/policy-domains';

interface PoliciesFilterProps {
  currentSearch: string;
  currentDomain: string;
  currentType: string;
  locale: 'he' | 'en' | 'ar' | 'ru';
}

export default function PoliciesFilter({
  locale,
}: PoliciesFilterProps) {
  const t = useTranslations('policies');

  const fields: FilterFieldConfig[] = useMemo(
    () => [
      {
        key: 'search',
        type: 'search' as const,
        label: t('searchPlaceholder'),
        placeholder: t('searchPlaceholder'),
        debounceMs: 400,
      },
      {
        key: 'domain',
        type: 'select' as const,
        label: t('allDomains'),
        primary: true,
        options: [
          { value: '_all', label: t('allDomains') },
          ...POLICY_DOMAIN_LIST.map((d) => ({
            value: d,
            label: POLICY_DOMAINS[d][locale],
          })),
        ],
      },
      {
        key: 'type',
        type: 'select' as const,
        label: t('allTypes'),
        primary: true,
        options: [
          { value: '_all', label: t('allTypes') },
          { value: 'direct', label: t('stanceType.direct') },
          { value: 'derived', label: t('stanceType.derived') },
        ],
      },
    ],
    [t, locale],
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
    />
  );
}

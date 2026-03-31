'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface VotesFilterProps {
  currentSearch: string;
  currentKnessetNum: string;
  currentResult: string;
  currentDateFrom: string;
  currentDateTo: string;
  currentSort: string;
}

export default function VotesFilter({
  currentSearch,
  currentKnessetNum,
  currentResult,
  currentDateFrom,
  currentDateTo,
  currentSort,
}: VotesFilterProps) {
  const t = useTranslations('votes');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const clearAllFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const hasActiveFilters =
    currentSearch || currentKnessetNum || currentResult || currentDateFrom || currentDateTo;

  const knessetNumbers = [25, 24, 23, 22, 21, 20];

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={currentSearch}
          onChange={(e) => updateParam('search', e.target.value)}
          placeholder={t('filter.searchPlaceholder')}
          className="w-full rounded-lg border border-border/60 bg-background py-2.5 ps-10 pe-4 text-sm shadow-sm focus:border-primary focus:outline-none"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={currentKnessetNum}
          onChange={(e) => updateParam('knessetNum', e.target.value)}
          className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
        >
          <option value="">{t('filter.knessetNum')}</option>
          {knessetNumbers.map((n) => (
            <option key={n} value={String(n)}>
              {t('knessetNum')} {n}
            </option>
          ))}
        </select>

        <select
          value={currentResult}
          onChange={(e) => updateParam('result', e.target.value)}
          className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
        >
          <option value="">{t('filter.allResults')}</option>
          <option value="approved">{t('approved')}</option>
          <option value="rejected">{t('rejected')}</option>
        </select>

        <input
          type="date"
          value={currentDateFrom}
          onChange={(e) => updateParam('dateFrom', e.target.value)}
          className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
          title={t('filter.dateFrom')}
        />

        <input
          type="date"
          value={currentDateTo}
          onChange={(e) => updateParam('dateTo', e.target.value)}
          className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
          title={t('filter.dateTo')}
        />

        <select
          value={currentSort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
        >
          <option value="dateDesc">{t('sort.dateDesc')}</option>
          <option value="dateAsc">{t('sort.dateAsc')}</option>
          <option value="mostVotes">{t('sort.mostVotes')}</option>
          <option value="mostControversial">{t('sort.mostControversial')}</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
            {t('filter.clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
}

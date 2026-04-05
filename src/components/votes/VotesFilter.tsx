'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  const activeFilterCount = [currentSearch, currentKnessetNum, currentResult, currentDateFrom, currentDateTo].filter(Boolean).length;

  const knessetNumbers = [25, 24, 23, 22, 21, 20];

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={currentSearch}
          onChange={(e) => updateParam('search', e.target.value)}
          placeholder={t('filter.searchPlaceholder')}
          className="w-full rounded-xl ps-10 pe-4"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={currentKnessetNum || '_all'}
          onValueChange={(val) => updateParam('knessetNum', val === '_all' ? '' : String(val))}
          items={{ _all: t('filter.knessetNum'), ...Object.fromEntries(knessetNumbers.map((n) => [String(n), `${t('knessetNum')} ${n}`])) }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('filter.knessetNum')}</SelectItem>
            {knessetNumbers.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t('knessetNum')} {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentResult || '_all'}
          onValueChange={(val) => updateParam('result', val === '_all' ? '' : String(val))}
          items={{ _all: t('filter.allResults'), approved: t('approved'), rejected: t('rejected') }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('filter.allResults')}</SelectItem>
            <SelectItem value="approved">{t('approved')}</SelectItem>
            <SelectItem value="rejected">{t('rejected')}</SelectItem>
          </SelectContent>
        </Select>

        <DatePicker
          value={currentDateFrom ? parseISO(currentDateFrom) : undefined}
          onChange={(date) => updateParam('dateFrom', date ? format(date, 'yyyy-MM-dd') : '')}
          placeholder={t('filter.dateFrom')}
        />

        <DatePicker
          value={currentDateTo ? parseISO(currentDateTo) : undefined}
          onChange={(date) => updateParam('dateTo', date ? format(date, 'yyyy-MM-dd') : '')}
          placeholder={t('filter.dateTo')}
        />

        <Select
          value={currentSort || 'dateDesc'}
          onValueChange={(val) => updateParam('sort', String(val))}
          items={{ dateDesc: t('sort.dateDesc'), dateAsc: t('sort.dateAsc'), mostVotes: t('sort.mostVotes'), mostControversial: t('sort.mostControversial') }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dateDesc">{t('sort.dateDesc')}</SelectItem>
            <SelectItem value="dateAsc">{t('sort.dateAsc')}</SelectItem>
            <SelectItem value="mostVotes">{t('sort.mostVotes')}</SelectItem>
            <SelectItem value="mostControversial">{t('sort.mostControversial')}</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-9 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            {t('filter.clearFilters')}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ms-1 h-5 min-w-5 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

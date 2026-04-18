'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  currentSort: string;
}

export default function VotesFilter({
  currentSearch,
  currentKnessetNum,
  currentResult,
  currentSort,
}: VotesFilterProps) {
  const t = useTranslations('votes');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

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

  const commitSearch = useCallback(
    (value: string) => {
      updateParam('search', value);
    },
    [updateParam],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => commitSearch(value), 400);
    },
    [commitSearch],
  );

  const clearAllFilters = useCallback(() => {
    setSearchValue('');
    router.push(pathname);
  }, [router, pathname]);

  const hasActiveFilters = currentSearch || currentKnessetNum || currentResult;

  const activeFilterCount = [
    currentSearch,
    currentKnessetNum,
    currentResult,
  ].filter(Boolean).length;

  const knessetNumbers = [25, 24, 23, 22, 21, 20];

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="text-muted-foreground absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              commitSearch(searchValue);
            }
          }}
          placeholder={t('filter.searchPlaceholder')}
          className="w-full rounded-xl ps-10 pe-10"
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => handleSearchChange('')}
            className="text-muted-foreground hover:text-foreground absolute inset-e-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5"
            aria-label={t('filter.clearFilters')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={currentKnessetNum || '_all'}
          onValueChange={(val) =>
            updateParam('knesset', val === '_all' ? '' : (val ?? ''))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('filter.allKnessets')}</SelectItem>
            {knessetNumbers.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t('knessetNum')} {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentResult || '_all'}
          onValueChange={(val) =>
            updateParam('result', val === '_all' ? '' : (val ?? ''))
          }
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

        <Select
          value={currentSort || 'dateDesc'}
          onValueChange={(val) => updateParam('sort', val ?? 'dateDesc')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dateDesc">{t('sort.dateDesc')}</SelectItem>
            <SelectItem value="dateAsc">{t('sort.dateAsc')}</SelectItem>
            <SelectItem value="mostVotes">{t('sort.mostVotes')}</SelectItem>
            <SelectItem value="mostControversial">
              {t('sort.mostControversial')}
            </SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-foreground h-9 gap-1.5 rounded-xl"
          >
            <X className="h-3.5 w-3.5" />
            {t('filter.clearFilters')}
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ms-1 h-5 min-w-5 px-1 text-[10px]"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

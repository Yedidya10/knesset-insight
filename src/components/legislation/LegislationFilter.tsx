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

export default function LegislationFilter({
  currentSearch,
  currentKnessetNum,
  currentBillType,
  currentStatus,
  currentSort,
  billTypes,
  statusOptions,
}: LegislationFilterProps) {
  const t = useTranslations('legislation');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external prop changes (e.g. clear filters)
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

  const hasActiveFilters =
    currentSearch || currentKnessetNum || currentBillType || currentStatus;

  const activeFilterCount = [
    currentSearch,
    currentKnessetNum,
    currentBillType,
    currentStatus,
  ].filter(Boolean).length;

  const knessetNumbers = [25, 24, 23, 22, 21, 20];

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
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
          onValueChange={(val) => updateParam('knesset', val === '_all' ? '' : String(val))}
          items={{
            _all: t('filter.allKnessets'),
            ...Object.fromEntries(
              knessetNumbers.map((n) => [String(n), `${t('knesset')} ${n}`]),
            ),
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('filter.allKnessets')}</SelectItem>
            {knessetNumbers.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t('knesset')} {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {billTypes.length > 0 && (
          <Select
            value={currentBillType || '_all'}
            onValueChange={(val) => updateParam('type', val === '_all' ? '' : String(val))}
            items={{
              _all: t('filter.allTypes'),
              ...Object.fromEntries(billTypes.map((bt) => [bt, t(`billType.${bt}`)])),
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t('filter.allTypes')}</SelectItem>
              {billTypes.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {t(`billType.${bt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {statusOptions.length > 0 && (
          <Select
            value={currentStatus || '_all'}
            onValueChange={(val) => updateParam('status', val === '_all' ? '' : String(val))}
            items={{
              _all: t('filter.allStatuses'),
              ...Object.fromEntries(statusOptions.map((s) => [s.value, s.label])),
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t('filter.allStatuses')}</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={currentSort || 'dateDesc'}
          onValueChange={(val) => updateParam('sort', String(val))}
          items={{
            dateDesc: t('sort.dateDesc'),
            dateAsc: t('sort.dateAsc'),
            nameAsc: t('sort.nameAsc'),
            nameDesc: t('sort.nameDesc'),
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dateDesc">{t('sort.dateDesc')}</SelectItem>
            <SelectItem value="dateAsc">{t('sort.dateAsc')}</SelectItem>
            <SelectItem value="nameAsc">{t('sort.nameAsc')}</SelectItem>
            <SelectItem value="nameDesc">{t('sort.nameDesc')}</SelectItem>
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

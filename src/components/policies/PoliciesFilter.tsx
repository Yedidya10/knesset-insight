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
import {
  POLICY_DOMAINS,
  type PolicyDomain,
  POLICY_DOMAIN_LIST,
} from '@/lib/knesset/policy-domains';

interface PoliciesFilterProps {
  currentSearch: string;
  currentDomain: string;
  currentType: string;
  locale: 'he' | 'en' | 'ar' | 'ru';
}

export default function PoliciesFilter({
  currentSearch,
  currentDomain,
  currentType,
  locale,
}: PoliciesFilterProps) {
  const t = useTranslations('policies');
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

  const hasActiveFilters = currentSearch || currentDomain || currentType;

  const activeFilterCount = [currentSearch, currentDomain, currentType].filter(
    Boolean,
  ).length;

  const domainItems: Record<string, string> = {
    _all: t('allDomains'),
    ...Object.fromEntries(
      POLICY_DOMAIN_LIST.map((d) => [d, POLICY_DOMAINS[d][locale]]),
    ),
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
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
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-xl ps-10 pe-10"
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => handleSearchChange('')}
            className="text-muted-foreground hover:text-foreground absolute end-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5"
            aria-label={t('clearFilters')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={currentDomain || '_all'}
          onValueChange={(val) =>
            updateParam('domain', val === '_all' ? '' : String(val))
          }
          items={domainItems}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allDomains')}</SelectItem>
            {POLICY_DOMAIN_LIST.map((d) => (
              <SelectItem key={d} value={d}>
                {POLICY_DOMAINS[d][locale]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentType || '_all'}
          onValueChange={(val) =>
            updateParam('type', val === '_all' ? '' : String(val))
          }
          items={{
            _all: t('allTypes'),
            direct: t('stanceType.direct'),
            derived: t('stanceType.derived'),
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allTypes')}</SelectItem>
            <SelectItem value="direct">{t('stanceType.direct')}</SelectItem>
            <SelectItem value="derived">{t('stanceType.derived')}</SelectItem>
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
            {t('clearFilters')}
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

'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useState, useEffect, useRef } from 'react';
import { Search, X, Eye, EyeOff } from 'lucide-react';
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

interface MembersFilterProps {
  factions: Array<{ id: number; name: string }>;
  currentFaction: string;
  currentSort: string;
  currentStatus: string;
  currentSearch: string;
  knessetNumbers: number[];
  currentKnesset: string;
  currentCoalition: string;
  currentGender: string;
  currentKnessetNumber: number;
  showDetails: boolean;
}

export default function MembersFilter({
  factions,
  currentFaction,
  currentSort,
  currentStatus,
  currentSearch,
  knessetNumbers,
  currentKnesset,
  currentCoalition,
  currentGender,
  currentKnessetNumber,
  showDetails,
}: MembersFilterProps) {
  const t = useTranslations('members.filter');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCurrentKnesset = Number(currentKnesset) === currentKnessetNumber;

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // Debounced search
  useEffect(() => {
    if (searchValue === currentSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam('search', searchValue);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue, currentSearch, updateParam]);

  // Sync external changes
  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  const clearAllFilters = useCallback(() => {
    setSearchValue('');
    router.push(pathname);
  }, [router, pathname]);

  const hasActiveFilters =
    currentFaction ||
    currentSearch ||
    currentCoalition ||
    currentGender ||
    (isCurrentKnesset && currentStatus !== 'current') ||
    Number(currentKnesset) !== currentKnessetNumber;
  const activeFilterCount =
    [currentFaction, currentSearch, currentCoalition, currentGender].filter(
      Boolean,
    ).length +
    (isCurrentKnesset && currentStatus !== 'current' ? 1 : 0) +
    (Number(currentKnesset) !== currentKnessetNumber ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Row 1: Knesset selector (primary context) + status tabs (conditional) */}
      <div className="flex flex-wrap items-center gap-3">
        {knessetNumbers.length > 1 && (
          <Select
            value={currentKnesset || String(currentKnessetNumber)}
            onValueChange={(val) => {
              updateParams({
                knesset:
                  val === String(currentKnessetNumber) ? '' : String(val),
                party: '',
                status: '',
              });
            }}
            items={Object.fromEntries(
              knessetNumbers.map((num) => [
                String(num),
                `${t('knessetNum')} ${num}`,
              ]),
            )}
          >
            <SelectTrigger className="font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {knessetNumbers.map((num) => (
                <SelectItem key={num} value={String(num)}>
                  {t('knessetNum')} {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status tabs — only shown for current knesset */}
        {isCurrentKnesset && (
          <div className="bg-muted/60 flex gap-1.5 rounded-xl p-1.5 backdrop-blur-sm">
            {(['current', 'past'] as const).map((status) => (
              <button
                key={status}
                onClick={() =>
                  updateParam('status', status === 'current' ? '' : status)
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  currentStatus === status
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status === 'current' ? t('statusCurrent') : t('statusPast')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Row 2: Search bar */}
      <div className="relative">
        <Search className="text-muted-foreground absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-xl ps-10 pe-4"
        />
      </div>

      {/* Row 3: Filters + sort + details toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={currentFaction || '_all'}
          onValueChange={(val) =>
            updateParam('party', val === '_all' ? '' : String(val))
          }
          items={{
            _all: t('allFactions'),
            ...Object.fromEntries(factions.map((f) => [String(f.id), f.name])),
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="_all">{t('allFactions')}</SelectItem>
            {factions.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentCoalition || '_all'}
          onValueChange={(val) =>
            updateParam('coalition', val === '_all' ? '' : String(val))
          }
          items={{
            _all: t('coalitionAll'),
            coalition: t('coalition'),
            opposition: t('opposition'),
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('coalitionAll')}</SelectItem>
            <SelectItem value="coalition">{t('coalition')}</SelectItem>
            <SelectItem value="opposition">{t('opposition')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={currentGender || '_all'}
          onValueChange={(val) =>
            updateParam('gender', val === '_all' ? '' : String(val))
          }
          items={{
            _all: t('genderAll'),
            male: t('genderMale'),
            female: t('genderFemale'),
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('genderAll')}</SelectItem>
            <SelectItem value="male">{t('genderMale')}</SelectItem>
            <SelectItem value="female">{t('genderFemale')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={currentSort || 'name'}
          onValueChange={(val) => updateParam('sort', String(val))}
          items={{
            name: t('sortByName'),
            mostBills: t('sortByMostBills'),
            mostAbsent: t('sortByMostAbsent'),
            seniority: t('sortBySeniority'),
            age: t('sortByAge'),
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t('sortByName')}</SelectItem>
            <SelectItem value="mostBills">{t('sortByMostBills')}</SelectItem>
            <SelectItem value="mostAbsent">{t('sortByMostAbsent')}</SelectItem>
            <SelectItem value="seniority">{t('sortBySeniority')}</SelectItem>
            <SelectItem value="age">{t('sortByAge')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Details toggle */}
        <Button
          variant={showDetails ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateParam('details', showDetails ? '' : 'true')}
          className="h-9 gap-1.5 rounded-xl"
        >
          {showDetails ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {showDetails ? t('hideDetails') : t('showDetails')}
        </Button>

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
                className="ms-1 h-5 min-w-5 px-1 text-xs"
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

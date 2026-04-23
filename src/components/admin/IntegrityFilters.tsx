'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INTEGRITY_GROUPS } from '@/lib/integrity/categories';

const SEVERITIES = ['info', 'warning', 'serious', 'critical'] as const;
const SOURCE_TYPES = ['web', 'gov'] as const;
const STATUS_FILTERS = ['pending', 'verified', 'all'] as const;

interface Props {
  search: string;
  group: string;
  severity: string;
  source: string;
  status: string;
}

export default function IntegrityFilters({
  search,
  group,
  severity,
  source,
  status,
}: Props) {
  const t = useTranslations('admin.integrity.filters');
  const tGroups = useTranslations('integrity.groups');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== '_all') next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setParam('search', String(form.get('search') ?? '').trim());
  }

  const hasAny = search || group || severity || source || status;

  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <form onSubmit={onSearchSubmit} className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            name="search"
            defaultValue={search}
            placeholder={t('searchPlaceholder')}
            className="ps-8"
            disabled={pending}
          />
        </form>

        <Select
          value={group || '_all'}
          onValueChange={(v) =>
            setParam('group', v === '_all' ? '' : (v ?? ''))
          }
          items={{
            _all: t('allGroups'),
            ...Object.fromEntries(INTEGRITY_GROUPS.map((g) => [g, tGroups(g)])),
          }}
        >
          <SelectTrigger disabled={pending}>
            <SelectValue placeholder={t('allGroups')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allGroups')}</SelectItem>
            {INTEGRITY_GROUPS.map((g) => (
              <SelectItem key={g} value={g}>
                {tGroups(g)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={severity || '_all'}
          onValueChange={(v) =>
            setParam('severity', v === '_all' ? '' : (v ?? ''))
          }
          items={{
            _all: t('allSeverities'),
            ...Object.fromEntries(
              SEVERITIES.map((s) => [s, t(`severity.${s}`)]),
            ),
          }}
        >
          <SelectTrigger disabled={pending}>
            <SelectValue placeholder={t('allSeverities')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allSeverities')}</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`severity.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={source || '_all'}
          onValueChange={(v) =>
            setParam('source', v === '_all' ? '' : (v ?? ''))
          }
          items={{
            _all: t('allSources'),
            ...Object.fromEntries(
              SOURCE_TYPES.map((s) => [s, t(`source.${s}`)]),
            ),
          }}
        >
          <SelectTrigger disabled={pending}>
            <SelectValue placeholder={t('allSources')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allSources')}</SelectItem>
            {SOURCE_TYPES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`source.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || 'pending'}
          onValueChange={(v) => setParam('status', v ?? '')}
          items={Object.fromEntries(
            STATUS_FILTERS.map((s) => [s, t(`status.${s}`)]),
          )}
        >
          <SelectTrigger disabled={pending}>
            <SelectValue placeholder={t('status.pending')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasAny && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              startTransition(() => {
                router.replace(pathname, { scroll: false });
              });
            }}
          >
            <X className="me-1 h-4 w-4" />
            {t('clear')}
          </Button>
        </div>
      )}
    </div>
  );
}

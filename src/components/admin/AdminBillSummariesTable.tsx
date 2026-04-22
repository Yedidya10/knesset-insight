'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  Shield,
  Search,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type BillSummaryRow = {
  id: number;
  knessetId: number;
  name: string;
  knessetNum: number | null;
  status: string | null;
  billType: string | null;
  currentStage: number | null;
  lastUpdate: string | null;
  hasOfficial: boolean;
  hasAi: boolean;
  aiSourceType: string | null;
  aiGeneratedAt: string | null;
  needsReview: boolean;
};

type Filter = 'all' | 'missing' | 'ai_only' | 'official' | 'needs_review';

type Props = {
  rows: BillSummaryRow[];
  counts: Record<Filter, number>;
  filter: Filter;
  knesset: number | undefined;
  query: string;
  knessetOptions: number[];
  locale: string;
};

const MAX_PER_BATCH = 25;

export default function AdminBillSummariesTable({
  rows,
  counts,
  filter,
  knesset,
  query,
  knessetOptions,
}: Props) {
  const t = useTranslations('admin.billSummaries');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [lastRunSummary, setLastRunSummary] = useState<string | null>(null);
  const [qLocal, setQLocal] = useState(query);

  const selectableRows = useMemo(
    () => rows.filter((r) => !r.hasOfficial),
    [rows],
  );

  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selected.has(r.id));

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(selectableRows.slice(0, MAX_PER_BATCH).map((r) => r.id)),
      );
    }
  };

  const updateQuery = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery('q', qLocal || null);
  };

  const handleBulkRegenerate = async () => {
    if (selected.size === 0 || busy) return;
    if (selected.size > MAX_PER_BATCH) {
      setLastRunSummary(t('batchTooLarge', { max: MAX_PER_BATCH }));
      return;
    }
    const confirmMsg = t('bulkConfirm', { count: selected.size });
    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setLastRunSummary(t('bulkStarted', { count: selected.size }));
    try {
      const res = await fetch('/api/admin/bills/regenerate-summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLastRunSummary(
          t('bulkFailed', { message: data?.message ?? data?.error ?? '' }),
        );
      } else {
        const ok = data.results.filter(
          (r: { status: string }) => r.status === 'ok',
        ).length;
        const skipped = data.results.filter(
          (r: { status: string }) => r.status === 'skipped_official',
        ).length;
        const failed = data.results.filter(
          (r: { status: string }) =>
            r.status === 'error' || r.status === 'no_summary',
        ).length;
        setLastRunSummary(
          t('bulkDone', {
            ok,
            skipped,
            failed,
            tokens: data.totalTokens ?? 0,
          }),
        );
        setSelected(new Set());
        router.refresh();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastRunSummary(t('bulkFailed', { message }));
    } finally {
      setBusy(false);
    }
  };

  const filterTabs: { key: Filter; label: string }[] = [
    { key: 'all', label: t('filters.all') },
    { key: 'missing', label: t('filters.missing') },
    { key: 'ai_only', label: t('filters.aiOnly') },
    { key: 'needs_review', label: t('filters.needsReview') },
    { key: 'official', label: t('filters.official') },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-64 ps-8"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            {t('search')}
          </Button>
        </form>

        <Select
          value={knesset ? String(knesset) : 'all'}
          onValueChange={(v) => updateQuery('knesset', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('anyKnesset')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('anyKnesset')}</SelectItem>
            {knessetOptions.map((k) => (
              <SelectItem key={k} value={String(k)}>
                {t('knessetN', { n: k })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ms-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {t('selectedCount', { count: selected.size, max: MAX_PER_BATCH })}
          </span>
          <Button
            type="button"
            onClick={handleBulkRegenerate}
            disabled={selected.size === 0 || busy}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {busy ? t('regenerating') : t('regenerateSelected')}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() =>
                updateQuery('filter', tab.key === 'all' ? null : tab.key)
              }
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {tab.label}
              <span
                className={`ms-1.5 text-[10px] ${
                  active ? 'opacity-80' : 'text-muted-foreground'
                }`}
              >
                ({counts[tab.key]})
              </span>
            </button>
          );
        })}
      </div>

      {lastRunSummary && (
        <div className="bg-muted text-muted-foreground rounded-md border p-3 text-sm">
          {lastRunSummary}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-start text-xs">
            <tr>
              <th className="w-10 p-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={t('selectAll')}
                />
              </th>
              <th className="p-2 text-start font-medium">{t('col.name')}</th>
              <th className="p-2 text-start font-medium">{t('col.status')}</th>
              <th className="p-2 text-start font-medium">{t('col.summary')}</th>
              <th className="p-2 text-start font-medium">{t('col.updated')}</th>
              <th className="w-10 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground p-8 text-center"
                >
                  {t('noResults')}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isSelectable = !row.hasOfficial;
              const isChecked = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  className="hover:bg-muted/40 border-b last:border-b-0"
                >
                  <td className="p-2">
                    {isSelectable ? (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRow(row.id)}
                        aria-label={t('selectRow', { name: row.name })}
                      />
                    ) : (
                      <Shield
                        className="text-muted-foreground h-4 w-4"
                        aria-label={t('hasOfficialSummary')}
                      />
                    )}
                  </td>
                  <td className="p-2">
                    <div className="line-clamp-2 max-w-xl text-sm font-medium">
                      {row.name}
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-1 text-[10px]">
                      {row.knessetNum && (
                        <span>{t('knessetN', { n: row.knessetNum })}</span>
                      )}
                      {row.billType && <span>· {row.billType}</span>}
                    </div>
                  </td>
                  <td className="p-2 text-xs">{row.status ?? '—'}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {row.hasOfficial && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                        >
                          <Shield className="h-3 w-3" />
                          {t('badge.official')}
                        </Badge>
                      )}
                      {!row.hasOfficial && row.hasAi && (
                        <Badge variant="outline" className="gap-1">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          {t('badge.ai')}
                          {row.aiSourceType && (
                            <span className="text-muted-foreground ms-1">
                              · {row.aiSourceType}
                            </span>
                          )}
                        </Badge>
                      )}
                      {!row.hasOfficial && !row.hasAi && (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          {t('badge.missing')}
                        </Badge>
                      )}
                      {row.needsReview && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500 text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {t('needsReview')}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground p-2 text-xs">
                    {row.lastUpdate
                      ? new Date(row.lastUpdate).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="p-2">
                    <Link
                      href={`/legislation/${row.id}`}
                      className="text-muted-foreground hover:text-primary inline-flex"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('openBill')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs">
        {t('resultsNote', { count: rows.length })}
      </p>
    </div>
  );
}

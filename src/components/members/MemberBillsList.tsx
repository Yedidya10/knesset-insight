'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TranslatedText from '@/components/ui/translated-text';
import { getBillStatusText } from '@/lib/knesset/bill-status';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 10;

interface Bill {
  billId: number;
  billName: string;
  billStatus: string | null;
  billKnessetNum: number | null;
  proposedDate: string | null;
  isPrimary: boolean | null;
}

interface MemberBillsListProps {
  bills: Bill[];
}

export default function MemberBillsList({ bills }: MemberBillsListProps) {
  const t = useTranslations('members.profile');
  const tCommon = useTranslations('common');

  const [knessetFilter, setKnessetFilter] = useState<string>('_all');
  const [statusFilter, setStatusFilter] = useState<string>('_all');
  const [page, setPage] = useState(1);

  // Extract unique knesset numbers and statuses from the bills
  const knessetNumbers = useMemo(() => {
    const nums = new Set<number>();
    for (const b of bills) {
      if (b.billKnessetNum) nums.add(b.billKnessetNum);
    }
    return Array.from(nums).sort((a, b) => b - a);
  }, [bills]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    for (const b of bills) {
      if (b.billStatus) statuses.add(b.billStatus);
    }
    return Array.from(statuses)
      .map((s) => ({ value: s, label: getBillStatusText(s) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'he'));
  }, [bills]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (knessetFilter !== '_all' && String(b.billKnessetNum) !== knessetFilter)
        return false;
      if (statusFilter !== '_all' && b.billStatus !== statusFilter)
        return false;
      return true;
    });
  }, [bills, knessetFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE));
  const paginatedBills = filteredBills.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = knessetFilter !== '_all' || statusFilter !== '_all';

  function handleFilterChange(setter: (v: string) => void, val: string | null) {
    setter(val ?? '_all');
    setPage(1);
  }

  return (
    <div>
      {/* Filters */}
      {bills.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {knessetNumbers.length > 1 && (
            <Select
              value={knessetFilter}
              onValueChange={(val) => handleFilterChange(setKnessetFilter, val)}
              items={{
                _all: t('allKnessets'),
                ...Object.fromEntries(
                  knessetNumbers.map((n) => [String(n), t('knesset', { num: n })]),
                ),
              }}
            >
              <SelectTrigger className="w-auto min-w-30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t('allKnessets')}</SelectItem>
                {knessetNumbers.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {t('knesset', { num: n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {statusOptions.length > 1 && (
            <Select
              value={statusFilter}
              onValueChange={(val) => handleFilterChange(setStatusFilter, val)}
              items={{
                _all: t('allStatuses'),
                ...Object.fromEntries(
                  statusOptions.map((s) => [s.value, s.label]),
                ),
              }}
            >
              <SelectTrigger className="w-auto min-w-35">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t('allStatuses')}</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setKnessetFilter('_all');
                setStatusFilter('_all');
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Bills list */}
      {paginatedBills.length > 0 ? (
        <div className="space-y-2">
          {paginatedBills.map((b) => (
            <Link
              key={b.billId}
              href={`/legislation/${b.billId}`}
              className="block"
            >
              <div className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <TranslatedText text={b.billName} />
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {b.proposedDate && (
                      <span>
                        {new Date(b.proposedDate).toLocaleDateString('he-IL')}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {b.isPrimary
                        ? t('primaryInitiator')
                        : t('secondaryInitiator')}
                    </Badge>
                  </div>
                </div>
                {b.billStatus && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    <TranslatedText text={getBillStatusText(b.billStatus)} />
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noBills')}</p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('pageOf', { current: page, total: totalPages })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronRight className="h-4 w-4 rtl:hidden" />
              <ChevronLeft className="h-4 w-4 ltr:hidden" />
              {tCommon('previous')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {tCommon('next')}
              <ChevronLeft className="h-4 w-4 rtl:hidden" />
              <ChevronRight className="h-4 w-4 ltr:hidden" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

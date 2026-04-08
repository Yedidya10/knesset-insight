'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  GitMerge,
  GitBranch,
  Pause,
  ArrowRightLeft,
  Ban,
  CalendarOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SpecialStatus } from '@/lib/knesset/bill-stages';

interface BillUnionInfo {
  id: number;
  mainBillId: number;
  mainBillName: string | null;
  mainBillKnessetId: number;
}

interface BillSplitInfo {
  id: number;
  splitBillId: number;
  splitBillName: string | null;
  splitBillKnessetId: number;
}

interface BillSplitFromInfo {
  id: number;
  mainBillId: number;
  mainBillName: string | null;
  mainBillKnessetId: number;
}

interface BillMergedFromInfo {
  id: number;
  unionBillId: number;
  unionBillName: string | null;
  unionBillKnessetId: number;
}

interface BillRelationshipBannerProps {
  specialStatus: SpecialStatus;
  isContinuationBill: boolean | null;
  unions: BillUnionInfo[];
  splits: BillSplitInfo[];
  splitFrom?: BillSplitFromInfo[];
  mergedFrom?: BillMergedFromInfo[];
}

export function BillRelationshipBanner({
  specialStatus,
  isContinuationBill,
  unions,
  splits,
  splitFrom = [],
  mergedFrom = [],
}: BillRelationshipBannerProps) {
  const t = useTranslations('legislation.special');

  const banners: React.ReactNode[] = [];

  // Continuity bill badge
  if (isContinuationBill) {
    banners.push(
      <div
        key="continuity"
        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30"
      >
        <CalendarOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-amber-800 dark:text-amber-200">
          {t('continuity')}
        </span>
      </div>,
    );
  }

  // Merged banner
  if (specialStatus === 'merged') {
    banners.push(
      <div
        key="merged"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm dark:border-violet-800 dark:bg-violet-950/30"
      >
        <GitMerge className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
        {unions.length > 0 ? (
          <>
            <span className="text-violet-800 dark:text-violet-200">
              {t('mergedWith')}
            </span>
            {unions.map((u) => (
              <Link
                key={u.id}
                href={`/legislation/${u.mainBillId}`}
                className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
              >
                {u.mainBillName ?? `#${u.mainBillKnessetId}`}
              </Link>
            ))}
          </>
        ) : (
          <span className="text-violet-800 dark:text-violet-200">
            {t('merged')}
          </span>
        )}
      </div>,
    );
  }

  // Split banner (this bill was split into children)
  if (splits.length > 0) {
    banners.push(
      <div
        key="split"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-800 dark:bg-sky-950/30"
      >
        <GitBranch className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="text-sky-800 dark:text-sky-200">{t('splitInto')}</span>
        {splits.map((s) => (
          <Link
            key={s.id}
            href={`/legislation/${s.splitBillId}`}
            className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
          >
            {s.splitBillName ?? `#${s.splitBillKnessetId}`}
          </Link>
        ))}
      </div>,
    );
  }

  // Split-from banner (this bill was split FROM a parent)
  if (splitFrom.length > 0) {
    banners.push(
      <div
        key="splitFrom"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-800 dark:bg-sky-950/30"
      >
        <GitBranch className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="text-sky-800 dark:text-sky-200">{t('splitFrom')}</span>
        {splitFrom.map((sf) => (
          <Link
            key={sf.id}
            href={`/legislation/${sf.mainBillId}`}
            className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
          >
            {sf.mainBillName ?? `#${sf.mainBillKnessetId}`}
          </Link>
        ))}
      </div>,
    );
  }

  // Merged-from banner (other bills were absorbed INTO this one)
  if (mergedFrom.length > 0) {
    banners.push(
      <div
        key="mergedFrom"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm dark:border-violet-800 dark:bg-violet-950/30"
      >
        <GitMerge className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
        <span className="text-violet-800 dark:text-violet-200">
          {t('includesMerge')}
        </span>
        {mergedFrom.map((mf) => (
          <Link
            key={mf.id}
            href={`/legislation/${mf.unionBillId}`}
            className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
          >
            {mf.unionBillName ?? `#${mf.unionBillKnessetId}`}
          </Link>
        ))}
      </div>,
    );
  }

  // Stopped
  if (specialStatus === 'stopped') {
    banners.push(
      <div
        key="stopped"
        className="border-destructive/30 bg-destructive/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <Pause className="text-destructive h-4 w-4 shrink-0" />
        <span className="text-destructive">{t('stopped')}</span>
      </div>,
    );
  }

  // Converted
  if (specialStatus === 'converted') {
    banners.push(
      <div
        key="converted"
        className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm dark:border-orange-800 dark:bg-orange-950/30"
      >
        <ArrowRightLeft className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
        <span className="text-orange-800 dark:text-orange-200">
          {t('converted')}
        </span>
      </div>,
    );
  }

  // Continuity rejected
  if (specialStatus === 'continuityRejected') {
    banners.push(
      <div
        key="continuityRejected"
        className="border-destructive/30 bg-destructive/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <Ban className="text-destructive h-4 w-4 shrink-0" />
        <span className="text-destructive">{t('continuityRejected')}</span>
      </div>,
    );
  }

  // Removed from agenda
  if (specialStatus === 'removedFromAgenda') {
    banners.push(
      <div
        key="removed"
        className="border-muted bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <Ban className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="text-muted-foreground">{t('removedFromAgenda')}</span>
      </div>,
    );
  }

  if (banners.length === 0) return null;

  return <div className="flex flex-col gap-2">{banners}</div>;
}

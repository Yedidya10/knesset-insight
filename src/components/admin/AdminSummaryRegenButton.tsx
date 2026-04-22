'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Props = {
  billId: number;
  /** True when the summary appears stale (bill advanced / new docs after last generation). */
  needsReview?: boolean;
  /** Rendered inline next to existing headers — compact variant. */
  compact?: boolean;
};

type Outcome = {
  ok: boolean;
  tokensUsed?: number;
  sourceType?: string;
  docsRead?: number;
  message?: string;
};

export default function AdminSummaryRegenButton({
  billId,
  needsReview,
  compact,
}: Props) {
  const t = useTranslations('admin.billSummaries');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch(`/api/admin/bills/${billId}/regenerate-summary`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setOutcome({
          ok: false,
          message: data?.message ?? data?.error ?? `HTTP ${res.status}`,
        });
      } else {
        setOutcome({
          ok: data.ok,
          tokensUsed: data.tokensUsed,
          sourceType: data.sourceType,
          docsRead: data.docsRead,
          message: data.ok ? undefined : data.reason,
        });
        if (data.ok) {
          // Refresh page to show the new summary
          setTimeout(() => window.location.reload(), 800);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOutcome({ ok: false, message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        compact ? 'inline-flex items-center gap-2' : 'flex flex-col gap-2'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={needsReview ? 'default' : 'outline'}
          onClick={handleClick}
          disabled={busy}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? t('regenerating') : t('regenerate')}
        </Button>
        {needsReview && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500 text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle className="h-3 w-3" />
            {t('needsReview')}
          </Badge>
        )}
      </div>
      {outcome && (
        <div className="text-xs">
          {outcome.ok ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {t('regenSuccess', {
                tokens: outcome.tokensUsed ?? 0,
                source: outcome.sourceType ?? '',
                docs: outcome.docsRead ?? 0,
              })}
            </span>
          ) : (
            <span className="text-destructive">
              {t('regenFailed')}: {outcome.message ?? ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

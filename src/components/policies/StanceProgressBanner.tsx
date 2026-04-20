import { getTranslations, getLocale } from 'next-intl/server';
import { sql } from 'drizzle-orm';
import { BarChart3, AlertTriangle, Info, FlaskConical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { db } from '@/lib/db';

type ProgressRow = {
  knesset_num: number;
  total_eligible: number;
  classified: number;
  reservation_count: number;
  direct_stances: number;
};

export default async function StanceProgressBanner() {
  const t = await getTranslations('policies.progress');
  const locale = (await getLocale()) as 'he' | 'en' | 'ar' | 'ru';

  const progressRows = await db.execute<ProgressRow>(sql`
    WITH all_bill_votes AS (
      SELECT v.knesset_num, COUNT(DISTINCT v.id)::int AS total_eligible
      FROM votes v
      INNER JOIN bills b ON b.id = v.bill_id
      WHERE v.is_reservation = false
      GROUP BY v.knesset_num
    ),
    analyzed_votes AS (
      SELECT v.knesset_num,
        COUNT(DISTINCT vsa.vote_id)::int AS classified,
        COUNT(DISTINCT ps.id) FILTER (WHERE ps.stance_type = 'direct')::int AS direct_stances
      FROM votes v
      INNER JOIN bills b ON b.id = v.bill_id
      LEFT JOIN vote_stance_alignment vsa ON vsa.vote_id = v.id
      LEFT JOIN policy_stances ps ON ps.id = vsa.stance_id
      WHERE b.ai_summary IS NOT NULL AND v.is_reservation = false
      GROUP BY v.knesset_num
    ),
    reservation_counts AS (
      SELECT knesset_num, COUNT(*)::int AS reservation_count
      FROM votes WHERE is_reservation = true
      GROUP BY knesset_num
    )
    SELECT
      abv.knesset_num,
      abv.total_eligible,
      COALESCE(av.classified, 0) AS classified,
      COALESCE(rc.reservation_count, 0) AS reservation_count,
      COALESCE(av.direct_stances, 0) AS direct_stances
    FROM all_bill_votes abv
    LEFT JOIN analyzed_votes av ON av.knesset_num = abv.knesset_num
    LEFT JOIN reservation_counts rc ON rc.knesset_num = abv.knesset_num
    ORDER BY abv.knesset_num DESC
  `);

  if (progressRows.length === 0) return null;

  // Aggregate totals — use eligible (bill votes only) as denominator
  const totals = progressRows.reduce(
    (acc, row) => ({
      eligible: acc.eligible + row.total_eligible,
      classified: acc.classified + row.classified,
      reservations: acc.reservations + row.reservation_count,
    }),
    { eligible: 0, classified: 0, reservations: 0 },
  );

  const coveragePercent =
    totals.eligible > 0
      ? Math.round((totals.classified / totals.eligible) * 100)
      : 0;

  const fmtLocale = locale === 'he' ? 'he-IL' : locale;

  return (
    <TooltipProvider>
      <Card className="mb-6 border-amber-200/60 bg-gradient-to-b from-amber-50/40 to-blue-50/40 dark:border-amber-900/40 dark:from-amber-950/10 dark:to-blue-950/15">
        <CardContent className="p-4 sm:p-5">
          {/* Beta notice + title row */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                {t('title')}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 dark:bg-amber-900/30">
              <FlaskConical className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {t('beta')}
              </span>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300">
                {t('classifiedVotes')}
                {progressRows.length === 1 && (
                  <Badge variant="outline" className="text-[10px]">
                    {t('knesset', { num: progressRows[0].knesset_num })}
                  </Badge>
                )}
              </span>
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                <span dir="ltr" className="inline-block">
                  {coveragePercent}%
                </span>{' '}
                ({totals.classified.toLocaleString(fmtLocale)} /{' '}
                {totals.eligible.toLocaleString(fmtLocale)})
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
              <div
                className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-400"
                style={{ width: `${Math.max(coveragePercent, 1)}%` }}
              />
            </div>
          </div>

          {/* Per-knesset breakdown — only shown when multiple knessets */}
          {progressRows.length > 1 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {progressRows.map((row) => {
                const pct =
                  row.total_eligible > 0
                    ? Math.round((row.classified / row.total_eligible) * 100)
                    : 0;
                return (
                  <div
                    key={row.knesset_num}
                    className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 dark:bg-white/5"
                  >
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {t('knesset', { num: row.knesset_num })}
                    </Badge>
                    <div className="flex-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
                        <div
                          className="h-full rounded-full bg-blue-600 dark:bg-blue-400"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                    </div>
                    <span
                      dir="ltr"
                      className="text-xs font-medium text-blue-800 tabular-nums dark:text-blue-200"
                    >
                      {pct}%
                    </span>
                    {row.reservation_count > 0 && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('reservationsDeferred', {
                            count: row.reservation_count,
                          })}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Disclaimer */}
          <div className="mt-3 flex items-start gap-1.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500/70" />
            <p className="text-[11px] leading-tight text-blue-700/70 dark:text-blue-300/70">
              {t('disclaimer')}
            </p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

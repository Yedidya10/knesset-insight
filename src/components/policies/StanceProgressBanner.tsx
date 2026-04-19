import { getTranslations, getLocale } from 'next-intl/server';
import { sql } from 'drizzle-orm';
import { BarChart3, Target, Search, Info, AlertTriangle } from 'lucide-react';
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
    SELECT
      v.knesset_num,
      COUNT(DISTINCT v.id)::int AS total_eligible,
      COUNT(DISTINCT vsa.vote_id)::int AS classified,
      (SELECT COUNT(*)::int FROM votes rv WHERE rv.knesset_num = v.knesset_num AND rv.is_reservation = true) AS reservation_count,
      COUNT(DISTINCT ps.id) FILTER (WHERE ps.stance_type = 'direct')::int AS direct_stances
    FROM votes v
    INNER JOIN bills b ON b.id = v.bill_id
    LEFT JOIN vote_stance_alignment vsa ON vsa.vote_id = v.id
    LEFT JOIN policy_stances ps ON ps.id = vsa.stance_id
    WHERE b.ai_summary IS NOT NULL AND v.is_reservation = false
    GROUP BY v.knesset_num
    ORDER BY v.knesset_num DESC
  `);

  if (progressRows.length === 0) return null;

  // Aggregate totals
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

  return (
    <TooltipProvider>
      <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {t('title')}
            </h3>
          </div>

          {/* Overall progress bar */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-blue-700 dark:text-blue-300">
                {t('classifiedVotes')}
              </span>
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                {coveragePercent}% (
                {totals.classified.toLocaleString(
                  locale === 'he' ? 'he-IL' : locale,
                )}{' '}
                /{' '}
                {totals.eligible.toLocaleString(
                  locale === 'he' ? 'he-IL' : locale,
                )}
                )
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
              <div
                className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-400"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
          </div>

          {/* Per-knesset breakdown */}
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
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-800 tabular-nums dark:text-blue-200">
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

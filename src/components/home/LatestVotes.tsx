import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Check, X, Vote } from 'lucide-react';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { votes } from '@/lib/db/schema';
import { cached } from '@/lib/cache';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AnimatedSection from '@/components/ui/animated-section';

export default async function LatestVotes() {
  const t = await getTranslations('home.latestVotes');

  let latestVotes: {
    id: number;
    title: string;
    voteDate: string | null;
    isAccepted: boolean | null;
    forCount: number | null;
    againstCount: number | null;
  }[] = [];

  try {
    latestVotes = await cached('home:latestVotes', 300, async () => {
      const rows = await db
        .select({
          id: votes.id,
          title: votes.title,
          voteDate: votes.voteDate,
          isAccepted: votes.isAccepted,
          forCount: votes.forCount,
          againstCount: votes.againstCount,
        })
        .from(votes)
        .orderBy(desc(votes.voteDate))
        .limit(3);
      // Serialize dates for Redis
      return rows.map((r) => ({
        ...r,
        voteDate: r.voteDate ? r.voteDate.toISOString() : null,
      }));
    });
  } catch (e) {
    console.error('Failed to fetch latest votes:', e);
  }

  if (latestVotes.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <AnimatedSection>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-chart-2/10 ring-chart-2/20 flex h-10 w-10 items-center justify-center rounded-xl ring-1">
              <Vote className="text-chart-2 h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {t('title')}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            render={<Link href="/votes" />}
          >
            {t('viewAll')}
            <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </AnimatedSection>

      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-3">
        {latestVotes.map((vote) => {
          const total = (vote.forCount ?? 0) + (vote.againstCount ?? 0);
          const forPct = total > 0 ? ((vote.forCount ?? 0) / total) * 100 : 50;

          return (
            <AnimatedSection key={vote.id}>
              <Link href={`/votes/${vote.id}`}>
                <Card className="group glass-card hover-lift h-full overflow-hidden">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <p className="line-clamp-2 text-sm leading-snug font-medium">
                      {vote.title}
                    </p>

                    {vote.voteDate && (
                      <p className="text-muted-foreground text-xs">
                        {new Date(vote.voteDate).toLocaleDateString('he-IL')}
                      </p>
                    )}

                    <div className="mt-auto flex items-center gap-2">
                      {vote.isAccepted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" />
                          {t('approved')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                          <X className="h-3 w-3" />
                          {t('rejected')}
                        </span>
                      )}
                    </div>

                    {/* Mini for/against bar */}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {vote.forCount ?? 0}
                      </span>
                      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-red-500/20">
                        <div
                          className="rounded-s-full bg-emerald-500 transition-all"
                          style={{ width: `${forPct}%` }}
                        />
                      </div>
                      <span className="text-red-600 dark:text-red-400">
                        {vote.againstCount ?? 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </AnimatedSection>
          );
        })}
      </div>
    </section>
  );
}

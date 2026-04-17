import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { electionCampaigns, electionCandidateLists } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AnimatedSection from '@/components/ui/animated-section';

export default async function ElectionSpotlight() {
  const t = await getTranslations('home.elections');

  let daysLeft = 0;
  let topLists: {
    id: number;
    name: string;
    shortName: string | null;
    slug: string | null;
    leaderName: string | null;
    color: string | null;
    estimatedSeats: number | null;
  }[] = [];

  try {
    const [campaign] = await db
      .select({
        electionDate: electionCampaigns.electionDate,
        knessetNum: electionCampaigns.knessetNum,
      })
      .from(electionCampaigns)
      .where(eq(electionCampaigns.knessetNum, 26))
      .limit(1);

    if (!campaign || !campaign.electionDate) return null;

    const electionDate = new Date(campaign.electionDate);
    const now = new Date();
    daysLeft = Math.ceil(
      (electionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    topLists = await db
      .select({
        id: electionCandidateLists.id,
        name: electionCandidateLists.name,
        shortName: electionCandidateLists.shortName,
        slug: electionCandidateLists.slug,
        leaderName: electionCandidateLists.leaderName,
        color: electionCandidateLists.color,
        estimatedSeats: electionCandidateLists.estimatedSeats,
      })
      .from(electionCandidateLists)
      .orderBy(desc(electionCandidateLists.estimatedSeats))
      .limit(4);
  } catch (e) {
    console.error('Failed to fetch election data:', e);
    return null;
  }

  if (topLists.length === 0) return null;

  return (
    <section className="bg-muted/30 border-border/10 border-y">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <AnimatedSection>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-chart-4/10 ring-chart-4/20 flex h-10 w-10 items-center justify-center rounded-xl ring-1">
                <CalendarDays className="text-chart-4 h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {t('title')}
                </h2>
                {daysLeft > 0 && (
                  <p className="text-muted-foreground text-sm">
                    {daysLeft} {t('daysLeft')}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              render={<Link href="/elections2026" />}
            >
              {t('viewAll')}
              <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </AnimatedSection>

        <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
          {topLists.map((list) => (
            <AnimatedSection key={list.id}>
              <Link href={`/elections2026/${list.slug}`}>
                <Card className="group glass-card hover-lift h-full overflow-hidden">
                  <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                    {list.color && (
                      <div
                        className="h-2 w-12 rounded-full"
                        style={{ backgroundColor: list.color }}
                      />
                    )}
                    <p className="text-sm font-semibold">
                      {list.shortName || list.name}
                    </p>
                    {list.leaderName && (
                      <p className="text-muted-foreground text-xs">
                        {list.leaderName}
                      </p>
                    )}
                    {list.estimatedSeats && (
                      <p className="text-lg font-bold">
                        {list.estimatedSeats}{' '}
                        <span className="text-muted-foreground text-xs font-normal">
                          {t('projectedSeats')}
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

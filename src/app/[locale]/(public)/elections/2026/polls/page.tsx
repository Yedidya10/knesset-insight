import { getTranslations } from 'next-intl/server';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  electionCampaigns,
  electionPolls,
  electionPollResults,
  electionCandidateLists,
} from '@/lib/db/schema';
import { appConfig } from '@/../app.config';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PollTrendChart from '@/components/elections/PollTrendChart';

export default async function PollsPage() {
  const t = await getTranslations('elections2026');

  const campaign = await db
    .select({ id: electionCampaigns.id })
    .from(electionCampaigns)
    .where(eq(electionCampaigns.knessetNum, appConfig.elections2026.knessetNum))
    .limit(1);

  if (!campaign[0]) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-muted-foreground">{t('polls.noPolls')}</p>
      </div>
    );
  }

  const polls = await db
    .select()
    .from(electionPolls)
    .where(eq(electionPolls.campaignId, campaign[0].id))
    .orderBy(desc(electionPolls.publishDate));

  const results = await db
    .select({
      pollId: electionPollResults.pollId,
      candidateListId: electionPollResults.candidateListId,
      predictedSeats: electionPollResults.predictedSeats,
      listName: electionCandidateLists.shortName,
      listColor: electionCandidateLists.color,
      listSlug: electionCandidateLists.slug,
    })
    .from(electionPollResults)
    .innerJoin(
      electionCandidateLists,
      eq(electionPollResults.candidateListId, electionCandidateLists.id),
    );

  // Build trend chart data
  const lists = await db
    .select({
      id: electionCandidateLists.id,
      shortName: electionCandidateLists.shortName,
      color: electionCandidateLists.color,
      slug: electionCandidateLists.slug,
    })
    .from(electionCandidateLists)
    .innerJoin(
      electionCampaigns,
      and(
        eq(electionCandidateLists.campaignId, electionCampaigns.id),
        eq(electionCampaigns.knessetNum, appConfig.elections2026.knessetNum),
      ),
    );

  const sortedPolls = [...polls].sort(
    (a, b) => new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime(),
  );

  const dates = sortedPolls.map((p) => p.publishDate);
  const series = lists.map((list) => ({
    name: list.shortName ?? '',
    color: list.color ?? '#888',
    slug: list.slug,
    data: sortedPolls.map((poll) => {
      const r = results.find((r) => r.pollId === poll.id && r.candidateListId === list.id);
      return r?.predictedSeats ?? null;
    }),
  }));

  const pollsWithResults = polls.map((poll) => ({
    ...poll,
    results: results
      .filter((r) => r.pollId === poll.id)
      .sort((a, b) => b.predictedSeats - a.predictedSeats),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/elections" className="hover:text-foreground">
          {t('backToElections')}
        </Link>
        <span className="mx-2">›</span>
        <Link href="/elections/2026" className="hover:text-foreground">
          2026
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">{t('polls.title')}</span>
      </nav>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">{t('polls.title')}</h1>
      <p className="mb-6 text-muted-foreground">{t('polls.description')}</p>

      {/* Trend chart */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t('polls.trends')}</h2>
        <PollTrendChart dates={dates} series={series} />
      </div>

      {/* Polls list */}
      {pollsWithResults.length > 0 ? (
        <div className="space-y-4">
          {pollsWithResults.map((poll) => (
            <Card key={poll.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{poll.pollsterName}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {new Date(poll.publishDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {poll.sampleSize && (
                    <span>
                      {t('polls.sampleSize')}: {poll.sampleSize}
                    </span>
                  )}
                  {poll.marginOfError && (
                    <span>
                      {t('polls.marginOfError')}: ±{poll.marginOfError}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {poll.results.map((r) => (
                    <div
                      key={r.listSlug}
                      className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: r.listColor ?? '#888' }}
                      />
                      <span className="text-sm">{r.listName}</span>
                      <span className="font-bold">{r.predictedSeats}</span>
                    </div>
                  ))}
                </div>
                {poll.sourceUrl && (
                  <a
                    href={poll.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-xs text-primary underline"
                  >
                    {t('polls.source')} ↗
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-muted-foreground">{t('polls.noPolls')}</p>
      )}
    </div>
  );
}

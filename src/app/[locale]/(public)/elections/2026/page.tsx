import { getTranslations } from 'next-intl/server';
import { eq, desc, and, sql } from 'drizzle-orm';
import { Vote } from 'lucide-react';
import { db } from '@/lib/db';
import {
  electionCampaigns,
  electionCandidateLists,
  electionPolls,
  electionPollResults,
  electionTimelineEvents,
} from '@/lib/db/schema';
import { appConfig } from '@/../app.config';
import { Link } from '@/i18n/navigation';
import ElectionCountdown from '@/components/elections/ElectionCountdown';
import SeatProjectionBar from '@/components/elections/SeatProjectionBar';
import CandidateListCard from '@/components/elections/CandidateListCard';
import ElectionTimeline from '@/components/elections/ElectionTimeline';

export default async function Elections2026Page() {
  const t = await getTranslations('elections2026');

  // Campaign
  const campaign = await db
    .select()
    .from(electionCampaigns)
    .where(eq(electionCampaigns.knessetNum, appConfig.elections2026.knessetNum))
    .limit(1);

  const electionDate = campaign[0]?.electionDate ?? appConfig.elections2026.estimatedDate;

  // Candidate lists
  const lists = await db
    .select({
      id: electionCandidateLists.id,
      name: electionCandidateLists.name,
      shortName: electionCandidateLists.shortName,
      slug: electionCandidateLists.slug,
      leaderName: electionCandidateLists.leaderName,
      status: electionCandidateLists.status,
      color: electionCandidateLists.color,
      estimatedSeats: electionCandidateLists.estimatedSeats,
      politicalPosition: electionCandidateLists.politicalPosition,
    })
    .from(electionCandidateLists)
    .innerJoin(
      electionCampaigns,
      and(
        eq(electionCandidateLists.campaignId, electionCampaigns.id),
        eq(electionCampaigns.knessetNum, appConfig.elections2026.knessetNum),
      ),
    )
    .orderBy(
      desc(electionCandidateLists.estimatedSeats),
      electionCandidateLists.sortOrder,
    );

  // Latest poll for seat projection
  const latestPoll = campaign[0]
    ? await db
        .select()
        .from(electionPolls)
        .where(eq(electionPolls.campaignId, campaign[0].id))
        .orderBy(desc(electionPolls.publishDate))
        .limit(1)
    : [];

  let seatSegments: { slug: string; name: string; seats: number; color: string }[] = [];
  if (latestPoll[0]) {
    const pollResults = await db
      .select({
        predictedSeats: electionPollResults.predictedSeats,
        listSlug: electionCandidateLists.slug,
        listName: electionCandidateLists.shortName,
        listColor: electionCandidateLists.color,
      })
      .from(electionPollResults)
      .innerJoin(
        electionCandidateLists,
        eq(electionPollResults.candidateListId, electionCandidateLists.id),
      )
      .where(eq(electionPollResults.pollId, latestPoll[0].id))
      .orderBy(desc(electionPollResults.predictedSeats));

    seatSegments = pollResults.map((r) => ({
      slug: r.listSlug,
      name: r.listName ?? '',
      seats: r.predictedSeats,
      color: r.listColor ?? '#888',
    }));
  }

  // Upcoming timeline events (next 3)
  const upcomingEvents = campaign[0]
    ? await db
        .select()
        .from(electionTimelineEvents)
        .where(
          and(
            eq(electionTimelineEvents.campaignId, campaign[0].id),
            eq(electionTimelineEvents.isCompleted, false),
          ),
        )
        .orderBy(electionTimelineEvents.eventDate)
        .limit(3)
    : [];

  const statusLabels = {
    potential: t('status.potential'),
    confirmed: t('status.confirmed'),
    withdrawn: t('status.withdrawn'),
    disqualified: t('status.disqualified'),
    removed: t('status.removed'),
  };

  const positionLabels = {
    left: t('position.left'),
    center_left: t('position.center_left'),
    center: t('position.center'),
    center_right: t('position.center_right'),
    right: t('position.right'),
    arab: t('position.arab'),
    haredi: t('position.haredi'),
  };

  const eventTypeLabels = {
    deadline: t('eventType.deadline'),
    event: t('eventType.event'),
    debate: t('eventType.debate'),
    announcement: t('eventType.announcement'),
    milestone: t('eventType.milestone'),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Vote className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/elections" className="hover:text-foreground">
          {t('backToElections')}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">2026</span>
      </nav>

      {/* Countdown */}
      <div className="mb-8">
        <ElectionCountdown electionDate={electionDate} />
      </div>

      {/* Seat projection */}
      {seatSegments.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t('seatProjection')}</h2>
          <SeatProjectionBar
            segments={seatSegments}
            totalSeats={appConfig.elections2026.totalSeats}
            coalitionLabel={t('coalition')}
            majorityLabel={t('majority')}
          />
        </div>
      )}

      {/* Candidate lists grid */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('parties.title')}</h2>
          <Link
            href="/elections/2026/parties"
            className="text-sm text-primary hover:underline"
          >
            {t('parties.viewAll')} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.slice(0, 6).map((list) => (
            <CandidateListCard
              key={list.slug}
              slug={list.slug}
              name={list.name}
              shortName={list.shortName}
              leaderName={list.leaderName}
              status={list.status}
              color={list.color}
              estimatedSeats={list.estimatedSeats}
              politicalPosition={list.politicalPosition}
              statusLabels={statusLabels}
              positionLabels={positionLabels}
              seatsLabel={t('seats')}
              leaderLabel={t('parties.leader')}
            />
          ))}
        </div>
      </div>

      {/* Navigation links */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/elections/2026/polls"
          className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <h3 className="font-semibold">{t('polls.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('polls.description')}</p>
        </Link>
        <Link
          href="/elections/2026/timeline"
          className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <h3 className="font-semibold">{t('timeline.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('timeline.description')}</p>
        </Link>
      </div>

      {/* Mini timeline */}
      {upcomingEvents.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t('timeline.upcoming')}</h2>
          <ElectionTimeline events={upcomingEvents} typeLabels={eventTypeLabels} estimatedDateNote={t('estimatedDateNote')} />
        </div>
      )}
    </div>
  );
}

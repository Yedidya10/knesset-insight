import { getTranslations } from 'next-intl/server';
import { eq, and } from 'drizzle-orm';
import { Vote } from 'lucide-react';
import { db } from '@/lib/db';
import {
  electionCampaigns,
  electionCandidateLists,
  electionTimelineEvents,
} from '@/lib/db/schema';
import { appConfig } from '@/../app.config';
import { Link } from '@/i18n/navigation';
import AppBreadcrumb from '@/components/layout/AppBreadcrumb';
import ElectionCountdown from '@/components/elections/ElectionCountdown';
import CandidateListCard from '@/components/elections/CandidateListCard';
import ElectionTimeline from '@/components/elections/ElectionTimeline';

export default async function Elections2026Page() {
  const t = await getTranslations('elections2026');
  const tNav = await getTranslations('nav');
  const tMap = await getTranslations('electionMap');

  // Campaign
  const campaign = await db
    .select()
    .from(electionCampaigns)
    .where(eq(electionCampaigns.knessetNum, appConfig.elections2026.knessetNum))
    .limit(1);

  const electionDate =
    campaign[0]?.electionDate ?? appConfig.elections2026.estimatedDate;

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
    .orderBy(electionCandidateLists.sortOrder);

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
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Vote className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>
      </div>

      <AppBreadcrumb
        items={[
          { label: tNav('home'), href: '/' },
          { label: tNav('elections'), href: '/elections' },
          { label: '2026' },
        ]}
      />

      {/* Countdown */}
      <div className="mb-8">
        <ElectionCountdown electionDate={electionDate} />
      </div>

      {/* Candidate lists grid */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('parties.title')}</h2>
          <Link
            href="/elections/2026/parties"
            className="text-primary text-sm hover:underline"
          >
            {t('parties.viewAll')} →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.slice(0, 6).map((list) => (
            <CandidateListCard
              key={list.slug}
              slug={list.slug}
              name={list.name}
              shortName={list.shortName}
              leaderName={list.leaderName}
              status={list.status}
              color={list.color}
              estimatedSeats={null}
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
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/elections/2026/polls"
          className="bg-card hover:bg-muted/50 rounded-xl border p-4 transition-colors"
        >
          <h3 className="font-semibold">{t('polls.title')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('polls.description')}
          </p>
        </Link>
        <Link
          href="/elections/2026/timeline"
          className="bg-card hover:bg-muted/50 rounded-xl border p-4 transition-colors"
        >
          <h3 className="font-semibold">{t('timeline.title')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('timeline.description')}
          </p>
        </Link>
        <Link
          href="/elections/map"
          className="bg-card hover:bg-muted/50 rounded-xl border p-4 transition-colors"
        >
          <h3 className="font-semibold">{tMap('title')}</h3>
          <p className="text-muted-foreground text-sm">{tMap('description')}</p>
        </Link>
      </div>

      {/* Mini timeline */}
      {upcomingEvents.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            {t('timeline.upcoming')}
          </h2>
          <ElectionTimeline
            events={upcomingEvents}
            typeLabels={eventTypeLabels}
            estimatedDateNote={t('estimatedDateNote')}
          />
        </div>
      )}
    </div>
  );
}

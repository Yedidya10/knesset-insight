import { getTranslations } from 'next-intl/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { electionCampaigns, electionTimelineEvents } from '@/lib/db/schema';
import { appConfig } from '@/../app.config';
import { Link } from '@/i18n/navigation';
import ElectionTimeline from '@/components/elections/ElectionTimeline';

export default async function TimelinePage() {
  const t = await getTranslations('elections2026');

  const campaign = await db
    .select({ id: electionCampaigns.id })
    .from(electionCampaigns)
    .where(eq(electionCampaigns.knessetNum, appConfig.elections2026.knessetNum))
    .limit(1);

  const events = campaign[0]
    ? await db
        .select()
        .from(electionTimelineEvents)
        .where(eq(electionTimelineEvents.campaignId, campaign[0].id))
        .orderBy(electionTimelineEvents.eventDate)
    : [];

  const eventTypeLabels = {
    deadline: t('eventType.deadline'),
    event: t('eventType.event'),
    debate: t('eventType.debate'),
    announcement: t('eventType.announcement'),
    milestone: t('eventType.milestone'),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
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
        <span className="text-foreground">{t('timeline.title')}</span>
      </nav>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">{t('timeline.title')}</h1>
      <p className="mb-8 text-muted-foreground">{t('timeline.description')}</p>

      {events.length > 0 ? (
        <ElectionTimeline events={events} typeLabels={eventTypeLabels} />
      ) : (
        <p className="py-12 text-center text-muted-foreground">{t('timeline.noEvents')}</p>
      )}
    </div>
  );
}

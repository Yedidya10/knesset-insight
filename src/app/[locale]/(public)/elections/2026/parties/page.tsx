import { getTranslations } from 'next-intl/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { electionCampaigns, electionCandidateLists } from '@/lib/db/schema';
import { appConfig } from '@/../app.config';
import { Link } from '@/i18n/navigation';
import AppBreadcrumb from '@/components/layout/AppBreadcrumb';
import CandidateListCard from '@/components/elections/CandidateListCard';

interface Props {
  searchParams: Promise<{ status?: string; position?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PartiesPage({ searchParams }: Props) {
  const t = await getTranslations('elections2026');
  const tNav = await getTranslations('nav');
  const params = await searchParams;

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

  // Client-side filter (simple: apply server-side)
  const filtered = lists.filter((l) => {
    if (params.status && params.status !== 'all' && l.status !== params.status)
      return false;
    if (
      params.position &&
      params.position !== 'all' &&
      l.politicalPosition !== params.position
    )
      return false;
    return true;
  });

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

  const statusFilters = ['all', 'potential', 'confirmed', 'withdrawn'];
  const positionFilters = [
    'all',
    'left',
    'center_left',
    'center',
    'center_right',
    'right',
    'arab',
    'haredi',
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <AppBreadcrumb
        items={[
          { label: tNav('home'), href: '/' },
          { label: tNav('elections'), href: '/elections' },
          { label: '2026', href: '/elections/2026' },
          { label: t('parties.title') },
        ]}
      />

      <h1 className="mb-2 text-2xl font-bold tracking-tight">
        {t('parties.title')}
      </h1>
      <p className="text-muted-foreground mb-6">{t('parties.description')}</p>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="bg-muted/60 flex flex-wrap gap-1.5 rounded-xl p-1.5">
          {statusFilters.map((s) => (
            <Link
              key={s}
              href={`/elections/2026/parties?status=${s}${params.position ? `&position=${params.position}` : ''}`}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                (params.status ?? 'all') === s
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all'
                ? t('parties.viewAll')
                : statusLabels[s as keyof typeof statusLabels]}
            </Link>
          ))}
        </div>
        <div className="bg-muted/60 flex flex-wrap gap-1.5 rounded-xl p-1.5">
          {positionFilters.map((p) => (
            <Link
              key={p}
              href={`/elections/2026/parties?position=${p}${params.status ? `&status=${params.status}` : ''}`}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                (params.position ?? 'all') === p
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'all'
                ? t('parties.viewAll')
                : positionLabels[p as keyof typeof positionLabels]}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((list) => (
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

      {filtered.length === 0 && (
        <p className="text-muted-foreground py-12 text-center">{t('noData')}</p>
      )}
    </div>
  );
}

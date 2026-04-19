import { getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { electionCandidateLists, electionCandidates } from '@/lib/db/schema';
import { Link } from '@/i18n/navigation';
import AppBreadcrumb from '@/components/layout/AppBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ElectionStatusBadge from '@/components/elections/ElectionStatusBadge';
import CandidateCard from '@/components/elections/CandidateCard';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PartyDetailPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations('elections2026');
  const tNav = await getTranslations('nav');

  const list = await db
    .select()
    .from(electionCandidateLists)
    .where(eq(electionCandidateLists.slug, slug))
    .limit(1);

  if (!list[0]) notFound();

  const party = list[0];

  const candidates = await db
    .select({
      id: electionCandidates.id,
      slug: electionCandidates.slug,
      firstName: electionCandidates.firstName,
      lastName: electionCandidates.lastName,
      position: electionCandidates.position,
      status: electionCandidates.status,
      isLeader: electionCandidates.isLeader,
      imageUrl: electionCandidates.imageUrl,
      profession: electionCandidates.profession,
      memberId: electionCandidates.memberId,
    })
    .from(electionCandidates)
    .where(eq(electionCandidates.candidateListId, party.id))
    .orderBy(electionCandidates.position, electionCandidates.lastName);

  const statusLabels = {
    potential: t('status.potential'),
    confirmed: t('status.confirmed'),
    withdrawn: t('status.withdrawn'),
    disqualified: t('status.disqualified'),
    removed: t('status.removed'),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <AppBreadcrumb
        items={[
          { label: tNav('home'), href: '/' },
          { label: tNav('elections'), href: '/elections' },
          { label: '2026', href: '/elections/2026' },
          { label: t('parties.title'), href: '/elections/2026/parties' },
          { label: party.name },
        ]}
      />

      {/* Party header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div
            className="h-16 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: party.color ?? 'hsl(var(--primary))' }}
          />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {party.name}
              </h1>
              <ElectionStatusBadge
                status={party.status}
                labels={statusLabels}
              />
            </div>
            {party.leaderName && (
              <p className="text-muted-foreground mt-1">
                {t('parties.leader')}: {party.leaderName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Platform */}
      {party.platformSummary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t('parties.platform')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {party.platformSummary}
            </p>
            {party.platformUrl && (
              <a
                href={party.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-block text-sm underline"
              >
                {t('parties.viewPlatform')} ↗
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Candidates */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">
          {t('parties.candidates')}
        </h2>
        {candidates.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {candidates.map((c) => (
              <CandidateCard
                key={c.slug}
                slug={c.slug}
                partySlug={slug}
                firstName={c.firstName}
                lastName={c.lastName}
                position={c.position}
                status={c.status}
                isLeader={c.isLeader ?? false}
                imageUrl={c.imageUrl}
                profession={c.profession}
                memberId={c.memberId}
                statusLabels={statusLabels}
                positionLabel={t('candidate.position')}
                currentMkLabel={t('candidate.currentMk')}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t('parties.noCandidates')}
          </p>
        )}
      </div>
    </div>
  );
}

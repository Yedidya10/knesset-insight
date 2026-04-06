import { getTranslations } from 'next-intl/server';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import {
  electionCandidateLists,
  electionCandidates,
  electionPollResults,
  electionPolls,
} from '@/lib/db/schema';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ElectionStatusBadge from '@/components/elections/ElectionStatusBadge';
import CandidateCard from '@/components/elections/CandidateCard';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PartyDetailPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations('elections2026');

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

  // Poll history
  const pollHistory = await db
    .select({
      predictedSeats: electionPollResults.predictedSeats,
      pollsterName: electionPolls.pollsterName,
      publishDate: electionPolls.publishDate,
    })
    .from(electionPollResults)
    .innerJoin(electionPolls, eq(electionPollResults.pollId, electionPolls.id))
    .where(eq(electionPollResults.candidateListId, party.id))
    .orderBy(desc(electionPolls.publishDate));

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
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/elections" className="hover:text-foreground">
          {t('backToElections')}
        </Link>
        <span className="mx-2">›</span>
        <Link href="/elections/2026" className="hover:text-foreground">
          2026
        </Link>
        <span className="mx-2">›</span>
        <Link href="/elections/2026/parties" className="hover:text-foreground">
          {t('parties.title')}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">{party.name}</span>
      </nav>

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
              <ElectionStatusBadge status={party.status} labels={statusLabels} />
            </div>
            {party.leaderName && (
              <p className="mt-1 text-muted-foreground">
                {t('parties.leader')}: {party.leaderName}
              </p>
            )}
            {party.estimatedSeats != null && party.estimatedSeats > 0 && (
              <p className="mt-1 text-sm font-medium">
                {party.estimatedSeats} {t('seats')} ({t('parties.estimatedSeats')})
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
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {party.platformSummary}
            </p>
            {party.platformUrl && (
              <a
                href={party.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-primary underline"
              >
                {t('parties.viewPlatform')} ↗
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Candidates */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">{t('parties.candidates')}</h2>
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
          <p className="text-sm text-muted-foreground">{t('parties.noCandidates')}</p>
        )}
      </div>

      {/* Poll history */}
      {pollHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('polls.trends')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pollHistory.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {p.pollsterName} — {new Date(p.publishDate).toLocaleDateString()}
                  </span>
                  <span className="font-bold">{p.predictedSeats} {t('seats')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

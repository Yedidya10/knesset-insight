import { getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import {
  electionCandidates,
  electionCandidateLists,
  members,
  memberVotes,
  billInitiators,
} from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import CandidateProfile from '@/components/elections/CandidateProfile';
import CandidateMkActivity from '@/components/elections/CandidateMkActivity';
import CandidateCivicRecord from '@/components/elections/CandidateCivicRecord';

interface Props {
  params: Promise<{ slug: string; candidateSlug: string }>;
}

export default async function CandidateProfilePage({ params }: Props) {
  const { slug: partySlug, candidateSlug } = await params;
  const t = await getTranslations('elections2026');

  const candidate = await db
    .select()
    .from(electionCandidates)
    .where(eq(electionCandidates.slug, candidateSlug))
    .limit(1);

  if (!candidate[0]) notFound();

  const c = candidate[0];

  // Get parent list
  const list = await db
    .select({
      slug: electionCandidateLists.slug,
      name: electionCandidateLists.name,
      shortName: electionCandidateLists.shortName,
      color: electionCandidateLists.color,
    })
    .from(electionCandidateLists)
    .where(eq(electionCandidateLists.id, c.candidateListId))
    .limit(1);

  // MK activity
  let mkActivity = null;
  if (c.memberId) {
    const member = await db
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        isCurrent: members.isCurrent,
      })
      .from(members)
      .where(eq(members.id, c.memberId))
      .limit(1);

    if (member[0]) {
      const voteStats = await db
        .select({
          total: sql<number>`count(*)::int`,
          forVotes: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'for')::int`,
          againstVotes: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'against')::int`,
          abstainVotes: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'abstain')::int`,
          absentVotes: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'absent')::int`,
        })
        .from(memberVotes)
        .where(eq(memberVotes.memberId, c.memberId));

      const billCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(billInitiators)
        .where(eq(billInitiators.memberId, c.memberId));

      const stats = voteStats[0];
      const participated =
        (stats?.forVotes ?? 0) + (stats?.againstVotes ?? 0) + (stats?.abstainVotes ?? 0);
      const total = stats?.total ?? 0;

      mkActivity = {
        member: member[0],
        voteStats: stats ?? null,
        billCount: billCount[0]?.count ?? 0,
        participationRate: total > 0 ? Math.round((participated / total) * 100) : 0,
      };
    }
  }

  const profileLabels = {
    position: t('candidate.position'),
    leader: t('candidate.leader'),
    bio: t('candidate.bio'),
    birthYear: t('candidate.birthYear'),
    residence: t('candidate.residence'),
    profession: t('candidate.profession'),
    education: t('candidate.education'),
    personalInfo: t('candidate.personalInfo'),
  };

  const mkLabels = {
    title: t('candidate.mkActivity'),
    votes: t('candidate.votes'),
    forVotes: t('candidate.forVotes'),
    againstVotes: t('candidate.againstVotes'),
    abstainVotes: t('candidate.abstainVotes'),
    absent: t('candidate.absent'),
    bills: t('candidate.bills'),
    billsInitiated: t('candidate.billsInitiated'),
    participation: t('candidate.participation'),
    participationRate: t('candidate.participationRate'),
    viewFullProfile: t('candidate.viewFullProfile'),
  };

  const civicLabels = {
    civicActivity: t('candidate.civicActivity'),
    publicStatements: t('candidate.publicStatements'),
    integrity: t('candidate.integrity'),
    integrityNotes: t('candidate.integrityNotes'),
    financialDisclosure: t('candidate.financialDisclosure'),
    conflictsOfInterest: t('candidate.conflictsOfInterest'),
    platform: t('parties.platform'),
    viewPlatform: t('parties.viewPlatform'),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/elections/2026" className="hover:text-foreground">
          2026
        </Link>
        <span className="mx-2">›</span>
        <Link href={`/elections/2026/parties/${partySlug}`} className="hover:text-foreground">
          {list[0]?.name ?? partySlug}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">
          {c.firstName} {c.lastName}
        </span>
      </nav>

      <CandidateProfile
        firstName={c.firstName}
        lastName={c.lastName}
        imageUrl={c.imageUrl}
        position={c.position}
        isLeader={c.isLeader ?? false}
        bio={c.bio}
        birthYear={c.birthYear}
        residence={c.residence}
        profession={c.profession}
        education={c.education}
        listName={list[0]?.name ?? ''}
        listColor={list[0]?.color ?? null}
        labels={profileLabels}
      />

      {/* MK activity */}
      {mkActivity && (
        <div className="mt-6">
          <CandidateMkActivity activity={mkActivity} labels={mkLabels} />
          <div className="mt-2">
            <Link
              href={`/members/${mkActivity.member.id}`}
              className="text-sm text-primary underline underline-offset-4"
            >
              {t('candidate.viewFullProfile')} →
            </Link>
          </div>
        </div>
      )}

      {/* Civic record */}
      <div className="mt-6">
        <CandidateCivicRecord
          civicActivity={c.civicActivity}
          publicStatements={c.publicStatements}
          integrityNotes={c.integrityNotes}
          financialDisclosure={c.financialDisclosure}
          conflictsOfInterest={c.conflictsOfInterest}
          platformUrl={c.platformUrl}
          labels={civicLabels}
        />
      </div>
    </div>
  );
}

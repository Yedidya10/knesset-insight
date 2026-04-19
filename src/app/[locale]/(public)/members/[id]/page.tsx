import { getTranslations, getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import AppBreadcrumb from '@/components/layout/AppBreadcrumb';
import type { Metadata } from 'next';
import {
  ThumbsUp,
  ThumbsDown,
  Minus,
  User,
  UserCheck,
  Vote,
  FileText,
  Building2,
} from 'lucide-react';
import { eq, desc, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  members,
  factions,
  memberVotes,
  votes,
  billInitiators,
  bills,
  committees,
  memberFactionHistory,
  integrityCases,
  memberCorporateAffiliations,
  memberLobbyistConnections,
  governmentPositions,
  governments,
  govMinistries,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TranslatedText from '@/components/ui/translated-text';
import MemberBillsList from '@/components/members/MemberBillsList';
import MemberProfileHero from '@/components/members/MemberProfileHero';
import MemberProfileDetails from '@/components/members/MemberProfileDetails';
import MemberProfileTabs from '@/components/members/MemberProfileTabs';
import IntegrityTab from '@/components/integrity/IntegrityTab';
import MemberPolicyStances from '@/components/policies/MemberPolicyStances';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const memberId = Number(id);
  if (isNaN(memberId)) return {};

  const [member] = await db
    .select({
      firstName: members.firstName,
      lastName: members.lastName,
      factionName: factions.name,
    })
    .from(members)
    .leftJoin(factions, eq(members.factionId, factions.id))
    .where(eq(members.id, memberId))
    .limit(1);

  if (!member) return {};

  const t = await getTranslations('seo.members.detail');
  const name = `${member.firstName} ${member.lastName}`;
  const faction = member.factionName ?? '';

  return {
    title: t('title', { name }),
    description: t('description', { name, faction }),
    openGraph: {
      title: t('title', { name }),
      description: t('description', { name, faction }),
    },
  };
}

export default async function MemberProfilePage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('members.profile');
  const tCommon = await getTranslations('common');
  const tVotes = await getTranslations('votes');
  const tNav = await getTranslations('nav');
  const locale = await getLocale();

  const memberId = Number(id);
  if (isNaN(memberId)) notFound();

  const [member] = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      email: members.email,
      phone: members.phone,
      gender: members.gender,
      birthDate: members.birthDate,
      startDate: members.startDate,
      endDate: members.endDate,
      knessetNum: members.knessetNum,
      isCurrent: members.isCurrent,
      isCoalition: factions.isCoalition,
      factionName: factions.name,
      factionId: factions.id,
    })
    .from(members)
    .leftJoin(factions, eq(members.factionId, factions.id))
    .where(eq(members.id, memberId))
    .limit(1);

  if (!member) notFound();

  // Parallel data fetching
  const [
    recentVotesData,
    initiatedBills,
    chairedCommittees,
    factionHistory,
    integrityData,
    corporateAff,
    lobbyistConn,
    governmentRoles,
  ] = await Promise.all([
    // Recent votes by this member
    db
      .select({
        voteId: votes.id,
        voteTitle: votes.title,
        voteDate: votes.voteDate,
        voteValue: memberVotes.voteValue,
        isAccepted: votes.isAccepted,
        billId: votes.billId,
      })
      .from(memberVotes)
      .innerJoin(votes, eq(memberVotes.voteId, votes.id))
      .where(eq(memberVotes.memberId, member.id))
      .orderBy(desc(votes.voteDate))
      .limit(30),

    // Bills initiated
    db
      .select({
        billId: bills.id,
        billName: bills.name,
        billStatus: bills.status,
        billKnessetNum: bills.knessetNum,
        proposedDate: bills.proposedDate,
        isPrimary: billInitiators.isPrimary,
      })
      .from(billInitiators)
      .innerJoin(bills, eq(billInitiators.billId, bills.id))
      .where(eq(billInitiators.memberId, member.id))
      .orderBy(desc(bills.proposedDate)),

    // Committees chaired
    db
      .select({
        id: committees.id,
        name: committees.name,
        committeeType: committees.committeeType,
        isActive: committees.isActive,
      })
      .from(committees)
      .where(eq(committees.chairmanId, member.id)),

    // Faction history across Knessets
    db
      .select({
        knessetNum: memberFactionHistory.knessetNum,
        factionName: factions.name,
        politicalGroupId: factions.politicalGroupId,
        startDate: memberFactionHistory.startDate,
        endDate: memberFactionHistory.endDate,
      })
      .from(memberFactionHistory)
      .innerJoin(factions, eq(memberFactionHistory.factionId, factions.id))
      .where(eq(memberFactionHistory.memberId, member.id))
      .orderBy(
        desc(memberFactionHistory.knessetNum),
        asc(memberFactionHistory.startDate),
      ),

    // Integrity cases
    db
      .select()
      .from(integrityCases)
      .where(eq(integrityCases.memberId, member.id))
      .orderBy(desc(integrityCases.eventDate)),

    // Corporate affiliations
    db
      .select()
      .from(memberCorporateAffiliations)
      .where(eq(memberCorporateAffiliations.memberId, member.id))
      .orderBy(desc(memberCorporateAffiliations.startDate)),

    // Lobbyist connections
    db
      .select()
      .from(memberLobbyistConnections)
      .where(eq(memberLobbyistConnections.memberId, member.id))
      .orderBy(desc(memberLobbyistConnections.eventDate))
      .limit(20),

    // Government positions
    db
      .select({
        governmentNum: governments.governmentNum,
        positionDesc: governmentPositions.positionDesc,
        ministryName: govMinistries.name,
        startDate: governmentPositions.startDate,
        endDate: governmentPositions.endDate,
        isCurrent: governmentPositions.isCurrent,
      })
      .from(governmentPositions)
      .innerJoin(
        governments,
        eq(governmentPositions.governmentId, governments.id),
      )
      .leftJoin(
        govMinistries,
        eq(governmentPositions.govMinistryId, govMinistries.id),
      )
      .where(eq(governmentPositions.memberId, member.id))
      .orderBy(
        desc(governments.governmentNum),
        asc(governmentPositions.startDate),
      ),
  ]);

  // Compute vote breakdown stats
  const voteStatsRows = await db
    .select({
      voteValue: memberVotes.voteValue,
      count: sql<number>`count(*)::int`,
    })
    .from(memberVotes)
    .where(eq(memberVotes.memberId, member.id))
    .groupBy(memberVotes.voteValue);

  const voteStats = {
    for: 0,
    against: 0,
    abstain: 0,
    absent: 0,
    present: 0,
    voted: 0,
  };
  for (const row of voteStatsRows) {
    const key = row.voteValue as keyof typeof voteStats;
    if (key in voteStats) voteStats[key] = row.count;
  }
  const totalVoteRecords = Object.values(voteStats).reduce((a, b) => a + b, 0);

  // Compute integrity case summary (group by category+severity)
  const caseSummaryMap = new Map<
    string,
    { category: string; severity: string; count: number }
  >();
  for (const c of integrityData) {
    const key = `${c.category}-${c.severity}`;
    const existing = caseSummaryMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      caseSummaryMap.set(key, {
        category: c.category,
        severity: c.severity,
        count: 1,
      });
    }
  }
  const caseSummary = Array.from(caseSummaryMap.values());

  // Compute age (server component — Date.now() is safe here)
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const age = member.birthDate
    ? Math.floor(
        (now - new Date(member.birthDate).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <AppBreadcrumb
        items={[
          { label: tNav('home'), href: '/' },
          { label: tNav('members'), href: '/members' },
          { label: `${member.firstName} ${member.lastName}` },
        ]}
      />

      {/* Hero banner */}
      <MemberProfileHero member={member} />

      {/* Expandable personal details */}
      <MemberProfileDetails
        member={member}
        age={age}
        factionHistory={factionHistory}
        governmentRoles={governmentRoles}
        locale={locale}
      />

      {/* Tabbed content sections */}
      <MemberProfileTabs
        policyContent={<MemberPolicyStances memberId={member.id} />}
        votesContent={
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">{t('recentVotes')}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Vote breakdown summary */}
              {totalVoteRecords > 0 && (
                <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                  <div className="rounded-lg bg-green-50 p-2 text-center dark:bg-green-950/30">
                    <p className="text-lg font-bold text-green-600 tabular-nums">
                      {voteStats.for}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('votedFor')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-2 text-center dark:bg-red-950/30">
                    <p className="text-lg font-bold text-red-600 tabular-nums">
                      {voteStats.against}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('votedAgainst')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 p-2 text-center dark:bg-yellow-950/30">
                    <p className="text-lg font-bold text-yellow-600 tabular-nums">
                      {voteStats.abstain}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('votedAbstain')}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <p className="text-muted-foreground text-lg font-bold tabular-nums">
                      {voteStats.absent}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('wasAbsent')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2 text-center dark:bg-blue-950/30">
                    <p className="text-lg font-bold text-blue-600 tabular-nums">
                      {voteStats.present}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('wasPresent')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-2 text-center dark:bg-purple-950/30">
                    <p className="text-lg font-bold text-purple-600 tabular-nums">
                      {voteStats.voted}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('secretBallot')}
                    </p>
                  </div>
                </div>
              )}
              {recentVotesData.length > 0 ? (
                <div className="space-y-2">
                  {recentVotesData.map((v) => (
                    <Link
                      key={v.voteId}
                      href={
                        v.billId
                          ? `/legislation/${v.billId}`
                          : `/votes/${v.voteId}`
                      }
                      className="block"
                    >
                      <div className="hover:bg-muted/50 flex items-center gap-3 rounded-lg p-2 transition-colors">
                        {v.voteValue === 'for' && (
                          <ThumbsUp className="h-4 w-4 shrink-0 text-green-600" />
                        )}
                        {v.voteValue === 'against' && (
                          <ThumbsDown className="h-4 w-4 shrink-0 text-red-600" />
                        )}
                        {v.voteValue === 'abstain' && (
                          <Minus className="h-4 w-4 shrink-0 text-yellow-600" />
                        )}
                        {v.voteValue === 'absent' && (
                          <User className="text-muted-foreground h-4 w-4 shrink-0" />
                        )}
                        {v.voteValue === 'present' && (
                          <UserCheck className="h-4 w-4 shrink-0 text-blue-600" />
                        )}
                        {v.voteValue === 'voted' && (
                          <Vote className="h-4 w-4 shrink-0 text-purple-600" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            <TranslatedText text={v.voteTitle} />
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {v.voteDate
                              ? new Date(v.voteDate).toLocaleDateString(locale)
                              : ''}
                          </p>
                        </div>
                        {v.isAccepted !== null && (
                          <Badge
                            variant={v.isAccepted ? 'default' : 'secondary'}
                            className="shrink-0 text-xs"
                          >
                            {v.isAccepted
                              ? tVotes('approved')
                              : tVotes('rejected')}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t('noVotes')}</p>
              )}
            </CardContent>
          </Card>
        }
        legislationContent={
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                {t('billsInitiated')} ({initiatedBills.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MemberBillsList bills={initiatedBills} />
            </CardContent>
          </Card>
        }
        committeesContent={
          chairedCommittees.length > 0 ? (
            <Card className="glass-card overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" />
                  {t('committeesChaired')} ({chairedCommittees.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {chairedCommittees.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-lg p-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        <TranslatedText text={c.name} />
                      </span>
                      <div className="flex shrink-0 gap-2">
                        {c.committeeType && (
                          <Badge variant="outline" className="text-xs">
                            {c.committeeType}
                          </Badge>
                        )}
                        {c.isActive !== null && (
                          <Badge
                            variant={c.isActive ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {c.isActive ? tCommon('yes') : tCommon('no')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null
        }
        integrityContent={
          <IntegrityTab
            cases={integrityData.map((c) => ({
              ...c,
              eventDate: c.eventDate,
              resolutionDate: c.resolutionDate,
              sourceUrl: c.sourceUrl,
              aiSummary: c.aiSummary,
              sanctionType: c.sanctionType,
              titleEn: c.titleEn,
              description: c.description,
              verified: c.verified,
            }))}
            caseSummary={caseSummary}
            totalCases={integrityData.length}
            corporateAffiliations={corporateAff.map((a) => ({
              ...a,
              startDate: a.startDate,
              endDate: a.endDate,
              sourceUrl: a.sourceUrl,
              potentialConflict: a.potentialConflict,
              conflictDescription: a.conflictDescription,
            }))}
            corporateCount={corporateAff.length}
            lobbyistConnections={lobbyistConn.map((l) => ({
              ...l,
              eventDate: l.eventDate,
              sourceUrl: l.sourceUrl,
            }))}
            lobbyistTotal={lobbyistConn.length}
          />
        }
      />
    </div>
  );
}

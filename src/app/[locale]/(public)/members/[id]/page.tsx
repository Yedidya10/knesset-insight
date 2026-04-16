import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import {
  User,
  Building2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Mail,
  Phone,
  Calendar,
  FileText,
  Gavel,
} from 'lucide-react';
import { eq, desc, sql, asc } from 'drizzle-orm';
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
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import TranslatedText from '@/components/ui/translated-text';
import MemberAvatar from '@/components/members/MemberAvatar';
import MemberBillsList from '@/components/members/MemberBillsList';
import VoteDistributionBar from '@/components/members/VoteDistributionBar';
import IntegrityTab from '@/components/integrity/IntegrityTab';

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
    voteStats,
    initiatedBills,
    chairedCommittees,
    factionHistory,
    integrityData,
    corporateAff,
    lobbyistConn,
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

    // Vote stats
    db
      .select({
        value: memberVotes.voteValue,
        count: sql<number>`count(*)::int`,
      })
      .from(memberVotes)
      .where(eq(memberVotes.memberId, member.id))
      .groupBy(memberVotes.voteValue),

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
  ]);

  const stats = { for: 0, against: 0, abstain: 0, absent: 0 };
  for (const s of voteStats) {
    if (s.value in stats) stats[s.value as keyof typeof stats] = s.count;
  }
  const totalVotes = stats.for + stats.against + stats.abstain + stats.absent;
  const participationCount = stats.for + stats.against + stats.abstain;
  const participationRate =
    totalVotes > 0 ? Math.round((participationCount / totalVotes) * 100) : 0;

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

  const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`;

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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 rounded-lg"
        render={<Link href="/members" />}
      >
        {tCommon('back')}
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card — hero style */}
        <Card className="glass-card overflow-hidden lg:col-span-1">
          {/* Gradient header bg */}
          <div className="from-primary/20 via-chart-2/10 to-chart-4/10 h-20 bg-gradient-to-br" />
          <CardContent className="-mt-12 flex flex-col items-center gap-4 px-6 pb-6">
            <div className="relative">
              <div className="from-primary/30 to-chart-2/20 absolute -inset-1 rounded-full bg-gradient-to-br blur-sm" />
              <MemberAvatar
                member={member}
                size="xl"
                className="relative"
                ring="ring-4 ring-card"
              />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold">
                {member.firstName} {member.lastName}
              </h1>
              {member.factionName && (
                <Link
                  href={`/factions/${member.factionId}`}
                  className="text-primary text-sm hover:underline"
                >
                  {member.factionName}
                </Link>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {member.isCoalition !== null && (
                <Badge variant={member.isCoalition ? 'default' : 'secondary'}>
                  {member.isCoalition
                    ? t('coalitionMember')
                    : t('oppositionMember')}
                </Badge>
              )}
              {member.isCurrent === false && (
                <Badge variant="outline">{t('endDate')}</Badge>
              )}
            </div>

            <Separator className="opacity-30" />

            {/* Overview info */}
            <div className="w-full space-y-3 text-sm">
              {member.factionName && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span>
                    {t('party')}: {member.factionName}
                  </span>
                </div>
              )}
              {member.gender && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0" />
                  <span>
                    {t('gender')}:{' '}
                    {member.gender === 'נקבה' || member.gender === 'female'
                      ? t('female')
                      : t('male')}
                  </span>
                </div>
              )}
              {member.birthDate && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {t('birthDate')}:{' '}
                    {new Date(member.birthDate).toLocaleDateString('he-IL')}
                    {age !== null && ` (${age})`}
                  </span>
                </div>
              )}
              {member.knessetNum && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Gavel className="h-4 w-4 shrink-0" />
                  <span>
                    {t('knessetNum')}: {member.knessetNum}
                  </span>
                </div>
              )}
              {member.startDate && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {t('startDate')}:{' '}
                    {new Date(member.startDate).toLocaleDateString('he-IL')}
                  </span>
                </div>
              )}
              {member.endDate && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {t('endDate')}:{' '}
                    {new Date(member.endDate).toLocaleDateString('he-IL')}
                  </span>
                </div>
              )}
              {member.email && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a
                    href={`mailto:${member.email}`}
                    className="text-primary hover:underline"
                  >
                    {member.email}
                  </a>
                </div>
              )}
              {member.phone && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a
                    href={`tel:${member.phone}`}
                    className="text-primary hover:underline"
                  >
                    {member.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Knesset & Faction History */}
            {factionHistory.length > 0 && (
              <>
                <Separator className="opacity-30" />
                <div className="w-full space-y-3">
                  <h3 className="text-sm font-semibold">
                    {t('factionHistory')}
                  </h3>
                  {(() => {
                    // Group by knesset number
                    const byKnesset = new Map<number, typeof factionHistory>();
                    for (const h of factionHistory) {
                      const arr = byKnesset.get(h.knessetNum) ?? [];
                      arr.push(h);
                      byKnesset.set(h.knessetNum, arr);
                    }
                    return Array.from(byKnesset.entries()).map(
                      ([knessetNum, entries]) => (
                        <div key={knessetNum} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                knessetNum === member.knessetNum
                                  ? 'default'
                                  : 'outline'
                              }
                              className="text-xs"
                            >
                              {t('knessetNum')}: {knessetNum}
                            </Badge>
                          </div>
                          {entries.map((entry, i) => (
                            <p
                              key={i}
                              className="text-muted-foreground ps-2 text-xs"
                            >
                              {entry.factionName}
                            </p>
                          ))}
                        </div>
                      ),
                    );
                  })()}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Details column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Vote summary */}
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">{t('voteHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-4 gap-3 text-center">
                <div className="rounded-xl bg-green-50 p-3 ring-1 ring-green-200/50 dark:bg-green-950/30 dark:ring-green-800/30">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {stats.for}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {tVotes('for')}
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200/50 dark:bg-red-950/30 dark:ring-red-800/30">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {stats.against}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {tVotes('against')}
                  </p>
                </div>
                <div className="rounded-xl bg-yellow-50 p-3 ring-1 ring-yellow-200/50 dark:bg-yellow-950/30 dark:ring-yellow-800/30">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                    {stats.abstain}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {tVotes('abstain')}
                  </p>
                </div>
                <div className="bg-muted ring-border/30 rounded-xl p-3 ring-1">
                  <p className="text-2xl font-bold">{stats.absent}</p>
                  <p className="text-muted-foreground text-xs">
                    {tVotes('absent')}
                  </p>
                </div>
              </div>

              {/* Participation rate bar */}
              {totalVotes > 0 && (
                <div className="mb-4 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('participationRate')}
                    </span>
                    <span className="font-semibold">{participationRate}%</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${participationRate}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t('totalVotes')}: {totalVotes}
                  </p>
                </div>
              )}

              {/* Vote distribution bar */}
              {totalVotes > 0 && (
                <VoteDistributionBar
                  total={totalVotes}
                  segments={[
                    {
                      label: tVotes('for'),
                      count: stats.for,
                      color: 'bg-green-500',
                    },
                    {
                      label: tVotes('against'),
                      count: stats.against,
                      color: 'bg-red-500',
                    },
                    {
                      label: tVotes('abstain'),
                      count: stats.abstain,
                      color: 'bg-yellow-500',
                    },
                    {
                      label: tVotes('absent'),
                      count: stats.absent,
                      color: 'bg-muted-foreground/30',
                    },
                  ]}
                />
              )}

              <Separator className="my-4" />

              {/* Recent votes */}
              <h3 className="mb-3 text-sm font-semibold">{t('recentVotes')}</h3>
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
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            <TranslatedText text={v.voteTitle} />
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {v.voteDate
                              ? new Date(v.voteDate).toLocaleDateString('he-IL')
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

          {/* Bills initiated */}
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

          {/* Committees chaired */}
          {chairedCommittees.length > 0 && (
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
                      className="flex items-center justify-between rounded-lg p-2"
                    >
                      <span className="text-sm font-medium">
                        <TranslatedText text={c.name} />
                      </span>
                      <div className="flex gap-2">
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
          )}
          {/* Integrity & Ethics */}
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
        </div>
      </div>
    </div>
  );
}

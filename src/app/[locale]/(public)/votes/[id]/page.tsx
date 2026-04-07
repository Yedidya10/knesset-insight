import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import {
  Vote,
  ThumbsUp,
  ThumbsDown,
  Minus,
  FileText,
  Link2,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  votes,
  memberVotes,
  members,
  factions,
  bills,
  billClusters,
  billClusterMembers,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import MemberAvatar from '@/components/members/MemberAvatar';
import TranslatedText from '@/components/ui/translated-text';
import FactionBreakdown from '@/components/votes/FactionBreakdown';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VoteDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('votes');
  const tCommon = await getTranslations('common');

  const voteId = Number(id);
  if (isNaN(voteId)) notFound();

  // Fetch vote with bill info
  const [vote] = await db
    .select({
      id: votes.id,
      knessetId: votes.knessetId,
      title: votes.title,
      voteDate: votes.voteDate,
      voteType: votes.voteType,
      knessetNum: votes.knessetNum,
      sessionId: votes.sessionId,
      sessItemId: votes.sessItemId,
      forCount: votes.forCount,
      againstCount: votes.againstCount,
      abstainCount: votes.abstainCount,
      isAccepted: votes.isAccepted,
      summary: votes.summary,
      billId: votes.billId,
      billName: bills.name,
    })
    .from(votes)
    .leftJoin(bills, eq(votes.billId, bills.id))
    .where(eq(votes.id, voteId))
    .limit(1);

  if (!vote) notFound();

  // Fetch member votes with member + party info
  const voterData = await db
    .select({
      memberId: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      voteValue: memberVotes.voteValue,
      factionName: factions.name,
      factionId: factions.id,
      isCoalition: factions.isCoalition,
    })
    .from(memberVotes)
    .innerJoin(members, eq(memberVotes.memberId, members.id))
    .leftJoin(factions, eq(members.factionId, factions.id))
    .where(eq(memberVotes.voteId, vote.id));

  // Fetch related votes (same sessItemId) — compute counts from member_votes
  // (cached forCount/againstCount on the votes table may be stale)
  let relatedVotes: {
    id: number;
    title: string;
    isAccepted: boolean | null;
    forCount: number;
    againstCount: number;
  }[] = [];
  if (vote.sessItemId) {
    const relatedRows = await db
      .select({
        id: votes.id,
        title: votes.title,
        isAccepted: votes.isAccepted,
      })
      .from(votes)
      .where(
        and(
          eq(votes.sessItemId, vote.sessItemId),
          sql`${votes.id} != ${voteId}`,
        ),
      )
      .orderBy(desc(votes.voteDate));

    if (relatedRows.length > 0) {
      const relatedIds = relatedRows.map((r) => r.id);
      const tallies = await db
        .select({
          voteId: memberVotes.voteId,
          voteValue: memberVotes.voteValue,
          count: sql<number>`cast(count(*) as integer)`.mapWith(Number),
        })
        .from(memberVotes)
        .where(inArray(memberVotes.voteId, relatedIds))
        .groupBy(memberVotes.voteId, memberVotes.voteValue);

      const tallyMap = new Map<number, { for: number; against: number }>();
      for (const t of tallies) {
        if (!tallyMap.has(t.voteId))
          tallyMap.set(t.voteId, { for: 0, against: 0 });
        const entry = tallyMap.get(t.voteId)!;
        if (t.voteValue === 'for') entry.for = t.count;
        else if (t.voteValue === 'against') entry.against = t.count;
      }

      relatedVotes = relatedRows.map((r) => ({
        ...r,
        forCount: tallyMap.get(r.id)?.for ?? 0,
        againstCount: tallyMap.get(r.id)?.against ?? 0,
      }));
    }
  }

  // Group by faction for breakdown, split by coalition/opposition
  const factionBreakdown = new Map<
    string,
    {
      for: number;
      against: number;
      abstain: number;
      absent: number;
      isCoalition: boolean | null;
    }
  >();
  for (const v of voterData) {
    const fName = v.factionName ?? '—';
    if (!factionBreakdown.has(fName)) {
      factionBreakdown.set(fName, {
        for: 0,
        against: 0,
        abstain: 0,
        absent: 0,
        isCoalition: v.isCoalition,
      });
    }
    const counts = factionBreakdown.get(fName)!;
    if (v.voteValue === 'for') counts.for++;
    else if (v.voteValue === 'against') counts.against++;
    else if (v.voteValue === 'abstain') counts.abstain++;
    else counts.absent++;
  }

  const coalitionFactions = [...factionBreakdown.entries()]
    .filter(([, c]) => c.isCoalition)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const oppositionFactions = [...factionBreakdown.entries()]
    .filter(([, c]) => !c.isCoalition)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const forVoters = voterData.filter((v) => v.voteValue === 'for');
  const againstVoters = voterData.filter((v) => v.voteValue === 'against');
  const abstainVoters = voterData.filter((v) => v.voteValue === 'abstain');
  // Use actual member_votes count — always consistent with the breakdown displayed below.
  // vote.forCount etc. may differ if some members haven't been synced yet.
  const forCount = forVoters.length;
  const againstCount = againstVoters.length;
  const abstainCount = abstainVoters.length;
  const totalVoters = forCount + againstCount + abstainCount;

  const renderVoterList = (
    voters: typeof voterData,
    icon: React.ReactNode,
    label: string,
    colorClass: string,
  ) => (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle
          className={`flex items-center gap-2 text-base ${colorClass}`}
        >
          {icon}
          {label} ({voters.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {voters.length > 0 ? (
          <ul className="space-y-2">
            {voters.map((v) => (
              <li key={v.memberId} className="flex items-center gap-2">
                <MemberAvatar
                  member={{
                    firstName: v.firstName,
                    lastName: v.lastName,
                    imageUrl: v.imageUrl,
                  }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/members/${v.memberId}`}
                    className="text-primary text-sm hover:underline"
                  >
                    {v.firstName} {v.lastName}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    {' '}
                    · {v.factionName}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">—</p>
        )}
      </CardContent>
    </Card>
  );

  // Fetch cluster info for breadcrumb — gracefully degrade if tables missing
  let cluster: { id: number; name: string } | null = null;
  if (vote.billId) {
    try {
      const [clusterRow] = await db
        .select({ id: billClusters.id, name: billClusters.name })
        .from(billClusterMembers)
        .innerJoin(
          billClusters,
          eq(billClusterMembers.clusterId, billClusters.id),
        )
        .where(eq(billClusterMembers.billId, vote.billId))
        .limit(1);
      if (clusterRow) cluster = clusterRow;
    } catch {
      // bill_cluster_members table may not exist yet
    }
  }

  const tLeg = await getTranslations('legislation');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Legislation context breadcrumb */}
      {(cluster || vote.billId) && (
        <nav className="text-muted-foreground mb-4 flex flex-wrap items-center gap-1 text-sm">
          <Link href="/legislation" className="hover:text-foreground">
            {tLeg('title')}
          </Link>
          {cluster && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link
                href={`/legislation/laws/${cluster.id}`}
                className="hover:text-foreground"
              >
                {cluster.name}
              </Link>
            </>
          )}
          {vote.billId && vote.billName && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link
                href={`/legislation/${vote.billId}`}
                className="hover:text-foreground"
              >
                <TranslatedText text={vote.billName} />
              </Link>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{t('title')}</span>
        </nav>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="mb-6"
        render={
          <Link
            href={vote.billId ? `/legislation/${vote.billId}` : '/legislation'}
          />
        }
      >
        {tCommon('back')}
      </Button>

      {/* Vote header card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <div className="from-primary/40 via-chart-2/30 to-chart-4/30 h-2 bg-gradient-to-r" />
        <CardContent className="p-6">
          <h1 className="text-xl font-bold sm:text-2xl">
            <TranslatedText text={vote.title} as="span" />
          </h1>

          {/* Meta badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {vote.voteDate && (
              <Badge variant="outline">
                {new Date(vote.voteDate).toLocaleDateString('he-IL')}
              </Badge>
            )}
            <Badge variant={vote.isAccepted ? 'default' : 'secondary'}>
              {vote.isAccepted ? t('approved') : t('rejected')}
            </Badge>
            {vote.knessetNum && (
              <Badge variant="outline">
                {t('knessetNum')} {vote.knessetNum}
              </Badge>
            )}
          </div>

          {/* Related bill link */}
          {vote.billId && vote.billName && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <FileText className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">{t('relatedBill')}:</span>
              <Link
                href={`/legislation/${vote.billId}`}
                className="text-primary hover:underline"
              >
                <TranslatedText text={vote.billName} />
              </Link>
            </div>
          )}

          <Separator className="my-4" />

          {/* Vote counts — enhanced */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl bg-green-50 p-4 dark:bg-green-950/30">
              <ThumbsUp className="mx-auto mb-1.5 h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {forCount}
              </p>
              <p className="text-muted-foreground text-xs">{t('for')}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
              <ThumbsDown className="mx-auto mb-1.5 h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                {againstCount}
              </p>
              <p className="text-muted-foreground text-xs">{t('against')}</p>
            </div>
            <div className="rounded-xl bg-yellow-50 p-4 dark:bg-yellow-950/30">
              <Minus className="mx-auto mb-1.5 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                {abstainCount}
              </p>
              <p className="text-muted-foreground text-xs">{t('abstain')}</p>
            </div>
          </div>

          {totalVoters > 0 && (
            <p className="text-muted-foreground mt-3 text-center text-sm">
              {t('totalVoters')}: {totalVoters}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Related votes (reservations / הסתייגויות) */}
      {relatedVotes.length > 0 && (
        <Card className="glass-card mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-4 w-4" />
              {t('relatedVotes')} ({relatedVotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relatedVotes.map((rv) => (
                <Link key={rv.id} href={`/votes/${rv.id}`}>
                  <div className="bg-muted/40 hover:bg-muted flex items-center justify-between rounded-lg px-4 py-2.5 text-sm transition-colors">
                    <span className="min-w-0 flex-1 truncate">
                      <TranslatedText text={rv.title} />
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        {rv.forCount}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-600 dark:text-red-400">
                        {rv.againstCount}
                      </span>
                      <Badge
                        variant={rv.isAccepted ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {rv.isAccepted ? t('approved') : t('rejected')}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Faction breakdown — split by coalition / opposition */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">{t('factionBreakdown')}</CardTitle>
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
                {t('for')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
                {t('against')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-500" />
                {t('abstain')}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FactionBreakdown
            coalitionFactions={coalitionFactions}
            oppositionFactions={oppositionFactions}
          />
        </CardContent>
      </Card>

      {/* Voter lists with avatars */}
      <div className="grid gap-6 lg:grid-cols-3">
        {renderVoterList(
          forVoters,
          <ThumbsUp className="h-4 w-4" />,
          t('for'),
          'text-green-700 dark:text-green-400',
        )}
        {renderVoterList(
          againstVoters,
          <ThumbsDown className="h-4 w-4" />,
          t('against'),
          'text-red-700 dark:text-red-400',
        )}
        {renderVoterList(
          abstainVoters,
          <Minus className="h-4 w-4" />,
          t('abstain'),
          'text-yellow-700 dark:text-yellow-400',
        )}
      </div>
    </div>
  );
}

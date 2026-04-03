import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Vote, ThumbsUp, ThumbsDown, Minus, FileText, Link2 } from 'lucide-react';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { votes, memberVotes, members, factions, bills } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import TranslatedText from '@/components/ui/translated-text';

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

  // Fetch related votes (same sessItemId)
  let relatedVotes: { id: number; title: string; isAccepted: boolean | null; forCount: number | null; againstCount: number | null }[] = [];
  if (vote.sessItemId) {
    relatedVotes = await db
      .select({
        id: votes.id,
        title: votes.title,
        isAccepted: votes.isAccepted,
        forCount: votes.forCount,
        againstCount: votes.againstCount,
      })
      .from(votes)
      .where(
        and(
          eq(votes.sessItemId, vote.sessItemId),
          sql`${votes.id} != ${voteId}`,
        ),
      )
      .orderBy(desc(votes.voteDate));
  }

  // Group by faction for breakdown, split by coalition/opposition
  const factionBreakdown = new Map<string, { for: number; against: number; abstain: number; absent: number; isCoalition: boolean | null }>();
  for (const v of voterData) {
    const fName = v.factionName ?? '—';
    if (!factionBreakdown.has(fName)) {
      factionBreakdown.set(fName, { for: 0, against: 0, abstain: 0, absent: 0, isCoalition: v.isCoalition });
    }
    const counts = factionBreakdown.get(fName)!;
    if (v.voteValue === 'for') counts.for++;
    else if (v.voteValue === 'against') counts.against++;
    else if (v.voteValue === 'abstain') counts.abstain++;
    else counts.absent++;
  }

  const coalitionFactions = [...factionBreakdown.entries()].filter(([, c]) => c.isCoalition).sort((a, b) => a[0].localeCompare(b[0]));
  const oppositionFactions = [...factionBreakdown.entries()].filter(([, c]) => !c.isCoalition).sort((a, b) => a[0].localeCompare(b[0]));

  const forVoters = voterData.filter((v) => v.voteValue === 'for');
  const againstVoters = voterData.filter((v) => v.voteValue === 'against');
  const abstainVoters = voterData.filter((v) => v.voteValue === 'abstain');
  const totalVoters = forVoters.length + againstVoters.length + abstainVoters.length;

  const renderFactionBar = (entries: [string, { for: number; against: number; abstain: number; absent: number; isCoalition: boolean | null }][]) => (
    <div className="space-y-2.5">
      {entries.map(([partyName, counts]) => {
        const total = counts.for + counts.against + counts.abstain;
        if (total === 0) return null;
        return (
          <div key={partyName} className="flex items-center gap-3">
            <span className="min-w-[120px] text-sm font-medium truncate">{partyName}</span>
            <div className="flex flex-1 items-center gap-0.5 rounded-full overflow-hidden">
              {counts.for > 0 && (
                <div
                  className="h-5 bg-green-500 transition-all"
                  style={{ width: `${(counts.for / total) * 100}%` }}
                  title={`${t('for')}: ${counts.for}`}
                />
              )}
              {counts.against > 0 && (
                <div
                  className="h-5 bg-red-500 transition-all"
                  style={{ width: `${(counts.against / total) * 100}%` }}
                  title={`${t('against')}: ${counts.against}`}
                />
              )}
              {counts.abstain > 0 && (
                <div
                  className="h-5 bg-yellow-500 transition-all"
                  style={{ width: `${(counts.abstain / total) * 100}%` }}
                  title={`${t('abstain')}: ${counts.abstain}`}
                />
              )}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {counts.for}/{counts.against}/{counts.abstain}
            </span>
          </div>
        );
      })}
    </div>
  );

  const renderVoterList = (
    voters: typeof voterData,
    icon: React.ReactNode,
    label: string,
    colorClass: string,
  ) => (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-base ${colorClass}`}>
          {icon}
          {label} ({voters.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {voters.length > 0 ? (
          <ul className="space-y-2">
            {voters.map((v) => (
              <li key={v.memberId} className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  {v.imageUrl && <AvatarImage src={v.imageUrl} alt={`${v.firstName} ${v.lastName}`} />}
                  <AvatarFallback className="text-xs">
                    {v.firstName?.[0]}{v.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link href={`/members/${v.memberId}`} className="text-sm text-primary hover:underline">
                    {v.firstName} {v.lastName}
                  </Link>
                  <span className="text-xs text-muted-foreground"> · {v.factionName}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6" render={<Link href="/votes" />}>
        {tCommon('back')}
      </Button>

      {/* Vote header card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary/40 via-chart-2/30 to-chart-4/30" />
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
              <FileText className="h-4 w-4 text-muted-foreground" />
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
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{vote.forCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{t('for')}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
              <ThumbsDown className="mx-auto mb-1.5 h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{vote.againstCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{t('against')}</p>
            </div>
            <div className="rounded-xl bg-yellow-50 p-4 dark:bg-yellow-950/30">
              <Minus className="mx-auto mb-1.5 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{vote.abstainCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{t('abstain')}</p>
            </div>
          </div>

          {totalVoters > 0 && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
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
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2.5 text-sm transition-colors hover:bg-muted">
                    <span className="min-w-0 flex-1 truncate"><TranslatedText text={rv.title} /></span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">{rv.forCount ?? 0}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-600 dark:text-red-400">{rv.againstCount ?? 0}</span>
                      <Badge variant={rv.isAccepted ? 'default' : 'secondary'} className="text-xs">
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
          <CardTitle className="text-lg">{t('factionBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          {coalitionFactions.length > 0 || oppositionFactions.length > 0 ? (
            <div className="space-y-6">
              {coalitionFactions.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('coalitionBreakdown')}</h3>
                  {renderFactionBar(coalitionFactions)}
                </div>
              )}
              {oppositionFactions.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('oppositionBreakdown')}</h3>
                  {renderFactionBar(oppositionFactions)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
          )}
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

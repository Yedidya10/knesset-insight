'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  ExternalLink,
  Gavel,
  Users,
  Check,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { VoteTalliesBar } from '@/components/legislation/VoteTalliesBar';
import FactionBreakdown, {
  type FactionVoter,
} from '@/components/votes/FactionBreakdown';
import MemberAvatar from '@/components/members/MemberAvatar';
import { trpc } from '@/lib/trpc';

interface VoteData {
  id: number;
  knessetId: number;
  title: string;
  voteDate: Date | string | null;
  voteType: string | null;
  knessetNum: number | null;
  forCount: number | null;
  againstCount: number | null;
  abstainCount: number | null;
  isAccepted: boolean | null;
  summary: string | null;
  billId: number | null;
  billName: string | null;
  relatedVotes: {
    id: number;
    title: string;
    isAccepted: boolean | null;
    forCount: number | null;
    againstCount: number | null;
  }[];
}

interface Voter {
  memberId: number;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  voteValue: string;
  factionName: string | null;
  factionColor: string | null;
  isCoalition: boolean | null;
}

interface FactionData {
  factionName: string;
  factionColor: string | null;
  isCoalition: boolean | null;
  for: number;
  against: number;
  abstain: number;
  absent: number;
}

interface DetailData {
  voters: Voter[];
  factions: FactionData[];
}

export function VoteDetailContent({ vote }: { vote: VoteData }) {
  const t = useTranslations('votes');
  const tDetail = useTranslations('votes.detail');

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (detail || loading) return;
    setLoading(true);
    setError(false);
    try {
      const result = await trpc.votes.detail.query({ voteId: vote.id });
      setDetail(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [vote.id, detail, loading]);

  // Auto-fetch on first render
  if (!fetched && !loading) {
    void fetchDetail();
  }

  const knessetVoteUrl = `https://main.knesset.gov.il/Activity/plenum/Votes/Pages/vote.aspx?voteId=${vote.knessetId}`;
  const formattedDate = vote.voteDate
    ? new Date(vote.voteDate).toLocaleDateString()
    : null;

  // Build faction breakdown props
  const coalitionFactions: [
    string,
    {
      for: number;
      against: number;
      abstain: number;
      absent: number;
      isCoalition: boolean | null;
    },
  ][] = [];
  const oppositionFactions: [
    string,
    {
      for: number;
      against: number;
      abstain: number;
      absent: number;
      isCoalition: boolean | null;
    },
  ][] = [];

  if (detail) {
    for (const f of detail.factions) {
      const entry: [
        string,
        {
          for: number;
          against: number;
          abstain: number;
          absent: number;
          isCoalition: boolean | null;
        },
      ] = [
        f.factionName,
        {
          for: f.for,
          against: f.against,
          abstain: f.abstain,
          absent: f.absent,
          isCoalition: f.isCoalition,
        },
      ];
      if (f.isCoalition) {
        coalitionFactions.push(entry);
      } else {
        oppositionFactions.push(entry);
      }
    }
  }

  // Build voters-by-faction map for popover tooltips
  const votersByFaction = new Map<string, FactionVoter[]>();
  if (detail) {
    for (const v of detail.voters) {
      if (v.voteValue === 'absent') continue;
      const key = v.factionName ?? '';
      const arr = votersByFaction.get(key);
      if (arr) arr.push(v);
      else votersByFaction.set(key, [v]);
    }
  }

  // Group voters by voteValue, then by faction
  const groupByFaction = (voters: Voter[]) => {
    const map = new Map<string, Voter[]>();
    for (const v of voters) {
      const key = v.factionName ?? t('unknownFaction');
      const arr = map.get(key);
      if (arr) arr.push(v);
      else map.set(key, [v]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  };

  const votersByValue = detail
    ? {
        for: groupByFaction(detail.voters.filter((v) => v.voteValue === 'for')),
        against: groupByFaction(
          detail.voters.filter((v) => v.voteValue === 'against'),
        ),
        abstain: groupByFaction(
          detail.voters.filter((v) => v.voteValue === 'abstain'),
        ),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Vote metadata */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={vote.isAccepted ? 'default' : 'destructive'}>
              {vote.isAccepted ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {t('approved')}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <X className="h-3 w-3" />
                  {t('rejected')}
                </span>
              )}
            </Badge>
            {formattedDate && (
              <span className="text-muted-foreground text-sm">
                {tDetail('date')}: {formattedDate}
              </span>
            )}
            {vote.knessetNum && (
              <span className="text-muted-foreground text-sm">
                {t('knessetNum')} {vote.knessetNum}
              </span>
            )}
            {vote.voteType && (
              <span className="text-muted-foreground text-sm">
                {t('voteType')}: {vote.voteType}
              </span>
            )}
          </div>

          {/* Vote tallies bar */}
          <VoteTalliesBar
            forCount={vote.forCount ?? 0}
            againstCount={vote.againstCount ?? 0}
            abstainCount={vote.abstainCount ?? 0}
            isAccepted={vote.isAccepted}
          />

          {/* External link to Knesset website */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            render={
              <a
                href={knessetVoteUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {tDetail('knessetLink')}
          </Button>
        </CardContent>
      </Card>

      {/* Related bill */}
      {vote.billId && vote.billName && (
        <Card className="glass-card hover-lift border-s-primary/30 overflow-hidden border-s-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="text-primary h-4 w-4" />
              {t('relatedBill')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/legislation/${vote.billId}`}
              className="text-primary text-sm font-medium hover:underline"
            >
              {vote.billName}
              <ArrowRight className="ms-1 inline h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Faction breakdown */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {error && (
        <p className="text-destructive py-4 text-sm">{t('noTallyData')}</p>
      )}

      {detail && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('factionBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FactionBreakdown
              coalitionFactions={coalitionFactions}
              oppositionFactions={oppositionFactions}
              voters={votersByFaction}
            />

            {/* Voter list */}
            {votersByValue && (
              <div className="mt-4">
                <Sheet>
                  <SheetTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                      />
                    }
                  >
                    <Users className="h-3.5 w-3.5" />
                    {t('voterList')} (
                    {
                      detail.voters.filter((v) => v.voteValue !== 'absent')
                        .length
                    }
                    )
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="max-h-[70vh] overflow-y-auto"
                  >
                    <SheetHeader>
                      <SheetTitle>{t('voterList')}</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4 p-4 pt-0">
                      {(['for', 'against', 'abstain'] as const).map((value) => {
                        const factionGroups = votersByValue[value];
                        if (factionGroups.length === 0) return null;
                        const totalCount = factionGroups.reduce(
                          (s, [, v]) => s + v.length,
                          0,
                        );
                        const colorMap = {
                          for: 'text-green-600 dark:text-green-400',
                          against: 'text-red-600 dark:text-red-400',
                          abstain: 'text-yellow-600 dark:text-yellow-400',
                        };
                        return (
                          <div key={value}>
                            <h4
                              className={`mb-3 text-sm font-semibold ${colorMap[value]}`}
                            >
                              {t(value)} ({totalCount})
                            </h4>
                            <div className="space-y-3">
                              {factionGroups.map(([factionName, voters]) => (
                                <div key={factionName}>
                                  <h5 className="text-muted-foreground mb-1.5 text-xs font-medium">
                                    {factionName} ({voters.length})
                                  </h5>
                                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                    {voters.map((v) => (
                                      <div
                                        key={v.memberId}
                                        className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
                                      >
                                        <MemberAvatar
                                          member={{
                                            firstName: v.firstName,
                                            lastName: v.lastName,
                                            imageUrl: v.imageUrl,
                                          }}
                                          size="sm"
                                        />
                                        <span className="truncate">
                                          {v.firstName} {v.lastName}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Related votes */}
      {vote.relatedVotes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('relatedVotes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {vote.relatedVotes.map((rv) => {
                const rvTotal = (rv.forCount ?? 0) + (rv.againstCount ?? 0);
                const rvForPct =
                  rvTotal > 0 ? ((rv.forCount ?? 0) / rvTotal) * 100 : 50;

                return (
                  <Link
                    key={rv.id}
                    href={`/votes/${rv.id}`}
                    className="bg-muted/20 hover:bg-muted/40 flex items-center gap-3 rounded-lg p-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{rv.title}</p>
                    </div>
                    <Badge
                      variant={rv.isAccepted ? 'default' : 'destructive'}
                      className="shrink-0 text-[10px]"
                    >
                      {rv.isAccepted ? t('approved') : t('rejected')}
                    </Badge>
                    <div className="flex w-20 shrink-0 items-center gap-1.5 text-[10px]">
                      <span className="text-green-600 dark:text-green-400">
                        {rv.forCount ?? 0}
                      </span>
                      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-red-500/20">
                        <div
                          className="rounded-s-full bg-emerald-500 transition-all"
                          style={{ width: `${rvForPct}%` }}
                        />
                      </div>
                      <span className="text-red-600 dark:text-red-400">
                        {rv.againstCount ?? 0}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

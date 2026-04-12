'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import FactionBreakdown, {
  type FactionVoter,
} from '@/components/votes/FactionBreakdown';
import MemberAvatar from '@/components/members/MemberAvatar';

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

export function InlineVoteDetail({ voteId }: { voteId: number }) {
  const t = useTranslations('votes');
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    setError(false);
    try {
      const result = await trpc.votes.detail.query({ voteId });
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [voteId, data, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive py-2 text-xs">{t('noTallyData')}</p>;
  }

  if (!data) {
    // Trigger fetch on mount via effect-free approach — caller must invoke fetchDetail
    // This component is rendered inside a collapsible; we fetch on expand.
    void fetchDetail();
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      </div>
    );
  }

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

  for (const f of data.factions) {
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

  // Build voters-by-faction map for popover tooltips
  const votersByFaction = new Map<string, FactionVoter[]>();
  for (const v of data.voters) {
    if (v.voteValue === 'absent') continue;
    const key = v.factionName ?? '';
    const arr = votersByFaction.get(key);
    if (arr) arr.push(v);
    else votersByFaction.set(key, [v]);
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
    // Sort factions by voter count descending
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  };

  const votersByValue = {
    for: groupByFaction(data.voters.filter((v) => v.voteValue === 'for')),
    against: groupByFaction(
      data.voters.filter((v) => v.voteValue === 'against'),
    ),
    abstain: groupByFaction(
      data.voters.filter((v) => v.voteValue === 'abstain'),
    ),
  };

  return (
    <div className="space-y-3 pt-2">
      {/* Faction breakdown */}
      <FactionBreakdown
        coalitionFactions={coalitionFactions}
        oppositionFactions={oppositionFactions}
        voters={votersByFaction}
      />

      {/* Voter list trigger */}
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="outline" size="sm" className="w-full gap-2" />
          }
        >
          <Users className="h-3.5 w-3.5" />
          {t('voterList')} (
          {data.voters.filter((v) => v.voteValue !== 'absent').length})
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
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
  );
}

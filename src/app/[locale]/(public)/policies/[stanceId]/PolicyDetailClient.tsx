'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import Image from 'next/image';
import {
  Target,
  Users,
  Building2,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  POLICY_DOMAINS,
  type PolicyDomain,
} from '@/lib/knesset/policy-domains';

type MemberTier = {
  level: string;
  min: number;
  items: Array<{
    memberId: number;
    name: string;
    imageUrl: string | null;
    factionName: string | null;
    factionColor: string | null;
    score: number;
    voteCount: number;
  }>;
};

type FactionTier = {
  level: string;
  min: number;
  items: Array<{
    factionId: number;
    name: string;
    color: string | null;
    isCoalition: boolean | null;
    score: number;
    voteCount: number;
    cohesion: number;
    participatingMembers: number;
  }>;
};

type RelevantVote = {
  voteId: number;
  title: string;
  voteDate: string | null;
  isAccepted: boolean | null;
  forCount: number | null;
  againstCount: number | null;
  alignment: string;
  proPosition: Record<string, string> | null;
  billId: number | null;
};

type PolicyStance = {
  id: number;
  label: Record<string, string>;
  description: Record<string, string> | null;
  domain: string | null;
  stanceType: string;
  voteCount: number | null;
};

interface PolicyDetailClientProps {
  stance: PolicyStance;
  memberTiers: MemberTier[];
  factionTiers: FactionTier[];
  relevantVotes: RelevantVote[];
  initialView: 'members' | 'factions';
}

export default function PolicyDetailClient({
  stance,
  memberTiers,
  factionTiers,
  relevantVotes,
  initialView,
}: PolicyDetailClientProps) {
  const t = useTranslations('policies');
  const locale = useLocale() as 'he' | 'en' | 'ar' | 'ru';
  const [view, setView] = useState(initialView);
  const [showVotes, setShowVotes] = useState(false);

  const label = stance.label?.[locale] ?? stance.label?.he ?? '';
  const description = stance.description?.[locale] ?? stance.description?.he;
  const domainLabel = stance.domain
    ? POLICY_DOMAINS[stance.domain as PolicyDomain]?.[locale]
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Target className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {label}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {domainLabel && <Badge variant="outline">{domainLabel}</Badge>}
            <Badge
              variant={
                stance.stanceType === 'derived' ? 'secondary' : 'outline'
              }
            >
              {t(`stanceType.${stance.stanceType}`)}
            </Badge>
            <span className="text-muted-foreground text-sm">
              {t('voteCount', { count: stance.voteCount ?? 0 })}
            </span>
          </div>
          {description && (
            <p className="text-muted-foreground mt-2 text-sm">{description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={view === 'members' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('members')}
          className="gap-1.5"
        >
          <Users className="h-4 w-4" />
          {t('tabs.members')}
        </Button>
        <Button
          variant={view === 'factions' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('factions')}
          className="gap-1.5"
        >
          <Building2 className="h-4 w-4" />
          {t('tabs.factions')}
        </Button>
      </div>

      {/* Tiers */}
      {view === 'members' ? (
        memberTiers.length > 0 ? (
          <div className="space-y-6">
            {memberTiers.map((tier) => (
              <div key={tier.level}>
                <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                  {t(`tier.${tier.level}`)}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tier.items.map((mk) => (
                    <Link key={mk.memberId} href={`/members/${mk.memberId}`}>
                      <Card className="hover-lift">
                        <CardContent className="flex items-center gap-3 p-3">
                          <div
                            className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
                            style={
                              mk.factionColor
                                ? {
                                    borderInlineStart: `3px solid ${mk.factionColor}`,
                                  }
                                : undefined
                            }
                          >
                            {mk.imageUrl ? (
                              <Image
                                src={mk.imageUrl}
                                alt={mk.name}
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Users className="text-muted-foreground h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {mk.name}
                            </p>
                            {mk.factionName && (
                              <p className="text-muted-foreground truncate text-xs">
                                {mk.factionName}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-end">
                            <span className="text-sm font-bold">
                              {t('score', { score: mk.score })}
                            </span>
                            <p className="text-muted-foreground text-xs whitespace-nowrap">
                              {t('voteCount', { count: mk.voteCount })}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
            <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
              <Target className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm">{t('noResults')}</p>
          </div>
        )
      ) : factionTiers.length > 0 ? (
        <TooltipProvider>
          <div className="space-y-6">
            {factionTiers.map((tier) => (
              <div key={tier.level}>
                <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                  {t(`tier.${tier.level}`)}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tier.items.map((faction) => (
                    <Card key={faction.factionId} className="hover-lift">
                      <CardContent className="space-y-2.5 p-4">
                        {/* Top row: faction name + score */}
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-1.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: faction.color ?? '#94a3b8',
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {faction.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {faction.participatingMembers} {t('tabs.members')}
                            </p>
                          </div>
                          <span className="text-lg font-bold tabular-nums">
                            {faction.score}%
                          </span>
                        </div>

                        {/* Score bar */}
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${faction.score}%`,
                              backgroundColor: faction.color ?? '#94a3b8',
                            }}
                          />
                        </div>

                        {/* Bottom row: cohesion badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">
                            {t('score', { score: faction.score })}
                          </span>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="bg-muted inline-flex cursor-help items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums" />
                              }
                            >
                              {t('cohesion')} {faction.cohesion}%
                              <Info className="h-3 w-3 opacity-40" />
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              {t('cohesionExplainer')}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TooltipProvider>
      ) : (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Target className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}

      {/* Relevant Votes (Evidence) */}
      {relevantVotes.length > 0 && (
        <div className="mt-10">
          <Button
            variant="ghost"
            onClick={() => setShowVotes(!showVotes)}
            className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1.5 text-sm font-semibold tracking-wider uppercase transition-colors"
          >
            {t('relevantVotes')} ({relevantVotes.length})
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                showVotes && 'rotate-180',
              )}
            />
          </Button>
          {showVotes && (
            <div className="space-y-2">
              <TooltipProvider>
                {relevantVotes.map((vote) => (
                  <Card key={vote.voteId} className="glass-card">
                    <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{vote.title}</p>
                        {vote.proPosition && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {t('proPosition')}:{' '}
                            {vote.proPosition[locale] ?? vote.proPosition.he}
                          </p>
                        )}
                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                          {vote.voteDate && (
                            <span>
                              {new Date(vote.voteDate).toLocaleDateString(
                                locale === 'he' ? 'he-IL' : locale,
                              )}
                            </span>
                          )}
                          {vote.forCount != null &&
                            vote.againstCount != null && (
                              <span>
                                {vote.forCount}-{vote.againstCount}
                              </span>
                            )}
                          <Badge
                            variant={vote.isAccepted ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {vote.isAccepted ? '✅' : '❌'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {vote.alignment === 'supports' ? '➕' : '➖'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger
                            render={<Link href={`/votes/${vote.voteId}`} />}
                          >
                            <Button variant="ghost" size="sm" className="gap-1">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('viewVote')}</TooltipContent>
                        </Tooltip>
                        {vote.billId && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Link href={`/legislation/${vote.billId}`} />
                              }
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                              >
                                <FileText className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('viewBill')}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TooltipProvider>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

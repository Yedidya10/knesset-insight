import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  policyStances,
  voteStanceAlignment,
  memberVotes,
  members,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  POLICY_DOMAINS,
  type PolicyDomain,
} from '@/lib/knesset/policy-domains';
import { appConfig } from '../../../app.config';

const SCORE_TIERS = [
  { level: 'very_strongly_for', min: 95 },
  { level: 'strongly_for', min: 80 },
  { level: 'moderately_for', min: 60 },
  { level: 'slightly_for', min: 40 },
  { level: 'slightly_against', min: 25 },
  { level: 'moderately_against', min: 15 },
  { level: 'strongly_against', min: 5 },
  { level: 'very_strongly_against', min: 0 },
] as const;

function getTier(score: number): string {
  for (const tier of SCORE_TIERS) {
    if (score >= tier.min) return tier.level;
  }
  return 'very_strongly_against';
}

function getScoreColor(score: number): string {
  if (score >= 60)
    return 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300';
  if (score >= 40)
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300';
  return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300';
}

interface FactionPolicyStancesProps {
  factionIds: number[];
}

export default async function FactionPolicyStances({
  factionIds,
}: FactionPolicyStancesProps) {
  const t = await getTranslations('factions');
  const tPolicies = await getTranslations('policies');
  const locale = (await getLocale()) as 'he' | 'en' | 'ar' | 'ru';
  const minVotes = appConfig.policyStances.minVotesForScore;

  // Get all vote stance alignments
  const alignments = await db
    .select({
      voteId: voteStanceAlignment.voteId,
      stanceId: voteStanceAlignment.stanceId,
      alignment: voteStanceAlignment.alignment,
    })
    .from(voteStanceAlignment);

  if (alignments.length === 0) {
    return (
      <Card className="glass-card overflow-hidden lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">{t('policyStances')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {tPolicies('noResults')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const voteIds = [...new Set(alignments.map((a) => a.voteId))];

  // Get faction member votes on aligned votes
  const factionMemberVotes = await db
    .select({
      voteId: memberVotes.voteId,
      voteValue: memberVotes.voteValue,
    })
    .from(memberVotes)
    .innerJoin(members, eq(memberVotes.memberId, members.id))
    .where(
      and(
        sql`${memberVotes.voteId} IN ${voteIds}`,
        sql`${members.factionId} IN ${factionIds}`,
        eq(members.isCurrent, true),
      ),
    );

  if (factionMemberVotes.length === 0) {
    return (
      <Card className="glass-card overflow-hidden lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">{t('policyStances')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {tPolicies('noResults')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Build alignment lookup
  const alignmentMap = new Map<number, Map<number, string>>();
  for (const a of alignments) {
    if (!alignmentMap.has(a.voteId)) alignmentMap.set(a.voteId, new Map());
    alignmentMap.get(a.voteId)!.set(a.stanceId, a.alignment);
  }

  // Aggregate per stance
  const stanceAgg = new Map<
    number,
    { matchCount: number; totalCount: number }
  >();

  for (const mv of factionMemberVotes) {
    if (mv.voteValue === 'absent') continue;
    const stanceMap = alignmentMap.get(mv.voteId);
    if (!stanceMap) continue;

    for (const [stanceId, alignment] of stanceMap) {
      if (!stanceAgg.has(stanceId))
        stanceAgg.set(stanceId, { matchCount: 0, totalCount: 0 });
      const agg = stanceAgg.get(stanceId)!;
      agg.totalCount++;

      const votedInDirection =
        (alignment === 'supports' && mv.voteValue === 'for') ||
        (alignment === 'opposes' && mv.voteValue === 'against');
      if (votedInDirection) agg.matchCount++;
    }
  }

  // Filter and score
  const scored: Array<{ stanceId: number; score: number; voteCount: number }> =
    [];
  for (const [stanceId, agg] of stanceAgg) {
    if (agg.totalCount < minVotes) continue;
    scored.push({
      stanceId,
      score: Math.round((agg.matchCount / agg.totalCount) * 100),
      voteCount: agg.totalCount,
    });
  }

  // Sort by strongest signal (furthest from 50%)
  scored.sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
  const topScored = scored.slice(0, 6);

  if (topScored.length === 0) {
    return (
      <Card className="glass-card overflow-hidden lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">{t('policyStances')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {tPolicies('noResults')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Fetch stance details
  const stanceIds = topScored.map((s) => s.stanceId);
  const stanceDetails = await db
    .select({
      id: policyStances.id,
      label: policyStances.label,
      domain: policyStances.domain,
    })
    .from(policyStances)
    .where(sql`${policyStances.id} IN ${stanceIds}`);

  const stanceMap = new Map(stanceDetails.map((s) => [s.id, s]));

  const stances = topScored
    .map((s) => {
      const detail = stanceMap.get(s.stanceId);
      if (!detail) return null;
      return {
        id: s.stanceId,
        label: detail.label as Record<string, string>,
        domain: detail.domain,
        score: s.score,
        tier: getTier(s.score),
        voteCount: s.voteCount,
      };
    })
    .filter(Boolean) as Array<{
    id: number;
    label: Record<string, string>;
    domain: string | null;
    score: number;
    tier: string;
    voteCount: number;
  }>;

  return (
    <Card className="glass-card overflow-hidden lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">{t('policyStances')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stances.map((stance) => {
            const label = stance.label[locale] ?? stance.label.he ?? '';
            const domainLabel = stance.domain
              ? POLICY_DOMAINS[stance.domain as PolicyDomain]?.[locale]
              : null;

            return (
              <Link
                key={stance.id}
                href={`/policies/${stance.id}`}
                className="border-border/50 hover:bg-muted/50 block rounded-xl border p-3 transition-all hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight font-medium">{label}</p>
                    {domainLabel && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {domainLabel}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${getScoreColor(stance.score)}`}
                  >
                    {tPolicies('score', { score: stance.score })}
                  </Badge>
                </div>
              </Link>
            );
          })}
          <Link
            href="/policies"
            className="text-muted-foreground hover:text-foreground mt-2 block text-center text-sm transition-colors"
          >
            {t('viewAllPolicies')} →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

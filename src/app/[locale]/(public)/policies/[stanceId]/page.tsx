import { getTranslations, getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  policyStances,
  voteStanceAlignment,
  votes,
  memberVotes,
  members,
  factions,
} from '@/lib/db/schema';
import { appConfig } from '../../../../../../app.config';
import PolicyDetailClient from './PolicyDetailClient';

interface Props {
  params: Promise<{ stanceId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stanceId } = await params;
  const t = await getTranslations('seo.policies');
  const locale = (await getLocale()) as 'he' | 'en' | 'ar' | 'ru';

  const [stance] = await db
    .select({ label: policyStances.label })
    .from(policyStances)
    .where(eq(policyStances.id, Number(stanceId)))
    .limit(1);

  const name =
    (stance?.label as Record<string, string>)?.[locale] ??
    (stance?.label as Record<string, string>)?.he ??
    '';

  return {
    title: t('detail.title', { name }),
    description: t('detail.description', { name }),
    openGraph: {
      title: t('detail.title', { name }),
      description: t('detail.description', { name }),
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function PolicyDetailPage({ params }: Props) {
  const { stanceId } = await params;
  const id = Number(stanceId);
  if (isNaN(id)) notFound();

  const minVotes = appConfig.policyStances.minVotesForScore;

  // Fetch stance
  const [stance] = await db
    .select({
      id: policyStances.id,
      label: policyStances.label,
      description: policyStances.description,
      domain: policyStances.domain,
      stanceType: policyStances.stanceType,
      voteCount: policyStances.voteCount,
    })
    .from(policyStances)
    .where(eq(policyStances.id, id))
    .limit(1);

  if (!stance) notFound();

  // Fetch relevant votes
  const relevantVotes = await db
    .select({
      voteId: votes.id,
      title: votes.title,
      voteDate: votes.voteDate,
      isAccepted: votes.isAccepted,
      forCount: votes.forCount,
      againstCount: votes.againstCount,
      knessetNum: votes.knessetNum,
      billId: votes.billId,
      alignment: voteStanceAlignment.alignment,
      proPosition: voteStanceAlignment.proPosition,
    })
    .from(voteStanceAlignment)
    .innerJoin(votes, eq(voteStanceAlignment.voteId, votes.id))
    .where(eq(voteStanceAlignment.stanceId, id))
    .orderBy(desc(votes.voteDate));

  const voteIds = relevantVotes.map((v) => v.voteId);

  // Build members tiers (default view)
  let memberTiers: Array<{
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
  }> = [];

  if (voteIds.length > 0) {
    const mkVotesRaw = await db
      .select({
        memberId: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        imageUrl: members.imageUrl,
        factionName: factions.name,
        factionColor: factions.color,
        voteValue: memberVotes.voteValue,
        voteId: memberVotes.voteId,
      })
      .from(memberVotes)
      .innerJoin(members, eq(memberVotes.memberId, members.id))
      .leftJoin(factions, eq(members.factionId, factions.id))
      .where(sql`${memberVotes.voteId} IN ${voteIds}`);

    const alignmentMap = new Map<number, string>();
    for (const v of relevantVotes) {
      alignmentMap.set(v.voteId, v.alignment);
    }

    const mkScores = new Map<
      number,
      {
        memberId: number;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
        factionName: string | null;
        factionColor: string | null;
        matchCount: number;
        totalCount: number;
      }
    >();

    for (const row of mkVotesRaw) {
      if (row.voteValue === 'absent') continue;
      if (!mkScores.has(row.memberId)) {
        mkScores.set(row.memberId, {
          memberId: row.memberId,
          firstName: row.firstName,
          lastName: row.lastName,
          imageUrl: row.imageUrl,
          factionName: row.factionName,
          factionColor: row.factionColor,
          matchCount: 0,
          totalCount: 0,
        });
      }
      const mk = mkScores.get(row.memberId)!;
      mk.totalCount++;
      const alignment = alignmentMap.get(row.voteId);
      const votedInDirection =
        (alignment === 'supports' && row.voteValue === 'for') ||
        (alignment === 'opposes' && row.voteValue === 'against');
      if (votedInDirection) mk.matchCount++;
    }

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

    const tiered = new Map<
      string,
      Array<{
        memberId: number;
        name: string;
        imageUrl: string | null;
        factionName: string | null;
        factionColor: string | null;
        score: number;
        voteCount: number;
      }>
    >();

    for (const mk of mkScores.values()) {
      if (mk.totalCount < minVotes) continue;
      const score = Math.round((mk.matchCount / mk.totalCount) * 100);
      let tier = 'very_strongly_against';
      for (const t of SCORE_TIERS) {
        if (score >= t.min) {
          tier = t.level;
          break;
        }
      }
      if (!tiered.has(tier)) tiered.set(tier, []);
      tiered.get(tier)!.push({
        memberId: mk.memberId,
        name: [mk.firstName, mk.lastName].filter(Boolean).join(' '),
        imageUrl: mk.imageUrl,
        factionName: mk.factionName,
        factionColor: mk.factionColor,
        score,
        voteCount: mk.totalCount,
      });
    }

    memberTiers = SCORE_TIERS.filter((t) => tiered.has(t.level)).map((t) => ({
      level: t.level,
      min: t.min,
      items: tiered.get(t.level)!.sort((a, b) => b.score - a.score),
    }));
  }

  return (
    <PolicyDetailClient
      stance={{
        id: stance.id,
        label: stance.label as Record<string, string>,
        description: stance.description as Record<string, string> | null,
        domain: stance.domain,
        stanceType: stance.stanceType,
        voteCount: stance.voteCount,
      }}
      tiers={memberTiers}
      relevantVotes={relevantVotes.map((v) => ({
        voteId: v.voteId,
        title: v.title,
        voteDate: v.voteDate?.toISOString() ?? null,
        isAccepted: v.isAccepted,
        forCount: v.forCount,
        againstCount: v.againstCount,
        alignment: v.alignment,
        proPosition: v.proPosition as Record<string, string> | null,
        billId: v.billId,
      }))}
      initialView="members"
    />
  );
}

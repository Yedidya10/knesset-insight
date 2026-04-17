import { z } from 'zod/v4';
import { eq, desc, sql, and, ilike } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  policyStances,
  voteStanceAlignment,
  votes,
  memberVotes,
  members,
  factions,
  bills,
} from '../../lib/db/schema';
import { POLICY_DOMAIN_LIST } from '../../lib/knesset/policy-domains';
import { appConfig } from '../../../app.config';

/**
 * 8-level score scale (TheyVoteForYou-inspired).
 * Score = percentage of votes where the MK voted with the stance direction.
 */
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

export const policiesRouter = router({
  /** List all policy stances, optionally filtered by domain / type */
  list: publicProcedure
    .input(
      z.object({
        domain: z.enum(POLICY_DOMAIN_LIST as [string, ...string[]]).optional(),
        stanceType: z.enum(['direct', 'derived', 'all']).default('all'),
        search: z.string().optional(),
        sort: z.enum(['vote_count', 'label']).default('vote_count'),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const { domain, stanceType, search, sort, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [eq(policyStances.isActive, true)];
      if (domain) conditions.push(eq(policyStances.domain, domain));
      if (stanceType !== 'all')
        conditions.push(eq(policyStances.stanceType, stanceType));
      if (search)
        conditions.push(
          ilike(sql`${policyStances.label}->>'he'`, `%${search}%`),
        );

      const whereClause = and(...conditions);

      const orderBy =
        sort === 'label'
          ? sql`${policyStances.label}->>'he'`
          : desc(policyStances.voteCount);

      const [data, countResult] = await Promise.all([
        db
          .select({
            id: policyStances.id,
            label: policyStances.label,
            description: policyStances.description,
            domain: policyStances.domain,
            stanceType: policyStances.stanceType,
            voteCount: policyStances.voteCount,
          })
          .from(policyStances)
          .where(whereClause)
          .orderBy(orderBy)
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(policyStances)
          .where(whereClause),
      ]);

      return {
        items: data,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / pageSize),
      };
    }),

  /** Policy detail page — MK or faction scores on an 8-level scale */
  detail: publicProcedure
    .input(
      z.object({
        stanceId: z.number(),
        view: z.enum(['members', 'factions']).default('members'),
        knessetNum: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { stanceId, view, knessetNum } = input;
      const minVotes = appConfig.policyStances.minVotesForScore;

      // Fetch the stance itself
      const [stance] = await db
        .select()
        .from(policyStances)
        .where(eq(policyStances.id, stanceId))
        .limit(1);
      if (!stance) return null;

      // Fetch all alignments for this stance
      const alignmentConditions = [eq(voteStanceAlignment.stanceId, stanceId)];

      // Fetch relevant votes with optional knesset filter
      const relevantVotesQuery = db
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
        .where(
          knessetNum
            ? and(
                eq(voteStanceAlignment.stanceId, stanceId),
                eq(votes.knessetNum, knessetNum),
              )
            : eq(voteStanceAlignment.stanceId, stanceId),
        )
        .orderBy(desc(votes.voteDate));

      const relevantVotes = await relevantVotesQuery;
      const voteIds = relevantVotes.map((v) => v.voteId);

      if (voteIds.length === 0) {
        return {
          stance,
          tiers: [],
          relevantVotes: [],
        };
      }

      if (view === 'members') {
        // MK scores: for each MK, calculate % of votes in the stance direction
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

        // Build alignment map: voteId -> alignment direction
        const alignmentMap = new Map<number, string>();
        for (const v of relevantVotes) {
          alignmentMap.set(v.voteId, v.alignment);
        }

        // Aggregate per MK
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
          if (row.voteValue === 'absent') continue; // skip absent

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
          // If alignment is 'supports', voting FOR = supporting the stance
          // If alignment is 'opposes', voting AGAINST = supporting the stance
          const votedInDirection =
            (alignment === 'supports' && row.voteValue === 'for') ||
            (alignment === 'opposes' && row.voteValue === 'against');
          if (votedInDirection) mk.matchCount++;
        }

        // Build tiers
        const tiered = new Map<string, typeof mkItems>();
        type MkItem = {
          memberId: number;
          name: string;
          imageUrl: string | null;
          factionName: string | null;
          factionColor: string | null;
          score: number;
          voteCount: number;
        };
        type MkItems = MkItem[];
        const mkItems: MkItems = [];

        for (const mk of mkScores.values()) {
          if (mk.totalCount < minVotes) continue;
          const score = Math.round((mk.matchCount / mk.totalCount) * 100);
          const tier = getTier(score);
          if (!tiered.has(tier)) tiered.set(tier, []);
          const item: MkItem = {
            memberId: mk.memberId,
            name: [mk.firstName, mk.lastName].filter(Boolean).join(' '),
            imageUrl: mk.imageUrl,
            factionName: mk.factionName,
            factionColor: mk.factionColor,
            score,
            voteCount: mk.totalCount,
          };
          tiered.get(tier)!.push(item);
        }

        // Transform to ordered tiers array
        const tiers = SCORE_TIERS.filter((t) => tiered.has(t.level)).map(
          (t) => ({
            level: t.level,
            min: t.min,
            items: tiered.get(t.level)!.sort((a, b) => b.score - a.score),
          }),
        );

        return {
          stance,
          tiers,
          relevantVotes: relevantVotes.map((v) => ({
            voteId: v.voteId,
            title: v.title,
            voteDate: v.voteDate,
            isAccepted: v.isAccepted,
            forCount: v.forCount,
            againstCount: v.againstCount,
            alignment: v.alignment,
            proPosition: v.proPosition,
            billId: v.billId,
          })),
        };
      }

      // view === 'factions'
      const factionVotesRaw = await db
        .select({
          factionId: factions.id,
          factionName: factions.name,
          factionColor: factions.color,
          isCoalition: factions.isCoalition,
          voteValue: memberVotes.voteValue,
          voteId: memberVotes.voteId,
          memberId: memberVotes.memberId,
        })
        .from(memberVotes)
        .innerJoin(members, eq(memberVotes.memberId, members.id))
        .innerJoin(factions, eq(members.factionId, factions.id))
        .where(sql`${memberVotes.voteId} IN ${voteIds}`);

      const alignmentMap = new Map<number, string>();
      for (const v of relevantVotes) {
        alignmentMap.set(v.voteId, v.alignment);
      }

      // Aggregate per faction
      const factionAgg = new Map<
        number,
        {
          factionId: number;
          factionName: string;
          factionColor: string | null;
          isCoalition: boolean | null;
          matchCount: number;
          totalCount: number;
          memberVoteMap: Map<number, { match: number; total: number }>;
        }
      >();

      for (const row of factionVotesRaw) {
        if (row.voteValue === 'absent') continue;
        if (!factionAgg.has(row.factionId)) {
          factionAgg.set(row.factionId, {
            factionId: row.factionId,
            factionName: row.factionName,
            factionColor: row.factionColor,
            isCoalition: row.isCoalition,
            matchCount: 0,
            totalCount: 0,
            memberVoteMap: new Map(),
          });
        }
        const f = factionAgg.get(row.factionId)!;
        f.totalCount++;

        const alignment = alignmentMap.get(row.voteId);
        const votedInDirection =
          (alignment === 'supports' && row.voteValue === 'for') ||
          (alignment === 'opposes' && row.voteValue === 'against');
        if (votedInDirection) f.matchCount++;

        // Track per-member for cohesion
        if (!f.memberVoteMap.has(row.memberId)) {
          f.memberVoteMap.set(row.memberId, { match: 0, total: 0 });
        }
        const m = f.memberVoteMap.get(row.memberId)!;
        m.total++;
        if (votedInDirection) m.match++;
      }

      // Build tiers for factions
      const tiered = new Map<
        string,
        Array<{
          factionId: number;
          name: string;
          color: string | null;
          isCoalition: boolean | null;
          score: number;
          voteCount: number;
          cohesion: number;
          participatingMembers: number;
        }>
      >();

      for (const f of factionAgg.values()) {
        if (f.totalCount < minVotes) continue;
        const score = Math.round((f.matchCount / f.totalCount) * 100);
        const tier = getTier(score);

        // Cohesion: what % of members voted with the faction's majority direction
        const factionMajority = score >= 50; // true = majority supported
        let cohesionMatches = 0;
        let cohesionTotal = 0;
        for (const m of f.memberVoteMap.values()) {
          if (m.total === 0) continue;
          cohesionTotal++;
          const memberScore = m.match / m.total;
          const memberSupportsMajority = memberScore >= 0.5;
          if (memberSupportsMajority === factionMajority) cohesionMatches++;
        }
        const cohesion =
          cohesionTotal > 0
            ? Math.round((cohesionMatches / cohesionTotal) * 100)
            : 0;

        if (!tiered.has(tier)) tiered.set(tier, []);
        tiered.get(tier)!.push({
          factionId: f.factionId,
          name: f.factionName,
          color: f.factionColor,
          isCoalition: f.isCoalition,
          score,
          voteCount: f.totalCount,
          cohesion,
          participatingMembers: f.memberVoteMap.size,
        });
      }

      const tiers = SCORE_TIERS.filter((t) => tiered.has(t.level)).map((t) => ({
        level: t.level,
        min: t.min,
        items: tiered.get(t.level)!.sort((a, b) => b.score - a.score),
      }));

      return {
        stance,
        tiers,
        relevantVotes: relevantVotes.map((v) => ({
          voteId: v.voteId,
          title: v.title,
          voteDate: v.voteDate,
          isAccepted: v.isAccepted,
          forCount: v.forCount,
          againstCount: v.againstCount,
          alignment: v.alignment,
          proPosition: v.proPosition,
          billId: v.billId,
        })),
      };
    }),

  /** Top policy stances for a specific faction (by faction IDs) */
  factionStances: publicProcedure
    .input(
      z.object({
        factionIds: z.array(z.number()).min(1),
        limit: z.number().min(1).max(20).default(6),
      }),
    )
    .query(async ({ input }) => {
      const { factionIds, limit } = input;
      const minVotes = appConfig.policyStances.minVotesForScore;

      // Get all vote IDs that have stance alignments
      const alignments = await db
        .select({
          voteId: voteStanceAlignment.voteId,
          stanceId: voteStanceAlignment.stanceId,
          alignment: voteStanceAlignment.alignment,
        })
        .from(voteStanceAlignment);

      if (alignments.length === 0) return { stances: [] };

      const voteIds = [...new Set(alignments.map((a) => a.voteId))];

      // Get member votes for this faction's current members on aligned votes
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

      if (factionMemberVotes.length === 0) return { stances: [] };

      // Build alignment lookup: voteId -> stanceId -> alignment
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

      // Filter by minVotes and compute scores
      const scored: Array<{
        stanceId: number;
        score: number;
        voteCount: number;
      }> = [];
      for (const [stanceId, agg] of stanceAgg) {
        if (agg.totalCount < minVotes) continue;
        scored.push({
          stanceId,
          score: Math.round((agg.matchCount / agg.totalCount) * 100),
          voteCount: agg.totalCount,
        });
      }

      // Sort by strongest signal (furthest from 50% in either direction)
      scored.sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
      const topScored = scored.slice(0, limit);

      if (topScored.length === 0) return { stances: [] };

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

      return {
        stances: topScored
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
          .filter(Boolean),
      };
    }),
});

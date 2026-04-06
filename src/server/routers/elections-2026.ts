import { z } from 'zod/v4';
import { eq, sql, desc, and } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  electionCampaigns,
  electionCandidateLists,
  electionCandidates,
  electionPolls,
  electionPollResults,
  electionTimelineEvents,
  members,
  memberVotes,
  billInitiators,
} from '../../lib/db/schema';

export const elections2026Router = router({
  /** Get campaign metadata */
  campaign: publicProcedure.query(async () => {
    const campaign = await db
      .select()
      .from(electionCampaigns)
      .where(eq(electionCampaigns.knessetNum, 26))
      .limit(1);
    return campaign[0] ?? null;
  }),

  /** All candidate lists with latest poll estimates */
  candidateLists: publicProcedure.query(async () => {
    return db
      .select({
        id: electionCandidateLists.id,
        name: electionCandidateLists.name,
        shortName: electionCandidateLists.shortName,
        slug: electionCandidateLists.slug,
        ballotLetters: electionCandidateLists.ballotLetters,
        leaderName: electionCandidateLists.leaderName,
        status: electionCandidateLists.status,
        color: electionCandidateLists.color,
        logoUrl: electionCandidateLists.logoUrl,
        estimatedSeats: electionCandidateLists.estimatedSeats,
        politicalPosition: electionCandidateLists.politicalPosition,
        sortOrder: electionCandidateLists.sortOrder,
      })
      .from(electionCandidateLists)
      .innerJoin(
        electionCampaigns,
        and(
          eq(electionCandidateLists.campaignId, electionCampaigns.id),
          eq(electionCampaigns.knessetNum, 26),
        ),
      )
      .orderBy(
        desc(electionCandidateLists.estimatedSeats),
        electionCandidateLists.sortOrder,
      );
  }),

  /** Single candidate list + candidates + poll history */
  candidateListBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const list = await db
        .select()
        .from(electionCandidateLists)
        .where(eq(electionCandidateLists.slug, input.slug))
        .limit(1);

      if (!list[0]) return null;

      const candidates = await db
        .select({
          id: electionCandidates.id,
          slug: electionCandidates.slug,
          firstName: electionCandidates.firstName,
          lastName: electionCandidates.lastName,
          position: electionCandidates.position,
          status: electionCandidates.status,
          isLeader: electionCandidates.isLeader,
          imageUrl: electionCandidates.imageUrl,
          profession: electionCandidates.profession,
          memberId: electionCandidates.memberId,
        })
        .from(electionCandidates)
        .where(eq(electionCandidates.candidateListId, list[0].id))
        .orderBy(electionCandidates.position, electionCandidates.lastName);

      // Poll history for this list
      const pollHistory = await db
        .select({
          predictedSeats: electionPollResults.predictedSeats,
          pollsterName: electionPolls.pollsterName,
          publishDate: electionPolls.publishDate,
        })
        .from(electionPollResults)
        .innerJoin(
          electionPolls,
          eq(electionPollResults.pollId, electionPolls.id),
        )
        .where(eq(electionPollResults.candidateListId, list[0].id))
        .orderBy(desc(electionPolls.publishDate));

      return {
        ...list[0],
        candidates,
        pollHistory,
      };
    }),

  /** Single candidate profile + MK activity if linked */
  candidateBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const candidate = await db
        .select()
        .from(electionCandidates)
        .where(eq(electionCandidates.slug, input.slug))
        .limit(1);

      if (!candidate[0]) return null;

      const c = candidate[0];

      // Get the parent list info
      const list = await db
        .select({
          slug: electionCandidateLists.slug,
          name: electionCandidateLists.name,
          shortName: electionCandidateLists.shortName,
          color: electionCandidateLists.color,
        })
        .from(electionCandidateLists)
        .where(eq(electionCandidateLists.id, c.candidateListId))
        .limit(1);

      // If candidate is a current MK, fetch activity summary
      let mkActivity = null;
      if (c.memberId) {
        const member = await db
          .select({
            id: members.id,
            firstName: members.firstName,
            lastName: members.lastName,
            imageUrl: members.imageUrl,
            isCurrent: members.isCurrent,
          })
          .from(members)
          .where(eq(members.id, c.memberId))
          .limit(1);

        if (member[0]) {
          const voteStats = await db
            .select({
              total: sql<number>`count(*)::int`,
              forVotes: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'for')::int`,
              againstVotes: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'against')::int`,
              abstainVotes: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'abstain')::int`,
              absentVotes: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'absent')::int`,
            })
            .from(memberVotes)
            .where(eq(memberVotes.memberId, c.memberId));

          const billCount = await db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(billInitiators)
            .where(eq(billInitiators.memberId, c.memberId));

          const stats = voteStats[0];
          const participated = (stats?.forVotes ?? 0) + (stats?.againstVotes ?? 0) + (stats?.abstainVotes ?? 0);
          const total = stats?.total ?? 0;

          mkActivity = {
            member: member[0],
            voteStats: stats,
            billCount: billCount[0]?.count ?? 0,
            participationRate: total > 0 ? Math.round((participated / total) * 100) : 0,
          };
        }
      }

      return {
        ...c,
        list: list[0] ?? null,
        mkActivity,
      };
    }),

  /** All polls with results */
  polls: publicProcedure.query(async () => {
    const campaign = await db
      .select({ id: electionCampaigns.id })
      .from(electionCampaigns)
      .where(eq(electionCampaigns.knessetNum, 26))
      .limit(1);

    if (!campaign[0]) return [];

    const polls = await db
      .select()
      .from(electionPolls)
      .where(eq(electionPolls.campaignId, campaign[0].id))
      .orderBy(desc(electionPolls.publishDate));

    const results = await db
      .select({
        pollId: electionPollResults.pollId,
        candidateListId: electionPollResults.candidateListId,
        predictedSeats: electionPollResults.predictedSeats,
        listName: electionCandidateLists.shortName,
        listColor: electionCandidateLists.color,
        listSlug: electionCandidateLists.slug,
      })
      .from(electionPollResults)
      .innerJoin(
        electionCandidateLists,
        eq(electionPollResults.candidateListId, electionCandidateLists.id),
      );

    return polls.map((poll) => ({
      ...poll,
      results: results
        .filter((r) => r.pollId === poll.id)
        .sort((a, b) => b.predictedSeats - a.predictedSeats),
    }));
  }),

  /** Aggregated poll trends for chart */
  pollTrends: publicProcedure.query(async () => {
    const campaign = await db
      .select({ id: electionCampaigns.id })
      .from(electionCampaigns)
      .where(eq(electionCampaigns.knessetNum, 26))
      .limit(1);

    if (!campaign[0]) return { dates: [], series: [] };

    const polls = await db
      .select({
        id: electionPolls.id,
        publishDate: electionPolls.publishDate,
      })
      .from(electionPolls)
      .where(eq(electionPolls.campaignId, campaign[0].id))
      .orderBy(electionPolls.publishDate);

    const results = await db
      .select({
        pollId: electionPollResults.pollId,
        candidateListId: electionPollResults.candidateListId,
        predictedSeats: electionPollResults.predictedSeats,
      })
      .from(electionPollResults);

    const lists = await db
      .select({
        id: electionCandidateLists.id,
        shortName: electionCandidateLists.shortName,
        color: electionCandidateLists.color,
        slug: electionCandidateLists.slug,
      })
      .from(electionCandidateLists)
      .innerJoin(
        electionCampaigns,
        and(
          eq(electionCandidateLists.campaignId, electionCampaigns.id),
          eq(electionCampaigns.knessetNum, 26),
        ),
      );

    const dates = polls.map((p) => p.publishDate);

    const series = lists.map((list) => ({
      name: list.shortName ?? '',
      color: list.color ?? '#888',
      slug: list.slug,
      data: polls.map((poll) => {
        const result = results.find(
          (r) => r.pollId === poll.id && r.candidateListId === list.id,
        );
        return result?.predictedSeats ?? null;
      }),
    }));

    return { dates, series };
  }),

  /** Timeline events */
  timeline: publicProcedure.query(async () => {
    const campaign = await db
      .select({ id: electionCampaigns.id })
      .from(electionCampaigns)
      .where(eq(electionCampaigns.knessetNum, 26))
      .limit(1);

    if (!campaign[0]) return [];

    return db
      .select()
      .from(electionTimelineEvents)
      .where(eq(electionTimelineEvents.campaignId, campaign[0].id))
      .orderBy(electionTimelineEvents.eventDate);
  }),
});

/**
 * Seed script for Elections 2026 campaign data.
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx src/pipeline/seed/seed-elections-2026.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
  electionCampaigns,
  electionCandidateLists,
  electionTimelineEvents,
  politicalGroups,
  members,
} from '../../lib/db/schema';
import seedData from './elections-2026.json';

async function seed() {
  console.log('Seeding Elections 2026 data...');

  // 1. Upsert campaign
  const existing = await db
    .select()
    .from(electionCampaigns)
    .where(eq(electionCampaigns.knessetNum, seedData.campaign.knessetNum))
    .limit(1);

  let campaignId: number;
  if (existing[0]) {
    campaignId = existing[0].id;
    console.log(`  Campaign K${seedData.campaign.knessetNum} already exists (id=${campaignId})`);
  } else {
    const [inserted] = await db
      .insert(electionCampaigns)
      .values({
        knessetNum: seedData.campaign.knessetNum,
        status: seedData.campaign.status,
      })
      .returning({ id: electionCampaigns.id });
    campaignId = inserted.id;
    console.log(`  Created campaign K${seedData.campaign.knessetNum} (id=${campaignId})`);
  }

  // 2. Build lookup maps
  const allGroups = await db
    .select({ id: politicalGroups.id, slug: politicalGroups.slug })
    .from(politicalGroups);
  const groupBySlug = new Map(allGroups.map((g) => [g.slug, g.id]));

  // Leader lookup by name (best-effort — matches current MKs)
  const allMembers = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      isCurrent: members.isCurrent,
    })
    .from(members);

  function findMember(leaderName: string): number | null {
    const parts = leaderName.split(' ');
    if (parts.length < 2) return null;
    const first = parts[0];
    const last = parts.slice(1).join(' ');
    const match = allMembers.find(
      (m) =>
        m.firstName === first && m.lastName === last && m.isCurrent,
    );
    return match?.id ?? null;
  }

  // 3. Upsert candidate lists
  let created = 0;
  let skipped = 0;
  for (const list of seedData.candidateLists) {
    const existingList = await db
      .select({ id: electionCandidateLists.id })
      .from(electionCandidateLists)
      .where(eq(electionCandidateLists.slug, list.slug))
      .limit(1);

    if (existingList[0]) {
      skipped++;
      continue;
    }

    const politicalGroupId = list.politicalGroupSlug
      ? groupBySlug.get(list.politicalGroupSlug) ?? null
      : null;
    const leaderMemberId = list.leaderName
      ? findMember(list.leaderName)
      : null;

    await db.insert(electionCandidateLists).values({
      campaignId,
      name: list.name,
      shortName: list.shortName,
      slug: list.slug,
      politicalGroupId,
      leaderName: list.leaderName,
      leaderMemberId,
      status: list.status,
      color: list.color,
      estimatedSeats: list.estimatedSeats,
      politicalPosition: list.politicalPosition,
      sortOrder: list.sortOrder,
    });
    created++;
  }
  console.log(`  Candidate lists: ${created} created, ${skipped} skipped (already exist)`);

  // 4. Upsert timeline events
  let eventsCreated = 0;
  for (const event of seedData.timelineEvents) {
    // Simple dedup by title + date
    const existingEvent = await db
      .select({ id: electionTimelineEvents.id })
      .from(electionTimelineEvents)
      .where(eq(electionTimelineEvents.title, event.title))
      .limit(1);

    if (existingEvent[0]) continue;

    await db.insert(electionTimelineEvents).values({
      campaignId,
      title: event.title,
      description: event.description,
      eventDate: event.eventDate,
      type: event.type,
      isCompleted: event.isCompleted,
    });
    eventsCreated++;
  }
  console.log(`  Timeline events: ${eventsCreated} created`);

  console.log('Done!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

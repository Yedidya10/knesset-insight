import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { politicalGroups, factions } from '@/lib/db/schema';
import PoliticalTimeline from '@/components/political-groups/PoliticalTimeline';

export default async function TimelineTab() {
  const groups = await db
    .select({
      id: politicalGroups.id,
      slug: politicalGroups.slug,
      canonicalName: politicalGroups.canonicalName,
      shortName: politicalGroups.shortName,
      color: politicalGroups.color,
      isActive: politicalGroups.isActive,
    })
    .from(politicalGroups);

  const terms = await db
    .select({
      politicalGroupId: factions.politicalGroupId,
      knessetNum: factions.knessetNum,
      name: factions.name,
      seats: factions.seats,
      isCoalition: factions.isCoalition,
    })
    .from(factions)
    .where(sql`${factions.politicalGroupId} is not null`)
    .orderBy(factions.knessetNum);

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="max-w-[100vw] px-4 sm:px-6">
        <PoliticalTimeline groups={groups} terms={terms} />
      </div>
    </div>
  );
}

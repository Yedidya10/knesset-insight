import { db } from '@/lib/db';
import { politicalGroups, politicalGroupLineage } from '@/lib/db/schema';
import LineageFlow from '@/components/political-groups/LineageFlow';

export default async function GraphTab() {
  const groups = await db
    .select({
      id: politicalGroups.id,
      slug: politicalGroups.slug,
      canonicalName: politicalGroups.canonicalName,
      shortName: politicalGroups.shortName,
      color: politicalGroups.color,
      foundedYear: politicalGroups.foundedYear,
      dissolvedYear: politicalGroups.dissolvedYear,
      isActive: politicalGroups.isActive,
    })
    .from(politicalGroups);

  const edges = await db
    .select({
      id: politicalGroupLineage.id,
      sourceGroupId: politicalGroupLineage.sourceGroupId,
      targetGroupId: politicalGroupLineage.targetGroupId,
      relationshipType: politicalGroupLineage.relationshipType,
      knessetNum: politicalGroupLineage.knessetNum,
      year: politicalGroupLineage.year,
    })
    .from(politicalGroupLineage);

  return <LineageFlow nodes={groups} edges={edges} />;
}

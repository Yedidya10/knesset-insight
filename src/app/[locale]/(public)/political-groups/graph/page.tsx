import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { db } from '@/lib/db';
import { politicalGroups, politicalGroupLineage } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import RelationshipGraph from '@/components/political-groups/RelationshipGraph';

export default async function GraphPage() {
  const t = await getTranslations('politicalGroups');

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

  return (
    <div className="mx-auto max-w-300 px-4 py-8 sm:px-6">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/political-groups" />}
        >
          {t('backToList')}
        </Button>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('graph')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <RelationshipGraph nodes={groups} edges={edges} />
    </div>
  );
}

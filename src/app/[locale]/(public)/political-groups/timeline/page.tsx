import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { politicalGroups, factions } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import PoliticalTimeline from '@/components/political-groups/PoliticalTimeline';

export default async function TimelinePage() {
  const t = await getTranslations('politicalGroups');

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
    <div className="mx-auto max-w-350 px-4 py-8 sm:px-6">
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
            {t('timeline')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <PoliticalTimeline groups={groups} terms={terms} />
    </div>
  );
}

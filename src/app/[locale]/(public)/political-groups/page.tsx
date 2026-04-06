import { getTranslations } from 'next-intl/server';
import { Users, Clock, Network } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { politicalGroups, factions } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function PoliticalGroupsPage() {
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
      factionCount: sql<number>`(
        select count(*)::int from factions
        where factions.political_group_id = ${politicalGroups.id}
      )`,
    })
    .from(politicalGroups)
    .orderBy(sql`${politicalGroups.isActive} desc, ${politicalGroups.canonicalName} asc`);

  const activeGroups = groups.filter((g) => g.isActive);
  const inactiveGroups = groups.filter((g) => !g.isActive);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Visualization links */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Button variant="outline" size="sm" render={<Link href="/political-groups/timeline" />}>
          <Clock className="me-1.5 h-4 w-4" />
          {t('timeline')}
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/political-groups/graph" />}>
          <Network className="me-1.5 h-4 w-4" />
          {t('graph')}
        </Button>
      </div>

      {/* Active groups */}
      {activeGroups.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">{t('active')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
            {activeGroups.map((group) => (
              <GroupCard key={group.id} group={group} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Inactive groups */}
      {inactiveGroups.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
            {t('inactive')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
            {inactiveGroups.map((group) => (
              <GroupCard key={group.id} group={group} t={t} />
            ))}
          </div>
        </section>
      )}

      {groups.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noGroups')}</p>
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  t,
}: {
  group: {
    id: number;
    slug: string;
    canonicalName: string;
    shortName: string | null;
    color: string | null;
    foundedYear: number | null;
    dissolvedYear: number | null;
    isActive: boolean | null;
    factionCount: number;
  };
  t: ReturnType<typeof import('next-intl').useTranslations>;
}) {
  return (
    <Link href={`/political-groups/${group.slug}`}>
      <Card className="glass-card hover-lift h-full overflow-hidden border-s-4"
        style={{ borderInlineStartColor: group.color ?? undefined }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{group.canonicalName}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {t('factionCount', { count: group.factionCount })}
          </Badge>
          {group.foundedYear && (
            <Badge variant="outline">{group.foundedYear}</Badge>
          )}
          {group.dissolvedYear && (
            <Badge variant="outline" className="text-muted-foreground">
              → {group.dissolvedYear}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Users, ArrowRight } from 'lucide-react';
import { eq, sql, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  politicalGroups,
  politicalGroupLineage,
  factions,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import TranslatedText from '@/components/ui/translated-text';

interface Props {
  params: Promise<{ slug: string }>;
}

const relationshipLabels: Record<string, string> = {
  merged_into: 'mergedInto',
  split_from: 'splitFrom',
  renamed_to: 'renamedTo',
  absorbed_by: 'absorbedBy',
};

export default async function PoliticalGroupDetailPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations('politicalGroups');
  const tCommon = await getTranslations('common');

  const [group] = await db
    .select()
    .from(politicalGroups)
    .where(eq(politicalGroups.slug, slug))
    .limit(1);

  if (!group) notFound();

  // Factions across terms
  const groupFactions = await db
    .select({
      id: factions.id,
      name: factions.name,
      knessetNum: factions.knessetNum,
      seats: factions.seats,
      isCoalition: factions.isCoalition,
      startDate: factions.startDate,
      finishDate: factions.finishDate,
      isCurrent: factions.isCurrent,
      memberCount: sql<number>`(
        CASE WHEN ${factions.isCurrent}
          THEN (select count(*)::int from members where members.faction_id = ${factions.id} and members.is_current = true)
          ELSE (select count(distinct mfh.member_id)::int from member_faction_history mfh where mfh.faction_id = ${factions.id})
        END
      )`,
    })
    .from(factions)
    .where(
      and(
        eq(factions.politicalGroupId, group.id),
        sql`NOT (
          ${factions.finishDate} IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM factions f2
            WHERE f2.political_group_id = ${factions.politicalGroupId}
              AND f2.knesset_num = ${factions.knessetNum}
              AND f2.id != ${factions.id}
              AND f2.start_date > ${factions.startDate}
          )
        )`,
      ),
    )
    .orderBy(desc(factions.knessetNum));

  // Lineage — outgoing (this group → others)
  const lineageFrom = await db
    .select({
      id: politicalGroupLineage.id,
      targetSlug: sql<string>`(select slug from political_groups where id = ${politicalGroupLineage.targetGroupId})`,
      targetName: sql<string>`(select canonical_name from political_groups where id = ${politicalGroupLineage.targetGroupId})`,
      relationshipType: politicalGroupLineage.relationshipType,
      knessetNum: politicalGroupLineage.knessetNum,
      year: politicalGroupLineage.year,
      notes: politicalGroupLineage.notes,
    })
    .from(politicalGroupLineage)
    .where(eq(politicalGroupLineage.sourceGroupId, group.id));

  // Lineage — incoming (others → this group)
  const lineageTo = await db
    .select({
      id: politicalGroupLineage.id,
      sourceSlug: sql<string>`(select slug from political_groups where id = ${politicalGroupLineage.sourceGroupId})`,
      sourceName: sql<string>`(select canonical_name from political_groups where id = ${politicalGroupLineage.sourceGroupId})`,
      relationshipType: politicalGroupLineage.relationshipType,
      knessetNum: politicalGroupLineage.knessetNum,
      year: politicalGroupLineage.year,
      notes: politicalGroupLineage.notes,
    })
    .from(politicalGroupLineage)
    .where(eq(politicalGroupLineage.targetGroupId, group.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6"
        render={<Link href="/politics?tab=groups" />}
      >
        {t('backToList')}
      </Button>

      {/* Group header */}
      <Card className="glass-card mb-8 overflow-hidden">
        <div
          className="h-20"
          style={{
            background: group.color
              ? `linear-gradient(135deg, ${group.color}33, ${group.color}11)`
              : undefined,
          }}
        />
        <CardContent className="-mt-10 px-6 pb-6">
          <div className="flex items-end gap-4">
            <div
              className="bg-card ring-card flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ring-4"
              style={{ color: group.color ?? undefined }}
            >
              <Users className="h-8 w-8" />
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {group.canonicalName}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={group.isActive ? 'default' : 'secondary'}>
                  {group.isActive ? t('active') : t('inactive')}
                </Badge>
                {group.foundedYear && (
                  <Badge variant="outline">
                    {t('foundedYear')}: {group.foundedYear}
                  </Badge>
                )}
                {group.dissolvedYear && (
                  <Badge variant="outline">
                    {t('dissolvedYear')}: {group.dissolvedYear}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lineage card */}
        {(lineageFrom.length > 0 || lineageTo.length > 0) && (
          <Card className="glass-card overflow-hidden lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">{t('lineage')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineageTo.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <Link
                    href={`/political-groups/${l.sourceSlug}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {l.sourceName}
                  </Link>
                  <ArrowRight className="text-muted-foreground h-3 w-3 shrink-0" />
                  <span className="text-muted-foreground">
                    {t(
                      relationshipLabels[l.relationshipType] ??
                        l.relationshipType,
                    )}
                  </span>
                  {l.year && (
                    <Badge variant="outline" className="text-xs">
                      {l.year}
                    </Badge>
                  )}
                </div>
              ))}
              {lineageFrom.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {t(
                      relationshipLabels[l.relationshipType] ??
                        l.relationshipType,
                    )}
                  </span>
                  <ArrowRight className="text-muted-foreground h-3 w-3 shrink-0" />
                  <Link
                    href={`/political-groups/${l.targetSlug}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {l.targetName}
                  </Link>
                  {l.year && (
                    <Badge variant="outline" className="text-xs">
                      {l.year}
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Factions across terms */}
        <Card
          className={`glass-card overflow-hidden ${lineageFrom.length > 0 || lineageTo.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}
        >
          <CardHeader>
            <CardTitle className="text-lg">
              {t('factionsAcrossTerms')} ({groupFactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupFactions.length > 0 ? (
              <div className="space-y-3">
                {groupFactions.map((f) => (
                  <Link key={f.id} href={`/factions/${f.id}`}>
                    <div className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors">
                      <div>
                        <p className="font-medium">
                          <TranslatedText text={f.name} as="span" />
                        </p>
                        {f.knessetNum && (
                          <p className="text-muted-foreground text-xs">
                            {t('knesset', { num: f.knessetNum })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {f.seats && (
                          <Badge variant="outline">
                            {f.seats} {t('seats')}
                          </Badge>
                        )}
                        {f.isCoalition !== null && (
                          <Badge
                            variant={f.isCoalition ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {f.isCoalition ? t('coalition') : t('opposition')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('noGroups')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { sql, eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { factions, politicalGroups } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import KnessetSelect from '@/components/shared/KnessetSelect';

interface Props {
  knessetParam?: string;
}

export default async function FactionsTab({ knessetParam }: Props) {
  const t = await getTranslations('factions');
  const knessetFilter = knessetParam ? Number(knessetParam) : null;

  const knessetNums = await db
    .selectDistinct({ knessetNum: factions.knessetNum })
    .from(factions)
    .where(sql`${factions.knessetNum} IS NOT NULL`)
    .orderBy(desc(factions.knessetNum));
  const availableKnessets = knessetNums
    .map((k) => k.knessetNum)
    .filter((n): n is number => n !== null);

  const activeKnesset = knessetFilter ?? (availableKnessets[0] || 25);

  // Exclude superseded factions: those with a finish_date where another faction
  // in the same knesset with the same political_group_id is still active.
  // Example: "הציונות הדתית" (5 days) was replaced by "הציונות הדתית בראשות בצלאל סמוטריץ'".
  const data = await db
    .select({
      id: factions.id,
      name: factions.name,
      knessetNum: factions.knessetNum,
      isCoalition: factions.isCoalition,
      seats: factions.seats,
      memberCount: sql<number>`(
        CASE WHEN ${factions.isCurrent}
          THEN (select count(*)::int from members where members.faction_id = ${factions.id} and members.is_current = true)
          ELSE (select count(distinct mfh.member_id)::int from member_faction_history mfh where mfh.faction_id = ${factions.id})
        END
      )`,
      politicalGroupSlug: politicalGroups.slug,
      politicalGroupName: politicalGroups.canonicalName,
      politicalGroupColor: politicalGroups.color,
    })
    .from(factions)
    .leftJoin(
      politicalGroups,
      eq(factions.politicalGroupId, politicalGroups.id),
    )
    .where(
      and(
        eq(factions.knessetNum, activeKnesset),
        sql`NOT (
          ${factions.finishDate} IS NOT NULL
          AND ${factions.politicalGroupId} IS NOT NULL
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
    .orderBy(
      desc(factions.seats),
      desc(
        sql`(CASE WHEN ${factions.isCurrent}
          THEN (select count(*) from members where members.faction_id = ${factions.id} and members.is_current = true)
          ELSE (select count(distinct mfh.member_id) from member_faction_history mfh where mfh.faction_id = ${factions.id})
        END)`,
      ),
    );

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <KnessetSelect
          availableKnessets={availableKnessets}
          activeKnesset={activeKnesset}
        />
        <span className="text-muted-foreground text-sm">
          {data.length} {t('allFactions').toLowerCase()}
        </span>
      </div>

      {data.length > 0 ? (
        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((faction) => (
            <Link key={faction.id} href={`/factions/${faction.id}`}>
              <Card
                className={`glass-card hover-lift h-full overflow-hidden border-s-4 ${faction.isCoalition ? 'border-s-blue-500/50' : 'border-s-orange-500/50'}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{faction.name}</CardTitle>
                  {faction.politicalGroupName && (
                    <p className="text-muted-foreground text-xs">
                      {faction.politicalGroupName}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  {faction.memberCount > 0 && (
                    <Badge variant="secondary">
                      {t('memberCount', { count: faction.memberCount })}
                    </Badge>
                  )}
                  {faction.isCoalition !== null && (
                    <Badge
                      variant={faction.isCoalition ? 'default' : 'outline'}
                    >
                      {faction.isCoalition ? t('coalition') : t('opposition')}
                    </Badge>
                  )}
                  {faction.seats && (
                    <Badge variant="outline">
                      {faction.seats} {t('seats')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Building2 className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noFactions')}</p>
        </div>
      )}
    </div>
  );
}

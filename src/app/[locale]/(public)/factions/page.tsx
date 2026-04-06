import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { sql, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { factions, members } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';

interface Props {
  searchParams: Promise<{ knesset?: string }>;
}

export default async function FactionsPage({ searchParams }: Props) {
  const t = await getTranslations('factions');
  const params = await searchParams;
  const knessetFilter = params.knesset ? Number(params.knesset) : null;

  // Get distinct knesset numbers that have factions
  const knessetNums = await db
    .selectDistinct({ knessetNum: factions.knessetNum })
    .from(factions)
    .where(sql`${factions.knessetNum} IS NOT NULL`)
    .orderBy(desc(factions.knessetNum));
  const availableKnessets = knessetNums
    .map((k) => k.knessetNum)
    .filter((n): n is number => n !== null);

  // Default to current (highest) knesset if no filter
  const activeKnesset = knessetFilter ?? (availableKnessets[0] || 25);

  // Fetch factions for the selected knesset with member counts
  const data = await db
    .select({
      id: factions.id,
      name: factions.name,
      knessetNum: factions.knessetNum,
      isCoalition: factions.isCoalition,
      seats: factions.seats,
      memberCount: sql<number>`(
        select count(*)::int from members
        where members.faction_id = ${factions.id}
      )`,
    })
    .from(factions)
    .where(eq(factions.knessetNum, activeKnesset))
    .orderBy(desc(sql`(select count(*) from members where members.faction_id = ${factions.id})`));

  // Only show factions that have at least one member
  const activeFactions = data.filter((f) => f.memberCount > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        </div>
      </div>

      {/* Knesset tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl bg-muted/60 p-1.5 backdrop-blur-sm">
        {availableKnessets.map((num) => (
          <Link
            key={num}
            href={`/factions${num === availableKnessets[0] ? '' : `?knesset=${num}`}`}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              activeKnesset === num
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('knesset', { num })}
          </Link>
        ))}
      </div>

      {activeFactions.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {activeFactions.map((faction) => (
            <Link key={faction.id} href={`/factions/${faction.id}`}>
              <Card className={`glass-card hover-lift h-full overflow-hidden border-s-4 ${faction.isCoalition ? 'border-s-blue-500/50' : 'border-s-orange-500/50'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{faction.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {t('memberCount', { count: faction.memberCount })}
                  </Badge>
                  {faction.isCoalition !== null && (
                    <Badge variant={faction.isCoalition ? 'default' : 'outline'}>
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
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noFactions')}</p>
        </div>
      )}
    </div>
  );
}

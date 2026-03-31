import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { desc, sql, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { parties, members } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function PartiesPage() {
  const t = await getTranslations('parties');

  const data = await db
    .select({
      id: parties.id,
      name: parties.name,
      knessetNum: parties.knessetNum,
      isCoalition: parties.isCoalition,
      seats: parties.seats,
      memberCount: sql<number>`(
        select count(*)::int from members
        where members.party_id = ${parties.id} and members.is_current = true
      )`,
    })
    .from(parties)
    .orderBy(desc(parties.knessetNum), parties.name);

  // Only show parties that have at least one current member
  const activeParties = data.filter((p) => p.memberCount > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        </div>
      </div>

      {activeParties.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeParties.map((party) => (
            <Card key={party.id} className="border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{party.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Badge variant="secondary">
                  {party.memberCount} {t('members')}
                </Badge>
                {party.isCoalition !== null && (
                  <Badge variant={party.isCoalition ? 'default' : 'outline'}>
                    {party.isCoalition ? t('coalition') : t('opposition')}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-2 text-muted-foreground">
          <Building2 className="h-12 w-12 opacity-20" />
          <p className="text-sm">{t('title')}</p>
        </div>
      )}
    </div>
  );
}

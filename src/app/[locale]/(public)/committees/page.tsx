import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { committees } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function CommitteesPage() {
  const t = await getTranslations('committees');

  const data = await db
    .select({
      id: committees.id,
      name: committees.name,
      committeeType: committees.committeeType,
      knessetNum: committees.knessetNum,
      isActive: committees.isActive,
    })
    .from(committees)
    .orderBy(desc(committees.isActive), committees.name);

  const active = data.filter((c) => c.isActive);
  const inactive = data.filter((c) => !c.isActive);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} {t('active')} · {inactive.length} {t('inactive')}
          </p>
        </div>
      </div>

      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{t('active')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {active.map((committee) => (
              <Card key={committee.id} className="glass-card hover-lift overflow-hidden border-s-4 border-s-green-500/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-tight">{committee.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  {committee.committeeType && (
                    <Badge variant="outline">{committee.committeeType}</Badge>
                  )}
                  {committee.knessetNum && (
                    <Badge variant="secondary">{t('knesset')} {committee.knessetNum}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-muted-foreground">{t('inactive')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inactive.map((committee) => (
              <Card key={committee.id} className="glass-card overflow-hidden opacity-60 border-s-4 border-s-muted-foreground/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-tight">{committee.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  {committee.committeeType && (
                    <Badge variant="outline">{committee.committeeType}</Badge>
                  )}
                  {committee.knessetNum && (
                    <Badge variant="secondary">{t('knesset')} {committee.knessetNum}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}

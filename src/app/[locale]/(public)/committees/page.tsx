import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { committees } from '@/lib/db/schema';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.committees');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

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
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Users className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {active.length} {t('active')} · {inactive.length} {t('inactive')}
          </p>
        </div>
      </div>

      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{t('active')}</h2>
          <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((committee) => (
              <Link key={committee.id} href={`/committees/${committee.id}`}>
                <Card className="glass-card hover-lift h-full overflow-hidden border-s-4 border-s-green-500/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-tight">
                      {committee.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    {committee.committeeType && (
                      <Badge variant="outline">{committee.committeeType}</Badge>
                    )}
                    {committee.knessetNum && (
                      <Badge variant="secondary">
                        {t('knesset')} {committee.knessetNum}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <h2 className="text-muted-foreground mb-4 text-lg font-semibold">
            {t('inactive')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inactive.map((committee) => (
              <Link key={committee.id} href={`/committees/${committee.id}`}>
                <Card className="glass-card border-s-muted-foreground/20 h-full overflow-hidden border-s-4 opacity-60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-tight">
                      {committee.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    {committee.committeeType && (
                      <Badge variant="outline">{committee.committeeType}</Badge>
                    )}
                    {committee.knessetNum && (
                      <Badge variant="secondary">
                        {t('knesset')} {committee.knessetNum}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 && (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Users className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}

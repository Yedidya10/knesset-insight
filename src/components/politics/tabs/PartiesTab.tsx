import { getTranslations } from 'next-intl/server';
import { Search } from 'lucide-react';
import { sql, eq, like, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { politicalParties } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';

interface Props {
  searchParam?: string;
  typeParam?: string;
}

export default async function PartiesTab({ searchParam, typeParam }: Props) {
  const t = await getTranslations('registeredParties');
  const searchQuery = searchParam ?? '';
  const typeFilter = typeParam ?? '';

  const conditions = [];
  if (searchQuery) {
    conditions.push(like(politicalParties.name, `%${searchQuery}%`));
  }
  if (typeFilter === 'party' || typeFilter === 'movement') {
    conditions.push(eq(politicalParties.type, typeFilter));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db
    .select({
      id: politicalParties.id,
      name: politicalParties.name,
      registrarNumber: politicalParties.registrarNumber,
      type: politicalParties.type,
      registrationYear: politicalParties.registrationYear,
      isActive: politicalParties.isActive,
      linkedFactionCount: sql<number>`(
        select count(*)::int from party_faction_links
        where party_faction_links.party_id = ${politicalParties.id}
      )`,
    })
    .from(politicalParties)
    .where(where)
    .orderBy(politicalParties.name);

  return (
    <div>
      {/* Search and filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <form className="relative flex-1" action="" method="GET">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            defaultValue={searchQuery}
            placeholder={t('search')}
            className="ps-9"
          />
          {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
          <input type="hidden" name="tab" value="parties" />
        </form>
        <div className="flex gap-1.5 rounded-xl bg-muted/60 p-1.5">
          <Link
            href="/politics?tab=parties"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              !typeFilter ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('filterAll')}
          </Link>
          <Link
            href={`/politics?tab=parties&type=party${searchQuery ? `&search=${searchQuery}` : ''}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === 'party' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('filterParties')}
          </Link>
          <Link
            href={`/politics?tab=parties&type=movement${searchQuery ? `&search=${searchQuery}` : ''}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === 'movement' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('filterMovements')}
          </Link>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {data.map((party) => (
            <Link key={party.id} href={`/parties/${party.id}`}>
              <Card className="glass-card hover-lift h-full overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{party.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Badge variant={party.type === 'party' ? 'default' : 'secondary'}>
                    {party.type === 'party' ? t('typeParty') : t('typeMovement')}
                  </Badge>
                  {party.isActive !== null && (
                    <Badge variant={party.isActive ? 'default' : 'outline'}>
                      {party.isActive ? t('active') : t('inactive')}
                    </Badge>
                  )}
                  {party.registrationYear && (
                    <Badge variant="outline">
                      {t('registrationYear')}: {party.registrationYear}
                    </Badge>
                  )}
                  {party.linkedFactionCount > 0 && (
                    <Badge variant="outline">
                      {party.linkedFactionCount} {t('linkedFactions')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-muted-foreground">{t('noResults')}</p>
      )}
    </div>
  );
}

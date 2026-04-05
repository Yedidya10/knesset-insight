import { getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import {
  electoralLists,
  electoralListParties,
  politicalParties,
  factions,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Building2, Landmark } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ElectionDetailPage({ params }: Props) {
  const t = await getTranslations('elections');
  const tParties = await getTranslations('registeredParties');
  const { id } = await params;
  const listId = Number(id);
  if (isNaN(listId)) notFound();

  const list = await db
    .select()
    .from(electoralLists)
    .where(eq(electoralLists.id, listId))
    .limit(1);

  if (!list[0]) notFound();
  const el = list[0];

  // Fetch component parties
  const componentParties = await db
    .select({
      id: politicalParties.id,
      name: politicalParties.name,
      registrarNumber: politicalParties.registrarNumber,
      type: politicalParties.type,
    })
    .from(electoralListParties)
    .innerJoin(politicalParties, eq(electoralListParties.partyId, politicalParties.id))
    .where(eq(electoralListParties.electoralListId, listId));

  // Fetch resulting factions
  const resultingFactions = await db
    .select({
      id: factions.id,
      name: factions.name,
      knessetNum: factions.knessetNum,
      isCoalition: factions.isCoalition,
      isCurrent: factions.isCurrent,
    })
    .from(factions)
    .where(eq(factions.electoralListId, listId));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/elections"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('title')}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl font-bold text-primary">{el.ballotLetters}</span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{el.name}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('knesset', { num: el.knessetNum })}
          {el.electionDate && ` · ${el.electionDate}`}
        </p>
      </div>

      {/* Vote stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{el.seats}</p>
            <p className="text-xs text-muted-foreground">{t('seats')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{el.totalVotes?.toLocaleString() ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{t('totalVotes')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{el.votePercentage ? `${el.votePercentage}%` : '—'}</p>
            <p className="text-xs text-muted-foreground">{t('percentage')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Badge variant={el.isElected ? 'default' : 'outline'} className="text-sm">
              {el.isElected ? t('elected') : t('notElected')}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Resulting Factions */}
        {resultingFactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t('resultingFaction')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {resultingFactions.map((faction) => (
                  <Link
                    key={faction.id}
                    href={`/factions/${faction.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{faction.name}</span>
                    <div className="flex items-center gap-2">
                      {faction.isCoalition !== null && (
                        <Badge variant={faction.isCoalition ? 'default' : 'outline'}>
                          {faction.isCoalition ? 'Coalition' : 'Opposition'}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Component Parties */}
        {componentParties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                {t('componentParties')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {componentParties.map((party) => (
                  <Link
                    key={party.id}
                    href={`/parties/${party.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{party.name}</span>
                    <Badge variant={party.type === 'party' ? 'default' : 'secondary'}>
                      {party.type === 'party' ? tParties('typeParty') : tParties('typeMovement')}
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

import { getTranslations } from 'next-intl/server';
import { eq, sql, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import {
  politicalParties,
  partyFinancialReports,
  partyFactionLinks,
  factions,
  electoralListParties,
  electoralLists,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from '@/i18n/navigation';
import AppBreadcrumb from '@/components/layout/AppBreadcrumb';
import { Download, Building2, Vote, Phone, Mail, MapPin } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PartyDetailPage({ params }: Props) {
  const t = await getTranslations('registeredParties');
  const tNav = await getTranslations('nav');
  const { id } = await params;
  const partyId = Number(id);
  if (isNaN(partyId)) notFound();

  const party = await db
    .select()
    .from(politicalParties)
    .where(eq(politicalParties.id, partyId))
    .limit(1);

  if (!party[0]) notFound();
  const p = party[0];

  // Fetch financial reports
  const reports = await db
    .select()
    .from(partyFinancialReports)
    .where(eq(partyFinancialReports.partyId, partyId))
    .orderBy(desc(partyFinancialReports.year));

  // Fetch linked factions
  const linkedFactions = await db
    .select({
      id: factions.id,
      name: factions.name,
      knessetNum: factions.knessetNum,
      isCoalition: factions.isCoalition,
      isCurrent: factions.isCurrent,
    })
    .from(partyFactionLinks)
    .innerJoin(factions, eq(partyFactionLinks.factionId, factions.id))
    .where(eq(partyFactionLinks.partyId, partyId));

  // Fetch linked electoral lists
  const linkedLists = await db
    .select({
      id: electoralLists.id,
      name: electoralLists.name,
      ballotLetters: electoralLists.ballotLetters,
      knessetNum: electoralLists.knessetNum,
      seats: electoralLists.seats,
    })
    .from(electoralListParties)
    .innerJoin(
      electoralLists,
      eq(electoralListParties.electoralListId, electoralLists.id),
    )
    .where(eq(electoralListParties.partyId, partyId));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AppBreadcrumb
        items={[
          { label: tNav('home'), href: '/' },
          { label: tNav('politics'), href: '/politics?tab=parties' },
          { label: p.name },
        ]}
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {p.name}
          </h1>
          <Badge variant={p.type === 'party' ? 'default' : 'secondary'}>
            {p.type === 'party' ? t('typeParty') : t('typeMovement')}
          </Badge>
          {p.isActive !== null && (
            <Badge variant={p.isActive ? 'default' : 'outline'}>
              {p.isActive ? t('active') : t('inactive')}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('registrarNumber')}: {p.registrarNumber}
          {p.registrationYear &&
            ` · ${t('registrationYear')}: ${p.registrationYear}`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Goals */}
          {p.goals && (
            <Card>
              <CardHeader>
                <CardTitle>{t('goals')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {p.goals}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Financial Reports */}
          {reports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('financialReports')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reports.map((report) => (
                    <a
                      key={report.id}
                      href={report.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                    >
                      <div>
                        <span className="font-medium">{report.year}</span>
                        <span className="text-muted-foreground ms-2 text-sm">
                          {report.reportType === 'financial'
                            ? t('reportTypeFinancial')
                            : t('reportTypeAssets')}
                        </span>
                      </div>
                      <Download className="text-muted-foreground h-4 w-4" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Linked Factions */}
          {linkedFactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {t('linkedFactions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {linkedFactions.map((faction) => (
                    <Link
                      key={faction.id}
                      href={`/factions/${faction.id}`}
                      className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                    >
                      <span className="font-medium">{faction.name}</span>
                      <div className="flex items-center gap-2">
                        {faction.knessetNum && (
                          <Badge variant="outline">
                            {t('registrationYear').split(' ')[0]}{' '}
                            {faction.knessetNum}
                          </Badge>
                        )}
                        {faction.isCurrent && <Badge>Active</Badge>}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Linked Electoral Lists */}
          {linkedLists.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Vote className="h-5 w-5" />
                  {t('linkedLists')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {linkedLists.map((list) => (
                    <Link
                      key={list.id}
                      href={`/elections/${list.id}`}
                      className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                    >
                      <div>
                        <span className="font-medium">{list.name}</span>
                        <span className="text-muted-foreground ms-2 text-sm">
                          ({list.ballotLetters})
                        </span>
                      </div>
                      {list.seats > 0 && (
                        <Badge variant="secondary">{list.seats} seats</Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: Contact */}
        <div className="space-y-6">
          {(p.phone || p.fax || p.email || p.address) && (
            <Card>
              <CardHeader>
                <CardTitle>{t('contact')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="text-muted-foreground h-4 w-4" />
                    <a href={`tel:${p.phone}`} className="hover:underline">
                      {p.phone}
                    </a>
                  </div>
                )}
                {p.fax && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="text-muted-foreground h-4 w-4" />
                    <span>
                      {t('fax')}: {p.fax}
                    </span>
                  </div>
                )}
                {p.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="text-muted-foreground h-4 w-4" />
                    <a href={`mailto:${p.email}`} className="hover:underline">
                      {p.email}
                    </a>
                  </div>
                )}
                {p.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <span>{p.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

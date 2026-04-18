import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Building2 } from 'lucide-react';
import { eq, sql, inArray, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { factions, members, politicalGroups } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TranslatedText from '@/components/ui/translated-text';
import MemberAvatar from '@/components/members/MemberAvatar';
import FactionPolicyStances from '@/components/policies/FactionPolicyStances';

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function FactionDetailPage({ params }: Props) {
  const { id, locale } = await params;
  const t = await getTranslations('factions');
  const tCommon = await getTranslations('common');

  const factionId = Number(id);
  if (isNaN(factionId)) notFound();

  const [faction] = await db
    .select()
    .from(factions)
    .where(eq(factions.id, factionId))
    .limit(1);

  if (!faction) notFound();

  // If this faction was superseded (has finishDate + same-pgId successor in same knesset),
  // redirect to the active successor.
  if (faction.finishDate && faction.politicalGroupId) {
    const [successor] = await db
      .select({ id: factions.id })
      .from(factions)
      .where(
        and(
          eq(factions.politicalGroupId, faction.politicalGroupId),
          eq(factions.knessetNum!, faction.knessetNum!),
          sql`${factions.id} != ${faction.id}`,
          sql`${factions.finishDate} IS NULL`,
        ),
      )
      .limit(1);

    if (successor) {
      redirect(`/${locale}/factions/${successor.id}`);
    }
  }

  // Get political group info if linked
  const politicalGroup = faction.politicalGroupId
    ? ((
        await db
          .select({
            slug: politicalGroups.slug,
            canonicalName: politicalGroups.canonicalName,
            color: politicalGroups.color,
          })
          .from(politicalGroups)
          .where(eq(politicalGroups.id, faction.politicalGroupId))
          .limit(1)
      )[0] ?? null)
    : null;

  // Find related faction rows WITHIN THE SAME KNESSET only (superseded factions).
  // Don't aggregate across knessets — each knesset's faction stands on its own.
  const siblingFactions = faction.politicalGroupId
    ? await db
        .select({ id: factions.id })
        .from(factions)
        .where(
          and(
            eq(factions.politicalGroupId, faction.politicalGroupId),
            eq(factions.knessetNum!, faction.knessetNum!),
          ),
        )
    : [{ id: faction.id }];
  const allFactionIds = siblingFactions.map((f) => f.id);

  // For historical factions (finished), isCurrent is always false.
  // Only split active/past for current-knesset factions.
  const isHistorical = !!faction.finishDate;

  const allMembers = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      isCoalition: members.isCoalition,
      isCurrent: members.isCurrent,
    })
    .from(members)
    .where(inArray(members.factionId, allFactionIds))
    .orderBy(members.lastName);

  const currentMembers = isHistorical
    ? allMembers
    : allMembers.filter((m) => m.isCurrent);
  const pastMembers = isHistorical
    ? []
    : allMembers.filter((m) => !m.isCurrent);

  const renderMemberGrid = (
    memberList: {
      id: number;
      firstName: string;
      lastName: string;
      imageUrl: string | null;
    }[],
  ) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {memberList.map((m) => (
        <Link key={m.id} href={`/members/${m.id}`}>
          <div className="hover:bg-muted/50 flex flex-col items-center gap-2 rounded-xl p-3 transition-all hover:shadow-sm">
            <MemberAvatar member={m} size="md" ring="ring-2 ring-border/40" />
            <span className="text-center text-sm leading-tight font-medium">
              {m.firstName} {m.lastName}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6"
        render={<Link href="/politics" />}
      >
        {tCommon('back')}
      </Button>

      {/* Faction header */}
      <Card className="glass-card mb-8 overflow-hidden">
        <div className="from-primary/20 via-chart-2/10 to-chart-4/10 h-20 bg-gradient-to-br" />
        <CardContent className="-mt-10 px-6 pb-6">
          <div className="flex items-end gap-4">
            <div className="bg-card ring-card flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ring-4">
              <Building2 className="text-primary h-8 w-8" />
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                <TranslatedText text={faction.name} as="span" />
              </h1>
              {politicalGroup && (
                <Link
                  href={`/political-groups/${politicalGroup.slug}`}
                  className="text-muted-foreground hover:text-foreground mt-0.5 text-sm transition-colors"
                >
                  {politicalGroup.canonicalName} →
                </Link>
              )}
              <div className="mt-1 flex items-center gap-2">
                {faction.knessetNum && (
                  <Badge variant="outline">
                    {t('knesset', { num: faction.knessetNum })}
                  </Badge>
                )}
                {faction.isCoalition !== null && (
                  <Badge
                    variant={faction.isCoalition ? 'default' : 'secondary'}
                  >
                    {faction.isCoalition ? t('coalition') : t('opposition')}
                  </Badge>
                )}
                {faction.seats && (
                  <Badge variant="outline">
                    {faction.seats} {t('seats')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Policy stances card */}
        <FactionPolicyStances factionIds={allFactionIds} />

        {/* Members section */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Current members (or all members for historical factions) */}
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">
                {isHistorical ? t('members') : t('currentMembers')} (
                {currentMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentMembers.length > 0 ? (
                renderMemberGrid(currentMembers)
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('noMembers')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Past members */}
          {pastMembers.length > 0 && (
            <Card className="glass-card overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('pastMembers')} ({pastMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>{renderMemberGrid(pastMembers)}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

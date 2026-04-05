import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Building2 } from 'lucide-react';
import { eq, sql, desc, inArray, and, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { factions, members, memberVotes } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import TranslatedText from '@/components/ui/translated-text';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FactionDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('factions');
  const tCommon = await getTranslations('common');
  const tVotes = await getTranslations('votes');

  const factionId = Number(id);
  if (isNaN(factionId)) notFound();

  const [faction] = await db
    .select()
    .from(factions)
    .where(eq(factions.id, factionId))
    .limit(1);

  if (!faction) notFound();

  // Find ALL faction rows with the same name (same faction across knessets)
  const siblingFactions = await db
    .select({ id: factions.id })
    .from(factions)
    .where(eq(factions.name, faction.name));
  const allFactionIds = siblingFactions.map((f) => f.id);

  // Current members across all faction IDs with this name
  const currentMembers = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      isCoalition: members.isCoalition,
    })
    .from(members)
    .where(
      and(
        inArray(members.factionId, allFactionIds),
        eq(members.isCurrent, true),
      ),
    )
    .orderBy(members.lastName);

  // Past members across all faction IDs with this name
  const pastMembers = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
    })
    .from(members)
    .where(
      and(
        inArray(members.factionId, allFactionIds),
        or(eq(members.isCurrent, false), sql`${members.isCurrent} IS NULL`),
      ),
    )
    .orderBy(members.lastName);

  // Aggregate vote stats for this faction's current members
  const voteStats = await db
    .select({
      value: memberVotes.voteValue,
      count: sql<number>`count(*)::int`,
    })
    .from(memberVotes)
    .innerJoin(members, eq(memberVotes.memberId, members.id))
    .where(
      and(
        inArray(members.factionId, allFactionIds),
        eq(members.isCurrent, true),
      ),
    )
    .groupBy(memberVotes.voteValue);

  const stats = { for: 0, against: 0, abstain: 0, absent: 0 };
  for (const s of voteStats) {
    if (s.value in stats) stats[s.value as keyof typeof stats] = s.count;
  }
  const totalVotes = stats.for + stats.against + stats.abstain + stats.absent;

  const renderMemberGrid = (
    memberList: { id: number; firstName: string; lastName: string; imageUrl: string | null }[],
  ) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {memberList.map((m) => (
        <Link key={m.id} href={`/members/${m.id}`}>
          <div className="flex flex-col items-center gap-2 rounded-xl p-3 transition-all hover:bg-muted/50 hover:shadow-sm">
            <Avatar className="h-14 w-14 ring-2 ring-border/40">
              {m.imageUrl && (
                <AvatarImage
                  src={m.imageUrl}
                  alt={`${m.firstName} ${m.lastName}`}
                />
              )}
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {m.firstName?.[0]}
                {m.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-center text-sm font-medium leading-tight">
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
        render={<Link href="/factions" />}
      >
        {tCommon('back')}
      </Button>

      {/* Faction header */}
      <Card className="glass-card mb-8 overflow-hidden">
        <div className="h-20 bg-gradient-to-br from-primary/20 via-chart-2/10 to-chart-4/10" />
        <CardContent className="-mt-10 px-6 pb-6">
          <div className="flex items-end gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card ring-4 ring-card shadow-lg">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                <TranslatedText text={faction.name} as="span" />
              </h1>
              <div className="mt-1 flex items-center gap-2">
                {faction.knessetNum && (
                  <Badge variant="outline">
                    {t('knesset', { num: faction.knessetNum })}
                  </Badge>
                )}
                {faction.isCoalition !== null && (
                  <Badge variant={faction.isCoalition ? 'default' : 'secondary'}>
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
        {/* Vote stats card */}
        <Card className="glass-card overflow-hidden lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">{t('voteStats')}</CardTitle>
          </CardHeader>
          <CardContent>
            {totalVotes > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-green-50 p-3 dark:bg-green-950/30">
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">
                      {stats.for}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tVotes('for')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
                    <p className="text-xl font-bold text-red-700 dark:text-red-300">
                      {stats.against}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tVotes('against')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-yellow-50 p-3 dark:bg-yellow-950/30">
                    <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                      {stats.abstain}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tVotes('abstain')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xl font-bold">{stats.absent}</p>
                    <p className="text-xs text-muted-foreground">
                      {tVotes('absent')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tCommon('loading')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Members section */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Current members */}
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">
                {t('currentMembers')} ({currentMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentMembers.length > 0 ? (
                renderMemberGrid(currentMembers)
              ) : (
                <p className="text-sm text-muted-foreground">
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

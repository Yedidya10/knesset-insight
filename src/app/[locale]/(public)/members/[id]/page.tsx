import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { User, Building2, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, parties, memberVotes, votes } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MemberProfilePage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('members.profile');
  const tCommon = await getTranslations('common');
  const tVotes = await getTranslations('votes');

  const memberId = Number(id);
  if (isNaN(memberId)) notFound();

  const [member] = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      email: members.email,
      phone: members.phone,
      gender: members.gender,
      isCurrent: members.isCurrent,
      isCoalition: members.isCoalition,
      partyName: parties.name,
      partyId: parties.id,
    })
    .from(members)
    .leftJoin(parties, eq(members.partyId, parties.id))
    .where(eq(members.id, memberId))
    .limit(1);

  if (!member) notFound();

  // Recent votes by this member
  const recentVotes = await db
    .select({
      voteId: votes.id,
      voteTitle: votes.title,
      voteDate: votes.voteDate,
      voteValue: memberVotes.voteValue,
      isAccepted: votes.isAccepted,
    })
    .from(memberVotes)
    .innerJoin(votes, eq(memberVotes.voteId, votes.id))
    .where(eq(memberVotes.memberId, member.id))
    .orderBy(desc(votes.voteDate))
    .limit(20);

  // Vote stats
  const voteStats = await db
    .select({
      value: memberVotes.voteValue,
      count: sql<number>`count(*)::int`,
    })
    .from(memberVotes)
    .where(eq(memberVotes.memberId, member.id))
    .groupBy(memberVotes.voteValue);

  const stats = { for: 0, against: 0, abstain: 0, absent: 0 };
  for (const s of voteStats) {
    if (s.value in stats) stats[s.value as keyof typeof stats] = s.count;
  }

  const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6" render={<Link href="/members" />}>
        {tCommon('back')}
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="border-border/60 shadow-sm lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <Avatar className="h-28 w-28 border-2 border-border/60">
              {member.imageUrl && (
                <AvatarImage src={member.imageUrl} alt={`${member.firstName} ${member.lastName}`} />
              )}
              <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="text-center">
              <h1 className="text-xl font-bold">
                {member.firstName} {member.lastName}
              </h1>
              {member.partyName && (
                <Link
                  href={`/members?party=${member.partyId}`}
                  className="text-sm text-primary hover:underline"
                >
                  {member.partyName}
                </Link>
              )}
            </div>

            {member.isCoalition !== null && (
              <Badge variant={member.isCoalition ? 'default' : 'secondary'}>
                {member.isCoalition ? t('coalitionMember') : t('oppositionMember')}
              </Badge>
            )}

            <Separator />

            <div className="w-full space-y-3 text-sm">
              {member.partyName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{t('party')}: {member.partyName}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Vote summary */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">{t('voteHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-4 gap-3 text-center">
                <div className="rounded-lg bg-green-50 p-2 dark:bg-green-950/30">
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">{stats.for}</p>
                  <p className="text-xs text-muted-foreground">{tVotes('for')}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/30">
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">{stats.against}</p>
                  <p className="text-xs text-muted-foreground">{tVotes('against')}</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-2 dark:bg-yellow-950/30">
                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{stats.abstain}</p>
                  <p className="text-xs text-muted-foreground">{tVotes('abstain')}</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-lg font-bold">{stats.absent}</p>
                  <p className="text-xs text-muted-foreground">{tVotes('absent')}</p>
                </div>
              </div>

              {recentVotes.length > 0 ? (
                <div className="space-y-2">
                  {recentVotes.map((v) => (
                    <Link key={v.voteId} href={`/votes/${v.voteId}`} className="block">
                      <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
                        {v.voteValue === 'for' && <ThumbsUp className="h-4 w-4 shrink-0 text-green-600" />}
                        {v.voteValue === 'against' && <ThumbsDown className="h-4 w-4 shrink-0 text-red-600" />}
                        {v.voteValue === 'abstain' && <Minus className="h-4 w-4 shrink-0 text-yellow-600" />}
                        {v.voteValue === 'absent' && <User className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{v.voteTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.voteDate ? new Date(v.voteDate).toLocaleDateString('he-IL') : ''}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

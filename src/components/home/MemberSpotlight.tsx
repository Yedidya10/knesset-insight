import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { sql, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, factions, memberVotes } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AnimatedSection from '@/components/ui/animated-section';
import MemberAvatar from '@/components/members/MemberAvatar';

export default async function MemberSpotlight() {
  const t = await getTranslations('home.memberSpotlight');

  let topMembers: {
    id: number;
    firstName: string;
    lastName: string;
    imageUrl: string | null;
    factionName: string | null;
    factionColor: string | null;
    recentVoteCount: number;
  }[] = [];

  try {
    topMembers = await db
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        imageUrl: members.imageUrl,
        factionName: factions.name,
        factionColor: factions.color,
        recentVoteCount: sql<number>`count(${memberVotes.id})::int`.as(
          'recent_vote_count',
        ),
      })
      .from(members)
      .leftJoin(factions, eq(members.factionId, factions.id))
      .leftJoin(
        memberVotes,
        sql`${memberVotes.memberId} = ${members.id} AND ${memberVotes.voteValue} != 'absent'`,
      )
      .where(eq(members.isCurrent, true))
      .groupBy(
        members.id,
        members.firstName,
        members.lastName,
        members.imageUrl,
        factions.name,
        factions.color,
      )
      .orderBy(desc(sql`recent_vote_count`))
      .limit(6);
  } catch (e) {
    console.error('Failed to fetch member spotlight:', e);
  }

  if (topMembers.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <AnimatedSection>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-chart-1/10 ring-chart-1/20 flex h-10 w-10 items-center justify-center rounded-xl ring-1">
              <Users className="text-chart-1 h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {t('title')}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            render={<Link href="/members" />}
          >
            {t('viewAll')}
            <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </AnimatedSection>

      <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {topMembers.map((member) => (
          <AnimatedSection key={member.id}>
            <Link href={`/members/${member.id}`}>
              <Card className="group glass-card hover-lift h-full overflow-hidden">
                <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                  <MemberAvatar
                    member={{
                      imageUrl: member.imageUrl,
                      firstName: member.firstName,
                      lastName: member.lastName,
                    }}
                    size="md"
                    className="ring-border/50 rounded-full ring-2 transition-transform group-hover:scale-105"
                  />
                  <p className="text-sm leading-tight font-semibold">
                    {member.firstName} {member.lastName}
                  </p>
                  {member.factionName && (
                    <Badge
                      variant="secondary"
                      className="text-[10px]"
                      style={
                        member.factionColor
                          ? {
                              backgroundColor: `${member.factionColor}15`,
                              color: member.factionColor,
                            }
                          : undefined
                      }
                    >
                      {member.factionName}
                    </Badge>
                  )}
                  <p className="text-muted-foreground text-[10px]">
                    {member.recentVoteCount} {t('recentVotes')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </AnimatedSection>
        ))}
      </div>
    </section>
  );
}

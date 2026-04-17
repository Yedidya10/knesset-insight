import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  Vote,
  Gavel,
  Building2,
  Landmark,
  FileText,
  Shield,
} from 'lucide-react';
import { sql, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { votes, bills, committees, factions } from '@/lib/db/schema';
import { cached } from '@/lib/cache';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedSection from '@/components/ui/animated-section';
import CountUp from '@/components/ui/count-up';

export default async function StatsBar() {
  const t = await getTranslations('home.stats');

  let stats = {
    votes: 0,
    bills: 0,
    committees: 0,
    factions: 0,
    sessions: 0,
    integrity: 0,
  };

  try {
    stats = await cached('home:statsBar', 300, async () => {
      const [
        [{ count: voteCount }],
        [{ count: billCount }],
        [{ count: committeeCount }],
        [{ count: factionCount }],
        [{ count: sessionCount }],
        [{ count: integrityCount }],
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(votes),
        db.select({ count: sql<number>`count(*)::int` }).from(bills),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(committees)
          .where(eq(committees.isActive, true)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(factions)
          .where(eq(factions.isCurrent, true)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(sql`committee_sessions`),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(sql`integrity_cases`),
      ]);
      return {
        votes: voteCount,
        bills: billCount,
        committees: committeeCount,
        factions: factionCount,
        sessions: sessionCount,
        integrity: integrityCount,
      };
    });
  } catch (e) {
    console.error('Failed to fetch stats:', e);
  }

  const items = [
    {
      label: t('totalVotes'),
      count: stats.votes,
      icon: Vote,
      color: 'text-chart-1',
      bg: 'bg-chart-1/10',
      href: '/legislation',
    },
    {
      label: t('billsProposed'),
      count: stats.bills,
      icon: Gavel,
      color: 'text-chart-2',
      bg: 'bg-chart-2/10',
      href: '/legislation',
    },
    {
      label: t('activeCommittees'),
      count: stats.committees,
      icon: Landmark,
      color: 'text-chart-3',
      bg: 'bg-chart-3/10',
      href: '/committees',
    },
    {
      label: t('activeFactions'),
      count: stats.factions,
      icon: Building2,
      color: 'text-chart-4',
      bg: 'bg-chart-4/10',
      href: '/factions',
    },
    {
      label: t('committeeSessions'),
      count: stats.sessions,
      icon: FileText,
      color: 'text-chart-5',
      bg: 'bg-chart-5/10',
      href: '/committees',
    },
    {
      label: t('integrityCases'),
      count: stats.integrity,
      icon: Shield,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      href: '/members',
    },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(({ label, count, icon: Icon, color, bg, href }) => (
          <AnimatedSection key={label}>
            <Link href={href}>
              <Card className="group glass-card hover-lift overflow-hidden">
                <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} transition-transform group-hover:scale-110`}
                  >
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    <CountUp end={count} />
                  </p>
                  <p className="text-muted-foreground text-xs leading-tight">
                    {label}
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

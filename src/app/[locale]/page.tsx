import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Vote, FileText, Users, Building2, Landmark, Scale, Gavel } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, votes, parties } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');

  const [[membersCount], [votesCount], [partiesCount]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(members).where(sql`${members.isCurrent} = true`),
    db.select({ count: sql<number>`count(*)::int` }).from(votes),
    db.select({ count: sql<number>`count(*)::int` }).from(parties)
      .where(sql`${parties.id} in (select party_id from members where is_current = true and party_id is not null)`),
  ]);

  const quickLinks = [
    { key: 'members' as const, href: '/members', icon: Users, color: 'text-chart-1' },
    { key: 'votes' as const, href: '/votes', icon: Vote, color: 'text-chart-2' },
    { key: 'legislation' as const, href: '/legislation', icon: Gavel, color: 'text-chart-3' },
    { key: 'parties' as const, href: '/parties', icon: Building2, color: 'text-chart-4' },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Landmark className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              {t('subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" render={<Link href="/members" />}>
                {tNav('members')}
              </Button>
              <Button variant="outline" size="lg" render={<Link href="/votes" />}>
                {tNav('votes')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-chart-1/10">
                <Users className="h-6 w-6 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('stats.activeMembers')}</p>
                <p className="text-2xl font-bold">{membersCount.count}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-chart-2/10">
                <Vote className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('stats.totalVotes')}</p>
                <p className="text-2xl font-bold">{votesCount.count}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-chart-3/10">
                <Building2 className="h-6 w-6 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('stats.activeParties')}</p>
                <p className="text-2xl font-bold">{partiesCount.count}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick links */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {quickLinks.map(({ key, href, icon: Icon, color }) => (
            <Link key={key} href={href}>
              <Card className="group h-full border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent transition-colors group-hover:bg-primary/10">
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                  <span className="text-sm font-medium">{tNav(key)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

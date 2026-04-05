import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Vote, Users, Building2, Landmark, Gavel, ArrowRight } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, votes, factions } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AnimatedSection from '@/components/ui/animated-section';
import CountUp from '@/components/ui/count-up';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');

  const [[membersCount], [votesCount], [factionsCount]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(members).where(sql`${members.isCurrent} = true`),
    db.select({ count: sql<number>`count(*)::int` }).from(votes),
    db.select({ count: sql<number>`count(*)::int` }).from(factions)
      .where(sql`${factions.id} in (select faction_id from members where is_current = true and faction_id is not null)`),
  ]);

  const quickLinks = [
    { key: 'members' as const, href: '/members', icon: Users, color: 'text-chart-1', bg: 'bg-chart-1/10', desc: 'quickLinks.membersDesc' as const },
    { key: 'votes' as const, href: '/votes', icon: Vote, color: 'text-chart-2', bg: 'bg-chart-2/10', desc: 'quickLinks.votesDesc' as const },
    { key: 'legislation' as const, href: '/legislation', icon: Gavel, color: 'text-chart-3', bg: 'bg-chart-3/10', desc: 'quickLinks.legislationDesc' as const },
    { key: 'factions' as const, href: '/factions', icon: Building2, color: 'text-chart-4', bg: 'bg-chart-4/10', desc: 'quickLinks.factionsDesc' as const },
  ];

  const stats = [
    { label: t('stats.activeMembers'), count: membersCount.count, icon: Users, color: 'text-chart-1', bg: 'bg-chart-1/10' },
    { label: t('stats.totalVotes'), count: votesCount.count, icon: Vote, color: 'text-chart-2', bg: 'bg-chart-2/10' },
    { label: t('stats.activeFactions'), count: factionsCount.count, icon: Building2, color: 'text-chart-3', bg: 'bg-chart-3/10' },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/20">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-chart-2/5 to-chart-4/5 animate-mesh" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/12 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-chart-2/8 via-transparent to-transparent" />

        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="flex flex-col items-center text-center">
            <AnimatedSection>
              <div className="mb-8 flex h-18 w-18 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 glow-primary">
                <Landmark className="h-9 w-9 text-primary" />
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                {t('title')}
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                {t('subtitle')}
              </p>
            </AnimatedSection>

            <AnimatedSection delay={0.3}>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Button
                  size="lg"
                  className="rounded-xl px-8 shadow-md hover:shadow-lg transition-shadow"
                  render={<Link href="/members" />}
                >
                  {tNav('members')}
                  <ArrowRight className="ms-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl px-8"
                  render={<Link href="/votes" />}
                >
                  {tNav('votes')}
                </Button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 stagger-children">
          {stats.map(({ label, count, icon: Icon, color, bg }) => (
            <Card key={label} className="group glass-card hover-lift overflow-hidden">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${bg} transition-transform group-hover:scale-110`}>
                  <Icon className={`h-7 w-7 ${color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-3xl font-bold tracking-tight">
                    <CountUp end={count} />
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
          {quickLinks.map(({ key, href, icon: Icon, color, bg, desc }) => (
            <Link key={key} href={href}>
              <Card className="group h-full glass-card hover-lift overflow-hidden">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${bg} transition-all group-hover:scale-110 group-hover:shadow-md`}>
                    <Icon className={`h-7 w-7 ${color}`} />
                  </div>
                  <div>
                    <span className="text-base font-semibold">{tNav(key)}</span>
                    <p className="mt-1 text-sm text-muted-foreground">{t(desc)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

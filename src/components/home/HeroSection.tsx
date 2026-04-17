import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';
import { sql, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  members,
  factions,
  votes,
  bills,
  electionCampaigns,
} from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import AnimatedSection from '@/components/ui/animated-section';
import KnessetHemicycle, {
  type SeatData,
} from '@/components/home/KnessetHemicycle';
import FloatingDataCards from '@/components/home/FloatingDataCards';

export default async function HeroSection() {
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');

  // Fetch all data in parallel
  let seatData: SeatData[] = [];
  let latestVote: {
    title: string;
    isAccepted: boolean | null;
    forCount: number;
    againstCount: number;
  } | null = null;
  let activeBillsCount = 0;
  let electionDaysLeft: number | null = null;
  let factionStats = { total: 0, coalitionSeats: 0, oppositionSeats: 0 };

  try {
    const [
      currentMembers,
      currentFactions,
      [latestVoteRow] = [null],
      [{ count: billCount }],
      campaign,
    ] = await Promise.all([
      // Members with faction info
      db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          factionId: members.factionId,
        })
        .from(members)
        .where(eq(members.isCurrent, true)),
      // Current factions
      db
        .select({
          id: factions.id,
          name: factions.name,
          color: factions.color,
          seats: factions.seats,
          isCoalition: factions.isCoalition,
        })
        .from(factions)
        .where(eq(factions.isCurrent, true)),
      // Latest vote
      db
        .select({
          title: votes.title,
          isAccepted: votes.isAccepted,
          forCount: votes.forCount,
          againstCount: votes.againstCount,
        })
        .from(votes)
        .orderBy(desc(votes.voteDate))
        .limit(1),
      // Active bills count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(bills)
        .where(
          sql`${bills.status} IS NOT NULL AND ${bills.status} NOT IN ('stopped', 'merged', 'removed')`,
        ),
      // Election campaign
      db
        .select({ electionDate: electionCampaigns.electionDate })
        .from(electionCampaigns)
        .where(eq(electionCampaigns.knessetNum, 26))
        .limit(1),
    ]);

    // Build faction lookup
    const factionMap = new Map(currentFactions.map((f) => [f.id, f]));

    // Build seat data
    seatData = currentMembers
      .filter((m) => m.factionId && factionMap.has(m.factionId))
      .map((m) => {
        const f = factionMap.get(m.factionId!)!;
        return {
          memberId: m.id,
          name: `${m.firstName} ${m.lastName}`,
          factionName: f.name,
          factionColor: f.color || '#6b7280',
          isCoalition: f.isCoalition ?? false,
        };
      });

    // Latest vote
    if (latestVoteRow) {
      latestVote = {
        title: latestVoteRow.title,
        isAccepted: latestVoteRow.isAccepted,
        forCount: latestVoteRow.forCount ?? 0,
        againstCount: latestVoteRow.againstCount ?? 0,
      };
    }

    activeBillsCount = billCount;

    // Faction stats
    const coalitionSeats = currentFactions
      .filter((f) => f.isCoalition)
      .reduce((sum, f) => sum + (f.seats ?? 0), 0);
    const oppositionSeats = currentFactions
      .filter((f) => !f.isCoalition)
      .reduce((sum, f) => sum + (f.seats ?? 0), 0);
    factionStats = {
      total: currentFactions.length,
      coalitionSeats,
      oppositionSeats,
    };

    // Election countdown
    if (campaign?.[0]?.electionDate) {
      const electionDate = new Date(campaign[0].electionDate);
      const now = new Date();
      const diff = electionDate.getTime() - now.getTime();
      if (diff > 0) {
        electionDaysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }
    }
  } catch (e) {
    console.error('Failed to fetch hero data:', e);
  }

  return (
    <section className="border-border/20 relative overflow-hidden border-b">
      {/* Animated mesh gradient background */}
      <div className="from-primary/8 via-chart-2/5 to-chart-4/5 animate-mesh absolute inset-0 bg-linear-to-br" />
      <div className="from-primary/12 absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--tw-gradient-stops))] via-transparent to-transparent" />
      <div className="from-chart-2/8 absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,var(--tw-gradient-stops))] via-transparent to-transparent" />

      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-0 sm:px-6 sm:pt-12 lg:pt-16">
        {/* Hemicycle + Floating Cards wrapper */}
        <div className="relative">
          {seatData.length > 0 && (
            <AnimatedSection>
              <KnessetHemicycle
                seats={seatData}
                coalitionLabel={t('coalition')}
                oppositionLabel={t('opposition')}
              />
            </AnimatedSection>
          )}
          <FloatingDataCards
            latestVote={latestVote}
            activeBillsCount={activeBillsCount}
            electionDaysLeft={electionDaysLeft}
            factionStats={factionStats}
          />
        </div>

        {/* Title + CTAs */}
        <div className="flex flex-col items-center pb-10 text-center">
          <AnimatedSection delay={0.8}>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              {t('title')}
            </h1>
          </AnimatedSection>

          <AnimatedSection delay={0.9}>
            <p className="text-muted-foreground mt-3 max-w-2xl text-lg sm:text-xl">
              {t('subtitle')}
            </p>
          </AnimatedSection>

          <AnimatedSection delay={1.0}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                className="rounded-xl px-8 shadow-md transition-shadow hover:shadow-lg"
                render={<Link href="/members" />}
              >
                {tNav('members')}
                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-xl px-8"
                render={<Link href="/legislation" />}
              >
                {tNav('legislation')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-xl px-8"
                render={<Link href="/elections2026" />}
              >
                {tNav('elections')}
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

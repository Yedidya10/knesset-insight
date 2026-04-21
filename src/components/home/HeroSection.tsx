import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, factions } from '@/lib/db/schema';
import { cached } from '@/lib/cache';
import { Button } from '@/components/ui/button';
import AnimatedSection from '@/components/ui/animated-section';
import KnessetHemicycle, {
  type SeatData,
} from '@/components/home/KnessetHemicycle';

const CACHE_KEY = 'home:hero:seatData';
const CACHE_TTL = 300; // 5 minutes

async function getSeatData(): Promise<SeatData[]> {
  return cached(CACHE_KEY, CACHE_TTL, async () => {
    const [currentMembers, currentFactions] = await Promise.all([
      db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          factionId: members.factionId,
        })
        .from(members)
        .where(eq(members.isCurrent, true)),
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
    ]);

    const factionMap = new Map(currentFactions.map((f) => [f.id, f]));

    return currentMembers
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
  });
}

export default async function HeroSection() {
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');

  let seatData: SeatData[] = [];

  try {
    seatData = await getSeatData();
  } catch (e) {
    console.error('Failed to fetch hero data:', e);
  }

  return (
    <section className="border-border/20 relative flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden border-b">
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

      <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        {/* Hemicycle */}
        {seatData.length > 0 && (
          <AnimatedSection>
            <KnessetHemicycle
              seats={seatData}
              coalitionLabel={t('coalition')}
              oppositionLabel={t('opposition')}
            />
          </AnimatedSection>
        )}

        {/* Title + CTAs */}
        <div className="flex flex-col items-center text-center">
          <AnimatedSection delay={0.8}>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
              {t('title')}
            </h1>
          </AnimatedSection>

          <AnimatedSection delay={0.9}>
            <p className="text-muted-foreground mt-2 max-w-2xl text-base sm:mt-3 sm:text-lg xl:text-xl">
              {t('subtitle')}
            </p>
          </AnimatedSection>

          <AnimatedSection delay={1.0}>
            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:mt-6 lg:mt-8">
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

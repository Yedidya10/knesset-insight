import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  Users,
  ScrollText,
  Building2,
  Flag,
  Landmark,
  Network,
  Wallet,
  BarChart3,
  Scale,
  Map,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedSection from '@/components/ui/animated-section';

const sections = [
  { key: 'members', href: '/members', icon: Users },
  { key: 'legislation', href: '/legislation', icon: ScrollText },
  { key: 'committees', href: '/committees', icon: Building2 },
  { key: 'factions', href: '/factions', icon: Flag },
  { key: 'governments', href: '/governments', icon: Landmark },
  { key: 'politicalGroups', href: '/political-groups', icon: Network },
  { key: 'budget', href: '/budget', icon: Wallet },
  { key: 'elections2026', href: '/elections', icon: BarChart3 },
  { key: 'policies', href: '/policies', icon: Scale },
  { key: 'electionMap', href: '/election-map', icon: Map },
] as const;

export default async function ExploreGrid() {
  const t = await getTranslations('home.explore');

  return (
    <section className="bg-muted/30 w-full py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <AnimatedSection>
          <h2 className="mb-6 text-xl font-bold tracking-tight sm:text-2xl">
            {t('title')}
          </h2>
        </AnimatedSection>

        <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sections.map(({ key, href, icon: Icon }, i) => (
            <AnimatedSection key={key} delay={i * 0.03}>
              <Link href={href} className="group block h-full">
                <Card className="hover:border-primary/30 h-full transition-colors">
                  <CardContent className="flex flex-col items-start gap-2 p-4">
                    <Icon className="text-primary h-5 w-5 transition-transform group-hover:scale-110" />
                    <div>
                      <p className="text-sm font-semibold">{t(key)}</p>
                      <p className="text-muted-foreground text-xs leading-snug">
                        {t(`${key}Desc` as `${typeof key}Desc`)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import HeroSection from '@/components/home/HeroSection';
import StatsBar from '@/components/home/StatsBar';
import LatestVotes from '@/components/home/LatestVotes';
import ActiveLegislation from '@/components/home/ActiveLegislation';
import ElectionSpotlight from '@/components/home/ElectionSpotlight';
import MemberSpotlight from '@/components/home/MemberSpotlight';
import IntegrityWatch from '@/components/home/IntegrityWatch';
import ExploreGrid from '@/components/home/ExploreGrid';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.home');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroSection />

      <Suspense>
        <StatsBar />
      </Suspense>

      <Suspense>
        <LatestVotes />
      </Suspense>

      <Suspense>
        <ActiveLegislation />
      </Suspense>

      <Suspense>
        <ElectionSpotlight />
      </Suspense>

      <Suspense>
        <MemberSpotlight />
      </Suspense>

      <Suspense>
        <IntegrityWatch />
      </Suspense>

      <Suspense>
        <ExploreGrid />
      </Suspense>
    </div>
  );
}

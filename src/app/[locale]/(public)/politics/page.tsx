import { getTranslations } from 'next-intl/server';
import { Landmark } from 'lucide-react';
import PoliticsTabNav, {
  type PoliticsTab,
} from '@/components/politics/PoliticsTabNav';
import FactionsTab from '@/components/politics/tabs/FactionsTab';
import PartiesTab from '@/components/politics/tabs/PartiesTab';
import GroupsTab from '@/components/politics/tabs/GroupsTab';
import TimelineTab from '@/components/politics/tabs/TimelineTab';
import GraphTab from '@/components/politics/tabs/GraphTab';

const VALID_TABS: PoliticsTab[] = [
  'factions',
  'parties',
  'groups',
  'timeline',
  'graph',
];

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    tab?: string;
    knesset?: string;
    search?: string;
    type?: string;
  }>;
}

export default async function PoliticsPage({ searchParams }: Props) {
  const t = await getTranslations('politics');
  const params = await searchParams;
  const rawTab = params.tab ?? 'factions';
  const activeTab: PoliticsTab = VALID_TABS.includes(rawTab as PoliticsTab)
    ? (rawTab as PoliticsTab)
    : 'factions';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Landmark className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
      </div>

      <PoliticsTabNav activeTab={activeTab}>
        {activeTab === 'factions' && (
          <FactionsTab knessetParam={params.knesset} />
        )}
        {activeTab === 'parties' && (
          <PartiesTab searchParam={params.search} typeParam={params.type} />
        )}
        {activeTab === 'groups' && <GroupsTab />}
        {activeTab === 'timeline' && <TimelineTab />}
        {activeTab === 'graph' && <GraphTab />}
      </PoliticsTabNav>
    </div>
  );
}

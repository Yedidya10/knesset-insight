'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_KEYS = ['factions', 'parties', 'groups', 'timeline', 'graph'] as const;
export type PoliticsTab = (typeof TAB_KEYS)[number];

interface Props {
  activeTab: PoliticsTab;
  children: React.ReactNode;
}

export default function PoliticsTabNav({ activeTab, children }: Props) {
  const t = useTranslations('politics.tabs');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleTabChange(value: PoliticsTab | (string & {})) {
    const params = new URLSearchParams(searchParams.toString());
    // Remove tab-specific params when switching tabs
    params.delete('knesset');
    params.delete('search');
    params.delete('type');

    if (value === 'factions') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList variant="line" className="mb-6 w-full flex-wrap justify-start overflow-x-auto">
        {TAB_KEYS.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(key)}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

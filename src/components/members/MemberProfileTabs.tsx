'use client';

import { type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  Scale,
  ThumbsUp,
  FileText,
  Building2,
  ShieldAlert,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TabDef {
  value: string;
  icon: ReactNode;
  labelKey: string;
  content: ReactNode;
  hidden?: boolean;
}

interface MemberProfileTabsProps {
  policyContent: ReactNode;
  votesContent: ReactNode;
  legislationContent: ReactNode;
  committeesContent: ReactNode | null;
  integrityContent: ReactNode;
}

const VALID_TABS = [
  'policyStances',
  'votes',
  'legislation',
  'committees',
  'integrity',
] as const;

type TabValue = (typeof VALID_TABS)[number];

export default function MemberProfileTabs({
  policyContent,
  votesContent,
  legislationContent,
  committeesContent,
  integrityContent,
}: MemberProfileTabsProps) {
  const t = useTranslations('members.profile.tabs');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get('tab');
  const initialTab: TabValue =
    tabParam && VALID_TABS.includes(tabParam as TabValue)
      ? (tabParam as TabValue)
      : 'policyStances';

  const tabs: TabDef[] = [
    {
      value: 'policyStances',
      icon: <Scale className="h-4 w-4" />,
      labelKey: 'policyStances',
      content: policyContent,
    },
    {
      value: 'votes',
      icon: <ThumbsUp className="h-4 w-4" />,
      labelKey: 'votes',
      content: votesContent,
    },
    {
      value: 'legislation',
      icon: <FileText className="h-4 w-4" />,
      labelKey: 'legislation',
      content: legislationContent,
    },
    {
      value: 'committees',
      icon: <Building2 className="h-4 w-4" />,
      labelKey: 'committees',
      content: committeesContent,
      hidden: committeesContent === null,
    },
    {
      value: 'integrity',
      icon: <ShieldAlert className="h-4 w-4" />,
      labelKey: 'integrity',
      content: integrityContent,
    },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.hidden);

  const handleTabChange = (value: string | number | null) => {
    if (typeof value !== 'string') return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'policyStances') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, {
      scroll: false,
    });
  };

  return (
    <Tabs defaultValue={initialTab} onValueChange={handleTabChange}>
      <TabsList variant="line" className="w-full flex-nowrap overflow-x-auto">
        {visibleTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleTabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

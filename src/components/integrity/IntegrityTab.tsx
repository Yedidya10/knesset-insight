'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Gavel,
  Scale,
  AlertOctagon,
  MessageSquareWarning,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import IntegritySummary from './IntegritySummary';
import IntegrityCaseCard from './IntegrityCaseCard';
import CorporateAffiliations from './CorporateAffiliations';
import LobbyistConnections from './LobbyistConnections';
import { EthicsRequestButton } from './EthicsRequestButton';
import {
  INTEGRITY_GROUPS,
  groupIntegrityCases,
  type IntegrityGroup,
} from '@/lib/integrity/categories';

interface IntegrityCase {
  id: number;
  category: string;
  severity: string;
  status: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  sourceType: string;
  sourceName: string;
  sourceUrl: string | null;
  eventDate: string;
  resolutionDate: string | null;
  decision: string | null;
  sanctionType: string | null;
  aiSummary: string | null;
  verified: boolean | null;
}

interface CaseSummary {
  category: string;
  severity: string;
  count: number;
}

interface Affiliation {
  id: number;
  companyNumber: string;
  companyName: string;
  role: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string | null;
  potentialConflict: boolean | null;
  conflictDescription: string | null;
}

interface LobbyistConnection {
  id: number;
  lobbyistName: string;
  lobbyistNumber: string | null;
  clientName: string | null;
  connectionType: string;
  eventDate: string | null;
  sourceUrl: string | null;
}

interface IntegrityTabProps {
  memberId: number;
  memberName: string;
  cases: IntegrityCase[];
  caseSummary: CaseSummary[];
  totalCases: number;
  corporateAffiliations: Affiliation[];
  corporateCount: number;
  lobbyistConnections: LobbyistConnection[];
  lobbyistTotal: number;
}

const GROUP_ICONS: Record<IntegrityGroup, typeof Gavel> = {
  parliamentary_ethics: Gavel,
  civil_lawsuits: Scale,
  criminal: AlertOctagon,
  non_parliamentary: MessageSquareWarning,
};

export default function IntegrityTab({
  memberId,
  memberName,
  cases,
  caseSummary,
  totalCases,
  corporateAffiliations,
  corporateCount,
  lobbyistConnections,
  lobbyistTotal,
}: IntegrityTabProps) {
  const t = useTranslations('integrity');
  const [showClosed, setShowClosed] = useState(false);

  const HIDDEN_STATUSES = new Set(['closed', 'acquitted']);
  const visibleCases = cases.filter((c) => !HIDDEN_STATUSES.has(c.status));
  const hiddenCases = cases.filter((c) => HIDDEN_STATUSES.has(c.status));
  const displayedCases = showClosed ? cases : visibleCases;
  const grouped = groupIntegrityCases(displayedCases);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          <h2 className="text-xl font-bold">{t('title')}</h2>
        </div>
        <EthicsRequestButton memberId={memberId} memberName={memberName} />
      </div>

      <IntegritySummary
        totalCases={totalCases}
        caseSummary={caseSummary}
        corporateAffiliations={corporateCount}
        lobbyistConnections={lobbyistTotal}
      />

      {/* Integrity cases — grouped by type */}
      {cases.length > 0 && (
        <div className="space-y-6">
          {INTEGRITY_GROUPS.map((group) => {
            const groupCases = grouped[group];
            if (groupCases.length === 0) return null;
            const Icon = GROUP_ICONS[group];
            return (
              <section key={group} className="space-y-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Icon className="h-5 w-5" />
                  {t(`groups.${group}`)}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({groupCases.length})
                  </span>
                </h3>
                {groupCases.map((c) => (
                  <IntegrityCaseCard key={c.id} case_={c} />
                ))}
              </section>
            );
          })}
          {hiddenCases.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowClosed((prev) => !prev)}
            >
              {showClosed ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  {t('hideClosed')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  {t('showAllClosed', { count: hiddenCases.length })}
                </>
              )}
            </Button>
          )}
        </div>
      )}

      <CorporateAffiliations affiliations={corporateAffiliations} />

      <LobbyistConnections
        connections={lobbyistConnections}
        total={lobbyistTotal}
      />
    </div>
  );
}

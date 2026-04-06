'use client';

import { useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';
import IntegritySummary from './IntegritySummary';
import IntegrityCaseCard from './IntegrityCaseCard';
import CorporateAffiliations from './CorporateAffiliations';
import LobbyistConnections from './LobbyistConnections';

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
  cases: IntegrityCase[];
  caseSummary: CaseSummary[];
  totalCases: number;
  corporateAffiliations: Affiliation[];
  corporateCount: number;
  lobbyistConnections: LobbyistConnection[];
  lobbyistTotal: number;
}

export default function IntegrityTab({
  cases,
  caseSummary,
  totalCases,
  corporateAffiliations,
  corporateCount,
  lobbyistConnections,
  lobbyistTotal,
}: IntegrityTabProps) {
  const t = useTranslations('integrity');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5" />
        <h2 className="text-xl font-bold">{t('title')}</h2>
      </div>

      <IntegritySummary
        totalCases={totalCases}
        caseSummary={caseSummary}
        corporateAffiliations={corporateCount}
        lobbyistConnections={lobbyistTotal}
      />

      {/* Integrity cases timeline */}
      {cases.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">{t('caseTimeline')}</h3>
          {cases.map((c) => (
            <IntegrityCaseCard key={c.id} case_={c} />
          ))}
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

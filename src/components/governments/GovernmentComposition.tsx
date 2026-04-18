'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Users } from 'lucide-react';
import MemberAvatar from '@/components/members/MemberAvatar';
import { appConfig } from '../../../app.config';

const { govPositionIds } = appConfig.knesset;

/** All PM-level position IDs */
const PM_POSITION_IDS: Set<number> = new Set([
  govPositionIds.primeMinister,
  govPositionIds.alternatePm,
  govPositionIds.actingPm,
  ...govPositionIds.deputyPm,
]);

/** Minister position IDs (not deputy minister) */
const MINISTER_POSITION_IDS: Set<number> = new Set(govPositionIds.minister);

/** Deputy minister position IDs */
const DEPUTY_MINISTER_POSITION_IDS: Set<number> = new Set(
  govPositionIds.deputyMinister,
);

/** Detect acting minister from positionDesc */
function isActingMinister(positionDesc: string | null): boolean {
  if (!positionDesc) return false;
  return (
    positionDesc.includes('ממלא מקום') || positionDesc.includes('ממלאת מקום')
  );
}

interface Position {
  id: number;
  memberKnessetId: number;
  positionId: number;
  positionDesc: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean | null;
  memberId: number | null;
  memberFirstName: string | null;
  memberLastName: string | null;
  memberImageUrl: string | null;
  ministryId: number | null;
  ministryKnessetId: number | null;
  ministryName: string | null;
}

interface GovernmentCompositionProps {
  positions: Position[];
}

/**
 * Merge positions for the same person + role + ministry into a single entry.
 * Picks the widest date range and the latest isCurrent status.
 */
function mergePositions(positions: Position[]): Position[] {
  const groups = new Map<string, Position>();
  for (const pos of positions) {
    const key = `${pos.memberKnessetId}|${pos.positionId}|${pos.ministryKnessetId ?? 0}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...pos });
    } else {
      // Extend date range
      if (
        pos.startDate &&
        (!existing.startDate || pos.startDate < existing.startDate)
      ) {
        existing.startDate = pos.startDate;
      }
      if (pos.endDate === null) {
        existing.endDate = null;
        existing.isCurrent = true;
      } else if (
        existing.endDate !== null &&
        pos.endDate &&
        pos.endDate > existing.endDate
      ) {
        existing.endDate = pos.endDate;
        existing.isCurrent = pos.isCurrent;
      }
    }
  }
  return [...groups.values()];
}

function PositionCard({ pos }: { pos: Position }) {
  const t = useTranslations('governments');
  const memberName = pos.memberFirstName
    ? `${pos.memberFirstName} ${pos.memberLastName ?? ''}`
    : `ID: ${pos.memberKnessetId}`;

  const dateRange = pos.startDate
    ? `${pos.startDate}${pos.endDate ? ` — ${pos.endDate}` : ''}`
    : '';

  const isActive = pos.isCurrent === true || pos.endDate === null;
  const acting = isActingMinister(pos.positionDesc);

  const inner = (
    <div className="hover:bg-accent/50 flex items-center gap-3 rounded-lg p-2 transition-colors">
      <MemberAvatar
        member={{
          firstName: pos.memberFirstName,
          lastName: pos.memberLastName,
          imageUrl: pos.memberImageUrl,
        }}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm leading-tight font-medium">
            {memberName}
          </p>
          {acting && (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            >
              {t('actingMinister')}
            </Badge>
          )}
        </div>
        {pos.positionDesc && (
          <p className="text-muted-foreground truncate text-xs">
            {pos.positionDesc}
          </p>
        )}
        {dateRange && (
          <p className="text-muted-foreground text-xs">{dateRange}</p>
        )}
      </div>
      <Badge
        variant={isActive ? 'default' : 'outline'}
        className={`shrink-0 text-[10px] ${isActive ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
      >
        {isActive ? t('active') : t('ended')}
      </Badge>
    </div>
  );

  if (pos.memberId) {
    return <Link href={`/members/${pos.memberId}`}>{inner}</Link>;
  }
  return inner;
}

/** Person summary: one card per person showing all their portfolios */
function PersonCard({
  name,
  positions: personPositions,
  memberId,
  imageUrl,
}: {
  name: string;
  positions: Position[];
  memberId: number | null;
  imageUrl: string | null;
}) {
  const t = useTranslations('governments');
  const hasActive = personPositions.some(
    (p) => p.isCurrent === true || p.endDate === null,
  );

  const inner = (
    <div className="hover:bg-accent/50 flex items-start gap-3 rounded-lg p-3 transition-colors">
      <MemberAvatar
        member={{
          firstName: personPositions[0]?.memberFirstName ?? null,
          lastName: personPositions[0]?.memberLastName ?? null,
          imageUrl,
        }}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <Badge
            variant={hasActive ? 'default' : 'outline'}
            className={`shrink-0 text-[10px] ${hasActive ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
          >
            {hasActive ? t('active') : t('ended')}
          </Badge>
        </div>
        <div className="mt-1 space-y-0.5">
          {personPositions.map((pos, i) => {
            const acting = isActingMinister(pos.positionDesc);
            const dateRange = pos.startDate
              ? `${pos.startDate}${pos.endDate ? ` — ${pos.endDate}` : ''}`
              : '';
            return (
              <div key={i} className="flex items-center gap-1.5">
                <p className="text-muted-foreground truncate text-xs">
                  {pos.positionDesc ?? pos.ministryName ?? t('minister')}
                  {dateRange && ` (${dateRange})`}
                </p>
                {acting && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-300 bg-amber-50 text-[9px] text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  >
                    {t('actingMinister')}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (memberId) {
    return <Link href={`/members/${memberId}`}>{inner}</Link>;
  }
  return inner;
}

type ViewMode = 'ministry' | 'person';

export default function GovernmentComposition({
  positions,
}: GovernmentCompositionProps) {
  const t = useTranslations('governments');
  const [viewMode, setViewMode] = useState<ViewMode>('ministry');

  // Merge duplicate positions (same person + role + ministry)
  const merged = mergePositions(positions);

  // Categorize positions
  const pmPositions: Position[] = [];
  const byMinistry = new Map<string, Position[]>();
  const ministersWithoutPortfolio: Position[] = [];
  const deputyMinisterPositions: Position[] = [];

  for (const pos of merged) {
    if (PM_POSITION_IDS.has(pos.positionId)) {
      pmPositions.push(pos);
    } else if (DEPUTY_MINISTER_POSITION_IDS.has(pos.positionId)) {
      deputyMinisterPositions.push(pos);
    } else if (MINISTER_POSITION_IDS.has(pos.positionId)) {
      if (pos.ministryName) {
        const group = byMinistry.get(pos.ministryName) ?? [];
        group.push(pos);
        byMinistry.set(pos.ministryName, group);
      } else {
        ministersWithoutPortfolio.push(pos);
      }
    } else if (pos.ministryName) {
      const group = byMinistry.get(pos.ministryName) ?? [];
      group.push(pos);
      byMinistry.set(pos.ministryName, group);
    }
  }

  // Sort PM positions: PM first, then alternate PM, etc., each by start date
  pmPositions.sort((a, b) => {
    if (a.positionId !== b.positionId) return a.positionId - b.positionId;
    return (a.startDate ?? '').localeCompare(b.startDate ?? '');
  });

  // Sort each ministry's holders by start date
  const sortedMinistries = [...byMinistry.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'he'))
    .map(([name, holders]) => {
      holders.sort((a, b) =>
        (a.startDate ?? '').localeCompare(b.startDate ?? ''),
      );
      return [name, holders] as const;
    });

  // Sort deputy ministers and ministers without portfolio by start date
  deputyMinisterPositions.sort((a, b) =>
    (a.startDate ?? '').localeCompare(b.startDate ?? ''),
  );
  ministersWithoutPortfolio.sort((a, b) =>
    (a.startDate ?? '').localeCompare(b.startDate ?? ''),
  );

  // Build person-grouped view (non-PM, non-deputy positions)
  const allMinisterPositions = [
    ...merged.filter(
      (p) =>
        !PM_POSITION_IDS.has(p.positionId) &&
        !DEPUTY_MINISTER_POSITION_IDS.has(p.positionId),
    ),
  ];
  const byPerson = new Map<
    number,
    {
      name: string;
      memberId: number | null;
      imageUrl: string | null;
      positions: Position[];
    }
  >();
  for (const pos of allMinisterPositions) {
    const existing = byPerson.get(pos.memberKnessetId);
    if (existing) {
      existing.positions.push(pos);
    } else {
      const name = pos.memberFirstName
        ? `${pos.memberFirstName} ${pos.memberLastName ?? ''}`
        : `ID: ${pos.memberKnessetId}`;
      byPerson.set(pos.memberKnessetId, {
        name,
        memberId: pos.memberId,
        imageUrl: pos.memberImageUrl,
        positions: [pos],
      });
    }
  }
  const sortedPersons = [...byPerson.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'he'),
  );

  return (
    <div className="space-y-6">
      {/* Leadership Section */}
      {pmPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('leadership')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {pmPositions.map((pos) => (
              <PositionCard
                key={`${pos.memberKnessetId}-${pos.positionId}`}
                pos={pos}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'ministry' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('ministry')}
          className="gap-1.5"
        >
          <Building2 className="h-3.5 w-3.5" />
          {t('viewByMinistry')}
        </Button>
        <Button
          variant={viewMode === 'person' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('person')}
          className="gap-1.5"
        >
          <Users className="h-3.5 w-3.5" />
          {t('viewByPerson')}
        </Button>
      </div>

      {viewMode === 'ministry' ? (
        <>
          {/* Ministers by Ministry */}
          {sortedMinistries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('ministers')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedMinistries.map(([ministryName, holders]) => (
                    <div
                      key={ministryName}
                      className="space-y-1 rounded-lg border p-3"
                    >
                      <h4 className="text-primary mb-2 truncate text-sm font-semibold">
                        {ministryName}
                      </h4>
                      {holders.map((pos) => (
                        <PositionCard
                          key={`${pos.memberKnessetId}-${pos.positionId}-${pos.ministryKnessetId}`}
                          pos={pos}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ministers without portfolio */}
          {ministersWithoutPortfolio.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t('ministerWithoutPortfolio')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {ministersWithoutPortfolio.map((pos) => (
                    <PositionCard
                      key={`${pos.memberKnessetId}-${pos.positionId}-wp`}
                      pos={pos}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Person summary view */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('ministers')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortedPersons.map((person) => (
                <PersonCard
                  key={person.memberId ?? person.name}
                  name={person.name}
                  positions={person.positions}
                  memberId={person.memberId}
                  imageUrl={person.imageUrl}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deputy Ministers */}
      {deputyMinisterPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('deputyMinister')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {deputyMinisterPositions.map((pos) => (
                <PositionCard
                  key={`${pos.memberKnessetId}-${pos.positionId}`}
                  pos={pos}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
        <p className="truncate text-sm leading-tight font-medium">
          {memberName}
        </p>
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

export default function GovernmentComposition({
  positions,
}: GovernmentCompositionProps) {
  const t = useTranslations('governments');

  // Merge duplicate positions (same person + role + ministry)
  const merged = mergePositions(positions);

  // Categorize positions
  const pmPositions: Position[] = [];
  const byMinistry = new Map<string, Position[]>();
  const deputyMinisterPositions: Position[] = [];

  for (const pos of merged) {
    if (PM_POSITION_IDS.has(pos.positionId)) {
      pmPositions.push(pos);
    } else if (DEPUTY_MINISTER_POSITION_IDS.has(pos.positionId)) {
      deputyMinisterPositions.push(pos);
    } else if (MINISTER_POSITION_IDS.has(pos.positionId) && pos.ministryName) {
      const group = byMinistry.get(pos.ministryName) ?? [];
      group.push(pos);
      byMinistry.set(pos.ministryName, group);
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

  // Sort deputy ministers by start date
  deputyMinisterPositions.sort((a, b) =>
    (a.startDate ?? '').localeCompare(b.startDate ?? ''),
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

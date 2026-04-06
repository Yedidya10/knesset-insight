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
const DEPUTY_MINISTER_POSITION_IDS: Set<number> = new Set(govPositionIds.deputyMinister);

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

function PositionCard({ pos }: { pos: Position }) {
  const memberName = pos.memberFirstName
    ? `${pos.memberFirstName} ${pos.memberLastName ?? ''}`
    : `ID: ${pos.memberKnessetId}`;

  const dateRange = pos.startDate
    ? `${pos.startDate}${pos.endDate ? ` — ${pos.endDate}` : ''}`
    : '';

  const inner = (
    <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent/50">
      <MemberAvatar
        member={{
          firstName: pos.memberFirstName,
          lastName: pos.memberLastName,
          imageUrl: pos.memberImageUrl,
        }}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight truncate">{memberName}</p>
        {pos.positionDesc && (
          <p className="text-xs text-muted-foreground truncate">{pos.positionDesc}</p>
        )}
        {dateRange && (
          <p className="text-xs text-muted-foreground">{dateRange}</p>
        )}
      </div>
      {pos.isCurrent === false && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          סיום
        </Badge>
      )}
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

  // Group by ministry
  const byMinistry = new Map<string, Position[]>();
  const pmPositions: Position[] = [];
  const deputyMinisterPositions: Position[] = [];

  for (const pos of positions) {
    if (PM_POSITION_IDS.has(pos.positionId)) {
      pmPositions.push(pos);
    } else if (DEPUTY_MINISTER_POSITION_IDS.has(pos.positionId)) {
      deputyMinisterPositions.push(pos);
    } else if (MINISTER_POSITION_IDS.has(pos.positionId) && pos.ministryName) {
      const group = byMinistry.get(pos.ministryName) ?? [];
      group.push(pos);
      byMinistry.set(pos.ministryName, group);
    } else if (pos.ministryName) {
      // Other ministry-related positions
      const group = byMinistry.get(pos.ministryName) ?? [];
      group.push(pos);
      byMinistry.set(pos.ministryName, group);
    }
  }

  // Sort ministries alphabetically
  const sortedMinistries = [...byMinistry.entries()].sort(([a], [b]) =>
    a.localeCompare(b, 'he'),
  );

  return (
    <div className="space-y-6">
      {/* PM Section */}
      {pmPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('primeMinister')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {pmPositions.map((pos) => (
              <PositionCard key={pos.id} pos={pos} />
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
              {sortedMinistries.map(([ministryName, ministers]) => (
                <div
                  key={ministryName}
                  className="rounded-lg border p-3 space-y-1"
                >
                  <h4 className="text-sm font-semibold text-primary mb-2 truncate">
                    {ministryName}
                  </h4>
                  {ministers.map((pos) => (
                    <PositionCard key={pos.id} pos={pos} />
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
            <CardTitle className="text-base">
              {t('deputyMinister')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {deputyMinisterPositions.map((pos) => (
                <PositionCard key={pos.id} pos={pos} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

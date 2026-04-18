'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import MemberAvatar from '@/components/members/MemberAvatar';
import { appConfig } from '../../../app.config';

const { govPositionIds } = appConfig.knesset;

const PM_POSITION_IDS = new Set<number>([
  govPositionIds.primeMinister,
  govPositionIds.alternatePm,
  govPositionIds.actingPm,
  ...govPositionIds.deputyPm,
]);

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

interface TimelineEvent {
  date: string;
  type: 'formed' | 'appointed' | 'departed' | 'reshuffled';
  positions: Position[];
}

interface ReshuffleTimelineProps {
  positions: Position[];
  govStartDate: string | null;
}

const EVENT_DOT_COLORS: Record<TimelineEvent['type'], string> = {
  formed: 'bg-blue-500',
  appointed: 'bg-emerald-500',
  departed: 'bg-red-500',
  reshuffled: 'bg-amber-500',
};

function buildTimeline(
  positions: Position[],
  govStartDate: string | null,
): TimelineEvent[] {
  // Collect all date-based events (excluding PM-level)
  const events = new Map<
    string,
    { appointed: Position[]; departed: Position[] }
  >();

  for (const pos of positions) {
    if (PM_POSITION_IDS.has(pos.positionId)) continue;

    if (pos.startDate) {
      const entry = events.get(pos.startDate) ?? {
        appointed: [],
        departed: [],
      };
      entry.appointed.push(pos);
      events.set(pos.startDate, entry);
    }
    if (pos.endDate) {
      const entry = events.get(pos.endDate) ?? { appointed: [], departed: [] };
      entry.departed.push(pos);
      events.set(pos.endDate, entry);
    }
  }

  const timeline: TimelineEvent[] = [];

  // Add government formation event
  if (govStartDate) {
    timeline.push({
      date: govStartDate,
      type: 'formed',
      positions: [],
    });
  }

  // Convert events to timeline entries
  const sortedDates = [...events.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [date, { appointed, departed }] of sortedDates) {
    // Skip the formation date itself (initial appointments are part of formation)
    if (date === govStartDate && departed.length === 0) continue;

    if (departed.length > 0 && appointed.length > 0) {
      // Both in same date = reshuffle
      timeline.push({
        date,
        type: 'reshuffled',
        positions: [...appointed, ...departed],
      });
    } else if (appointed.length > 0) {
      // If not on formation date, it's a mid-term appointment
      if (date !== govStartDate) {
        timeline.push({ date, type: 'appointed', positions: appointed });
      }
    } else if (departed.length > 0) {
      timeline.push({ date, type: 'departed', positions: departed });
    }
  }

  return timeline;
}

function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const t = useTranslations('governments');
  const dotColor = EVENT_DOT_COLORS[event.type];

  const typeLabel = {
    formed: t('governmentFormed'),
    appointed: t('appointed'),
    departed: t('departed'),
    reshuffled: t('reshuffled'),
  }[event.type];

  return (
    <div className="relative flex gap-4 ps-10">
      {/* Timeline dot */}
      <div
        className={cn(
          'ring-background absolute start-[10px] top-1.5 h-3 w-3 rounded-full ring-2',
          dotColor,
        )}
      />

      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs tabular-nums">
            {event.date}
          </p>
          <Badge
            variant="outline"
            className={cn('text-[10px]', {
              'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400':
                event.type === 'formed',
              'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400':
                event.type === 'appointed',
              'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400':
                event.type === 'departed',
              'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400':
                event.type === 'reshuffled',
            })}
          >
            {typeLabel}
          </Badge>
        </div>

        {event.positions.length > 0 && (
          <div className="mt-2 space-y-1">
            {event.positions.map((pos) => {
              const name = pos.memberFirstName
                ? `${pos.memberFirstName} ${pos.memberLastName ?? ''}`
                : `ID: ${pos.memberKnessetId}`;
              const inner = (
                <div className="hover:bg-accent/50 flex items-center gap-2 rounded-md p-1.5 transition-colors">
                  <MemberAvatar
                    member={{
                      firstName: pos.memberFirstName,
                      lastName: pos.memberLastName,
                      imageUrl: pos.memberImageUrl,
                    }}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{name}</p>
                    {pos.positionDesc && (
                      <p className="text-muted-foreground truncate text-[11px]">
                        {pos.positionDesc}
                      </p>
                    )}
                  </div>
                </div>
              );
              return pos.memberId ? (
                <Link
                  key={`${pos.memberKnessetId}-${pos.positionId}-${pos.startDate}`}
                  href={`/members/${pos.memberId}`}
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={`${pos.memberKnessetId}-${pos.positionId}-${pos.startDate}`}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReshuffleTimeline({
  positions,
  govStartDate,
}: ReshuffleTimelineProps) {
  const t = useTranslations('governments');
  const timeline = buildTimeline(positions, govStartDate);

  if (timeline.length <= 1) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('timeline')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical rail */}
          <div className="bg-muted absolute start-4 top-0 bottom-0 w-[2px]" />

          {timeline.map((event, i) => (
            <TimelineEventItem
              key={`${event.date}-${event.type}-${i}`}
              event={event}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

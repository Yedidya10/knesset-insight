import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: number;
  title: string;
  description: string | null;
  eventDate: string;
  type: string;
  isCompleted: boolean | null;
}

interface ElectionTimelineProps {
  events: TimelineEvent[];
  typeLabels: Record<string, string>;
}

const typeColor: Record<string, string> = {
  deadline: 'bg-destructive',
  event: 'bg-primary',
  debate: 'bg-violet-500',
  announcement: 'bg-amber-500',
  milestone: 'bg-emerald-500',
};

export default function ElectionTimeline({ events, typeLabels }: ElectionTimelineProps) {
  if (events.length === 0) return null;

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute inset-y-0 start-3.5 w-px bg-border" />

      {events.map((event, i) => {
        const isPast = !!event.isCompleted;
        return (
          <div key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Dot */}
            <div
              className={cn(
                'relative z-10 mt-1 h-7 w-7 shrink-0 rounded-full border-2',
                isPast
                  ? 'border-muted-foreground bg-muted'
                  : 'border-primary bg-background',
              )}
            >
              <div
                className={cn(
                  'absolute inset-1 rounded-full',
                  isPast ? 'bg-muted-foreground/50' : (typeColor[event.type] ?? 'bg-primary'),
                )}
              />
            </div>

            {/* Content */}
            <div className={cn('min-w-0 flex-1', isPast && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-2">
                <time className="text-xs text-muted-foreground">
                  {new Date(event.eventDate).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium text-white',
                    typeColor[event.type] ?? 'bg-muted-foreground',
                  )}
                >
                  {typeLabels[event.type] ?? event.type}
                </span>
              </div>
              <h4 className="mt-1 font-medium leading-tight">{event.title}</h4>
              {event.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

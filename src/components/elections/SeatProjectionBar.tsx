'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SeatSegment {
  slug: string;
  name: string;
  seats: number;
  color: string;
}

interface SeatProjectionBarProps {
  segments: SeatSegment[];
  totalSeats: number;
  coalitionLabel: string;
  majorityLabel: string;
}

export default function SeatProjectionBar({
  segments,
  totalSeats,
  coalitionLabel,
  majorityLabel,
}: SeatProjectionBarProps) {
  const assignedSeats = segments.reduce((sum, s) => sum + s.seats, 0);
  const majorityLine = Math.ceil(totalSeats / 2) + 1; // 61 out of 120

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="bg-muted relative flex h-8 w-full overflow-hidden rounded-lg">
        <TooltipProvider>
          {segments.map((s) => {
            const width = (s.seats / totalSeats) * 100;
            if (width <= 0) return null;
            return (
              <Tooltip key={s.slug}>
                <TooltipTrigger
                  render={
                    <div
                      className="relative flex items-center justify-center overflow-hidden text-[10px] font-medium text-white transition-all"
                      style={{
                        width: `${width}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  }
                >
                  {s.seats >= 4 && (
                    <span className="truncate px-0.5">{s.seats}</span>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {s.name}: {s.seats}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
        {assignedSeats < totalSeats && (
          <div
            className="text-muted-foreground flex items-center justify-center text-[10px]"
            style={{
              width: `${((totalSeats - assignedSeats) / totalSeats) * 100}%`,
            }}
          />
        )}
        {/* Majority line */}
        <div
          className="border-foreground/50 absolute top-0 h-full border-e-2 border-dashed"
          style={{ insetInlineStart: `${(majorityLine / totalSeats) * 100}%` }}
        />
      </div>

      {/* Legend row */}
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>0</span>
        <span>
          {majorityLabel}: {majorityLine}
        </span>
        <span>{totalSeats}</span>
      </div>

      {/* Party legend */}
      <div className="flex flex-wrap gap-2">
        {segments
          .filter((s) => s.seats > 0)
          .map((s) => (
            <div key={s.slug} className="flex items-center gap-1 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span>
                {s.name} ({s.seats})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

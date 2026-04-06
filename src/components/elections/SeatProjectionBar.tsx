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
      <div className="relative flex h-8 w-full overflow-hidden rounded-lg bg-muted">
        {segments.map((s) => {
          const width = (s.seats / totalSeats) * 100;
          if (width <= 0) return null;
          return (
            <div
              key={s.slug}
              className="relative flex items-center justify-center overflow-hidden text-[10px] font-medium text-white transition-all"
              style={{
                width: `${width}%`,
                backgroundColor: s.color,
              }}
              title={`${s.name}: ${s.seats}`}
            >
              {s.seats >= 4 && <span className="truncate px-0.5">{s.seats}</span>}
            </div>
          );
        })}
        {assignedSeats < totalSeats && (
          <div
            className="flex items-center justify-center text-[10px] text-muted-foreground"
            style={{ width: `${((totalSeats - assignedSeats) / totalSeats) * 100}%` }}
          />
        )}
        {/* Majority line */}
        <div
          className="absolute top-0 h-full border-e-2 border-dashed border-foreground/50"
          style={{ insetInlineStart: `${(majorityLine / totalSeats) * 100}%` }}
        />
      </div>

      {/* Legend row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
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

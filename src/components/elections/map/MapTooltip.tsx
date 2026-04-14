'use client';

interface MapTooltipProps {
  x: number;
  y: number;
  cityName: string;
  turnoutPercent: number;
  eligibleVoters: number;
  actualVoters: number;
}

export default function MapTooltip({
  x,
  y,
  cityName,
  turnoutPercent,
  eligibleVoters,
  actualVoters,
}: MapTooltipProps) {
  return (
    <div
      className="bg-popover text-popover-foreground pointer-events-none fixed z-50 rounded-lg border px-3.5 py-2.5 shadow-xl"
      style={{
        left: x + 14,
        top: y - 44,
      }}
    >
      <p className="text-sm font-bold">{cityName}</p>
      <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
        <p className="tabular-nums">
          <span className="text-foreground font-semibold">
            {turnoutPercent.toFixed(1)}%
          </span>{' '}
          <span className="opacity-70">
            ({actualVoters.toLocaleString()} / {eligibleVoters.toLocaleString()}
            )
          </span>
        </p>
      </div>
    </div>
  );
}

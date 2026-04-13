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
      className="bg-popover text-popover-foreground pointer-events-none fixed z-50 rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{
        left: x + 12,
        top: y - 40,
      }}
    >
      <p className="font-semibold">{cityName}</p>
      <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
        <p>
          {turnoutPercent.toFixed(1)}%{' '}
          <span className="opacity-70">
            ({actualVoters.toLocaleString()} / {eligibleVoters.toLocaleString()}
            )
          </span>
        </p>
      </div>
    </div>
  );
}

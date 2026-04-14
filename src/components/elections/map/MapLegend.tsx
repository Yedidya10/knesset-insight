'use client';

import type { ViewMode } from './IsraelMap';

interface MapLegendProps {
  viewMode: ViewMode;
  colorRange: readonly [string, string];
  lowLabel: string;
  highLabel: string;
}

export default function MapLegend({
  viewMode,
  colorRange,
  lowLabel,
  highLabel,
}: MapLegendProps) {
  if (viewMode !== 'turnout') return null;

  return (
    <div className="bg-background/95 absolute start-4 bottom-4 flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm shadow-md backdrop-blur-sm">
      <span className="text-muted-foreground font-medium">{lowLabel}</span>
      <div
        className="h-4 w-32 rounded-sm"
        style={{
          background: `linear-gradient(to right, ${colorRange[0]}, ${colorRange[1]})`,
        }}
      />
      <span className="text-muted-foreground font-medium">{highLabel}</span>
      <span className="text-muted-foreground ms-1 tabular-nums">30%–90%</span>
    </div>
  );
}

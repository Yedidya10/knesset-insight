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
    <div className="bg-background/90 absolute start-4 bottom-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
      <span className="text-muted-foreground">{lowLabel}</span>
      <div
        className="h-3 w-24 rounded-sm"
        style={{
          background: `linear-gradient(to right, ${colorRange[0]}, ${colorRange[1]})`,
        }}
      />
      <span className="text-muted-foreground">{highLabel}</span>
      <span className="text-muted-foreground ms-2">30%–90%</span>
    </div>
  );
}

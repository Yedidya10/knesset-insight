'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Segment {
  label: string;
  count: number;
  color: string;
}

interface VoteDistributionBarProps {
  segments: Segment[];
  total: number;
}

export default function VoteDistributionBar({
  segments,
  total,
}: VoteDistributionBarProps) {
  if (total <= 0) return null;

  return (
    <div className="mb-4 flex h-4 overflow-hidden rounded-full">
      <TooltipProvider>
        {segments.map(
          (seg) =>
            seg.count > 0 && (
              <Tooltip key={seg.label}>
                <TooltipTrigger
                  render={
                    <div
                      className={seg.color}
                      style={{
                        width: `${(seg.count / total) * 100}%`,
                      }}
                    />
                  }
                />
                <TooltipContent>
                  {seg.label}: {seg.count}
                </TooltipContent>
              </Tooltip>
            ),
        )}
      </TooltipProvider>
    </div>
  );
}

'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from '@/i18n/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface SeatData {
  memberId: number;
  name: string;
  factionName: string;
  factionColor: string;
  isCoalition: boolean;
}

interface KnessetHemicycleProps {
  seats: SeatData[];
  coalitionLabel: string;
  oppositionLabel: string;
}

/** Compute hemicycle seat positions — 5 arcs, coalition left, opposition right */
function computeSeatPositions(seats: SeatData[]) {
  const rows = [18, 22, 24, 28, 28]; // seats per row (inner → outer)
  const totalSeats = rows.reduce((a, b) => a + b, 0); // 120

  // Split into coalition and opposition
  const coalition = seats.filter((s) => s.isCoalition);
  const opposition = seats.filter((s) => !s.isCoalition);

  // Build ordered array: coalition on left half, opposition on right half
  // Each row is split: left half = coalition, right half = opposition
  const positioned: {
    seat: SeatData;
    cx: number;
    cy: number;
    row: number;
  }[] = [];

  const centerX = 400;
  const centerY = 340;
  const innerRadius = 140;
  const rowSpacing = 32;
  const gapAngle = 0.06; // gap between coalition/opposition in radians

  let coalitionIdx = 0;
  let oppositionIdx = 0;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const seatsInRow = rows[rowIdx];
    const radius = innerRadius + rowIdx * rowSpacing;

    // Split row: half for coalition (left/start), half for opposition (right/end)
    const coalitionInRow = Math.round(
      (coalition.length / totalSeats) * seatsInRow,
    );
    const oppositionInRow = seatsInRow - coalitionInRow;

    // Coalition seats: from ~170° down to ~90° + gap
    const startAngleCoalition = Math.PI - 0.22; // ~170°
    const endAngleCoalition = Math.PI / 2 + gapAngle;
    for (
      let i = 0;
      i < coalitionInRow && coalitionIdx < coalition.length;
      i++
    ) {
      const t = coalitionInRow > 1 ? i / (coalitionInRow - 1) : 0.5;
      const angle =
        startAngleCoalition + t * (endAngleCoalition - startAngleCoalition);
      positioned.push({
        seat: coalition[coalitionIdx++],
        cx: centerX + radius * Math.cos(angle),
        cy: centerY - radius * Math.sin(angle),
        row: rowIdx,
      });
    }

    // Opposition seats: from ~90° - gap down to ~10°
    const startAngleOpposition = Math.PI / 2 - gapAngle;
    const endAngleOpposition = 0.22; // ~10°
    for (
      let i = 0;
      i < oppositionInRow && oppositionIdx < opposition.length;
      i++
    ) {
      const t = oppositionInRow > 1 ? i / (oppositionInRow - 1) : 0.5;
      const angle =
        startAngleOpposition + t * (endAngleOpposition - startAngleOpposition);
      positioned.push({
        seat: opposition[oppositionIdx++],
        cx: centerX + radius * Math.cos(angle),
        cy: centerY - radius * Math.sin(angle),
        row: rowIdx,
      });
    }
  }

  return positioned;
}

export default function KnessetHemicycle({
  seats,
  coalitionLabel,
  oppositionLabel,
}: KnessetHemicycleProps) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const positioned = useMemo(() => computeSeatPositions(seats), [seats]);

  const handleSeatClick = useCallback(
    (memberId: number) => {
      router.push(`/members/${memberId}`);
    },
    [router],
  );

  // Randomized initial scatter positions for animation
  const scatterPositions = useMemo(
    () =>
      positioned.map(() => ({
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 300,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scatter is computed once on mount
    [positioned.length],
  );

  return (
    <TooltipProvider delay={100}>
      <div className="relative mx-auto w-full max-w-[800px]">
        <svg
          viewBox="0 0 800 380"
          className="h-auto w-full"
          role="img"
          aria-label="Knesset hemicycle visualization"
        >
          {/* Coalition / Opposition labels */}
          <text
            x="180"
            y="370"
            textAnchor="middle"
            className="fill-muted-foreground text-[11px] font-medium"
          >
            {coalitionLabel}
          </text>
          <text
            x="620"
            y="370"
            textAnchor="middle"
            className="fill-muted-foreground text-[11px] font-medium"
          >
            {oppositionLabel}
          </text>

          {/* Center dividing line */}
          <line
            x1="400"
            y1="190"
            x2="400"
            y2="345"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
            strokeDasharray="4,4"
          />

          {/* Seats */}
          {positioned.map(({ seat, cx, cy, row }, i) => {
            const isHovered = hoveredId === seat.memberId;
            const dotRadius = 6.5 - row * 0.3;

            return (
              <Tooltip key={seat.memberId}>
                <TooltipTrigger
                  render={
                    <motion.circle
                      initial={{
                        cx: 400 + scatterPositions[i].x,
                        cy: 190 + scatterPositions[i].y,
                        opacity: 0.15,
                        r: 3,
                      }}
                      animate={{
                        cx,
                        cy,
                        opacity: isHovered ? 1 : 0.85,
                        r: isHovered ? dotRadius + 2 : dotRadius,
                      }}
                      transition={{
                        cx: {
                          duration: 1,
                          delay: 0.3 + i * 0.005,
                          type: 'spring',
                          stiffness: 80,
                          damping: 15,
                        },
                        cy: {
                          duration: 1,
                          delay: 0.3 + i * 0.005,
                          type: 'spring',
                          stiffness: 80,
                          damping: 15,
                        },
                        opacity: { duration: 0.6, delay: 0.3 + i * 0.005 },
                        r: { duration: 0.2 },
                      }}
                      fill={seat.factionColor || 'hsl(var(--muted-foreground))'}
                      className="animate-seat-pulse cursor-pointer drop-shadow-sm"
                      style={{ animationDelay: `${(i % 20) * 150}ms` }}
                      onMouseEnter={() => setHoveredId(seat.memberId)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => handleSeatClick(seat.memberId)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${seat.name} - ${seat.factionName}`}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSeatClick(seat.memberId);
                        }
                      }}
                    />
                  }
                />
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold">{seat.name}</p>
                  <p className="text-muted-foreground">{seat.factionName}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </svg>
      </div>
    </TooltipProvider>
  );
}

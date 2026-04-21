'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
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

/**
 * Compute hemicycle seat positions — 5 concentric arcs, uniform spacing.
 * All seats in each row are evenly distributed across the full 180° arc.
 * Opposition fills left side, coalition fills right side — proportional to
 * their share per row. This guarantees perfectly symmetric dot spacing.
 */
function computeSeatPositions(seats: SeatData[]) {
  const rows = [18, 22, 24, 28, 28]; // seats per row (inner → outer)
  const totalSeats = rows.reduce((a, b) => a + b, 0); // 120

  const coalition = seats.filter((s) => s.isCoalition);
  const opposition = seats.filter((s) => !s.isCoalition);

  const positioned: {
    seat: SeatData;
    cx: number;
    cy: number;
    row: number;
  }[] = [];

  const centerX = 500;
  const centerY = 420;
  const innerRadius = 175;
  const rowSpacing = 38;
  const edgePad = 0.08; // radians padding at 0° and 180° edges

  let coalitionIdx = 0;
  let oppositionIdx = 0;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const seatsInRow = rows[rowIdx];
    const radius = innerRadius + rowIdx * rowSpacing;

    // How many of this row belong to opposition (left) vs coalition (right)
    const oppositionInRow = Math.round(
      (opposition.length / totalSeats) * seatsInRow,
    );
    const coalitionInRow = seatsInRow - oppositionInRow;

    // Evenly space ALL seats from π-pad to 0+pad
    const arcStart = Math.PI - edgePad; // left edge (~177°)
    const arcEnd = edgePad; // right edge (~3°)

    for (let i = 0; i < seatsInRow; i++) {
      const t = seatsInRow > 1 ? i / (seatsInRow - 1) : 0.5;
      const angle = arcStart + t * (arcEnd - arcStart);
      const cx = centerX + radius * Math.cos(angle);
      const cy = centerY - radius * Math.sin(angle);

      // First seats (low index = left side) = opposition, rest = coalition
      if (i < oppositionInRow && oppositionIdx < opposition.length) {
        positioned.push({
          seat: opposition[oppositionIdx++],
          cx,
          cy,
          row: rowIdx,
        });
      } else if (coalitionIdx < coalition.length) {
        positioned.push({
          seat: coalition[coalitionIdx++],
          cx,
          cy,
          row: rowIdx,
        });
      }
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const positioned = useMemo(() => computeSeatPositions(seats), [seats]);

  const handleSeatClick = useCallback(
    (memberId: number) => {
      router.push(`/members/${memberId}`);
    },
    [router],
  );

  const scatterPositions = useMemo(
    () =>
      positioned.map(() => ({
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 300,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positioned.length],
  );

  const renderSeat = (
    { seat, cx, cy, row }: (typeof positioned)[0],
    i: number,
  ) => {
    const isHovered = hoveredId === seat.memberId;
    // Desktop: larger dots (9→7.5 by row), Mobile: keep smaller (6.5→5)
    const dotRadius = isMobile ? 6.5 - row * 0.3 : 9 - row * 0.4;

    const circle = (
      <motion.circle
        initial={{
          cx: 500 + scatterPositions[i].x,
          cy: 210 + scatterPositions[i].y,
          opacity: 0.15,
          r: isMobile ? 3 : 4,
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
        className={`animate-seat-pulse drop-shadow-sm ${isMobile ? '' : 'cursor-pointer'}`}
        style={{ animationDelay: `${(i % 20) * 150}ms` }}
        {...(!isMobile && {
          onMouseEnter: () => setHoveredId(seat.memberId),
          onMouseLeave: () => setHoveredId(null),
          onClick: () => handleSeatClick(seat.memberId),
          role: 'button' as const,
          tabIndex: 0,
          'aria-label': `${seat.name} - ${seat.factionName}`,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSeatClick(seat.memberId);
            }
          },
        })}
      />
    );

    // Mobile: purely decorative dots, no links or tooltips
    if (isMobile) return circle;

    return (
      <Tooltip key={seat.memberId}>
        <TooltipTrigger render={circle} />
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">{seat.name}</p>
          <p className="text-muted-foreground">{seat.factionName}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delay={100}>
      <div className="relative mx-auto flex w-full max-w-[900px] justify-center">
        <svg
          viewBox="0 0 1000 460"
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto max-h-[min(414px,48svh)] w-full"
          role="img"
          aria-label="Knesset hemicycle visualization"
        >
          {/* Coalition / Opposition labels */}
          <text
            x="720"
            y="445"
            textAnchor="middle"
            className="fill-muted-foreground text-[13px] font-medium"
          >
            {coalitionLabel}
          </text>
          <text
            x="280"
            y="445"
            textAnchor="middle"
            className="fill-muted-foreground text-[13px] font-medium"
          >
            {oppositionLabel}
          </text>

          {/* Center dividing line */}
          <line
            x1="500"
            y1="230"
            x2="500"
            y2="425"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
            strokeDasharray="4,4"
          />

          {/* Seats */}
          {positioned.map((pos, i) => (
            <g key={pos.seat.memberId}>{renderSeat(pos, i)}</g>
          ))}
        </svg>
      </div>
    </TooltipProvider>
  );
}

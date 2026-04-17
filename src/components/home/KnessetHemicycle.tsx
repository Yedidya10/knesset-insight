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
 * Compute hemicycle seat positions — 5 concentric arcs, proper semicircle.
 * Coalition on the right (speaker's left), opposition on the left (speaker's right).
 * Arc spans from π (180°) to 0° with a small gap at the center (90°).
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
  const gapAngle = 0.04; // radians gap at center vertical

  // Angle range endpoints with a small margin from 0° and 180°
  const startAngle = Math.PI - 0.12; // ~177° (left edge)
  const endAngle = 0.12; // ~3° (right edge)

  let coalitionIdx = 0;
  let oppositionIdx = 0;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const seatsInRow = rows[rowIdx];
    const radius = innerRadius + rowIdx * rowSpacing;

    const coalitionInRow = Math.round(
      (coalition.length / totalSeats) * seatsInRow,
    );
    const oppositionInRow = seatsInRow - coalitionInRow;

    // Coalition: right half — from (π/2 - gap) down to endAngle
    const coalStartAngle = Math.PI / 2 - gapAngle;
    const coalEndAngle = endAngle;
    for (
      let i = 0;
      i < coalitionInRow && coalitionIdx < coalition.length;
      i++
    ) {
      const t = coalitionInRow > 1 ? i / (coalitionInRow - 1) : 0.5;
      const angle = coalStartAngle + t * (coalEndAngle - coalStartAngle);
      positioned.push({
        seat: coalition[coalitionIdx++],
        cx: centerX + radius * Math.cos(angle),
        cy: centerY - radius * Math.sin(angle),
        row: rowIdx,
      });
    }

    // Opposition: left half — from startAngle down to (π/2 + gap)
    const oppStartAngle = startAngle;
    const oppEndAngle = Math.PI / 2 + gapAngle;
    for (
      let i = 0;
      i < oppositionInRow && oppositionIdx < opposition.length;
      i++
    ) {
      const t = oppositionInRow > 1 ? i / (oppositionInRow - 1) : 0.5;
      const angle = oppStartAngle + t * (oppEndAngle - oppStartAngle);
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
        className="animate-seat-pulse cursor-pointer drop-shadow-sm"
        style={{ animationDelay: `${(i % 20) * 150}ms` }}
        onMouseEnter={() => !isMobile && setHoveredId(seat.memberId)}
        onMouseLeave={() => !isMobile && setHoveredId(null)}
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
    );

    // No tooltips on mobile
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
      <div className="relative mx-auto w-full max-w-[900px]">
        <svg
          viewBox="0 0 1000 460"
          className="h-auto w-full"
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

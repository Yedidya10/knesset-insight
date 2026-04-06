'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GroupData {
  id: number;
  slug: string;
  canonicalName: string;
  shortName: string | null;
  color: string | null;
  isActive: boolean | null;
}

interface TermData {
  politicalGroupId: number | null;
  knessetNum: number | null;
  name: string;
  seats: number | null;
  isCoalition: boolean | null;
}

interface Props {
  groups: GroupData[];
  terms: TermData[];
}

const MIN_KNESSET = 10;
const MAX_KNESSET = 25;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const LEFT_LABEL_WIDTH = 160;
const CELL_WIDTH = 52;

export default function PoliticalTimeline({ groups, terms }: Props) {
  const t = useTranslations('politicalGroups');
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);

  // Build a map: groupId → [{ knessetNum, seats, isCoalition, name }]
  const groupTermsMap = useMemo(() => {
    const map = new Map<number, TermData[]>();
    for (const term of terms) {
      if (!term.politicalGroupId || !term.knessetNum) continue;
      const existing = map.get(term.politicalGroupId) ?? [];
      existing.push(term);
      map.set(term.politicalGroupId, existing);
    }
    return map;
  }, [terms]);

  // Filter groups that have at least one term in the range
  const visibleGroups = useMemo(() => {
    return groups.filter((g) => {
      const gTerms = groupTermsMap.get(g.id);
      return gTerms && gTerms.some(
        (t) => t.knessetNum !== null && t.knessetNum >= MIN_KNESSET && t.knessetNum <= MAX_KNESSET,
      );
    });
  }, [groups, groupTermsMap]);

  const knessetNums = Array.from(
    { length: MAX_KNESSET - MIN_KNESSET + 1 },
    (_, i) => MIN_KNESSET + i,
  );

  const svgWidth = LEFT_LABEL_WIDTH + knessetNums.length * CELL_WIDTH + 20;
  const svgHeight = HEADER_HEIGHT + visibleGroups.length * ROW_HEIGHT + 20;

  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="text-sm"
          role="img"
          aria-label={t('timeline')}
        >
          {/* Header row — Knesset numbers */}
          {knessetNums.map((num, i) => (
            <text
              key={num}
              x={LEFT_LABEL_WIDTH + i * CELL_WIDTH + CELL_WIDTH / 2}
              y={HEADER_HEIGHT - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              {num}
            </text>
          ))}

          {/* Grid lines */}
          {knessetNums.map((_, i) => (
            <line
              key={`vline-${i}`}
              x1={LEFT_LABEL_WIDTH + i * CELL_WIDTH}
              y1={HEADER_HEIGHT}
              x2={LEFT_LABEL_WIDTH + i * CELL_WIDTH}
              y2={svgHeight}
              className="stroke-border"
              strokeWidth={0.5}
            />
          ))}

          {/* Rows */}
          {visibleGroups.map((group, rowIdx) => {
            const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
            const gTerms = groupTermsMap.get(group.id) ?? [];
            const isHovered = hoveredGroup === group.id;

            return (
              <g
                key={group.id}
                onMouseEnter={() => setHoveredGroup(group.id)}
                onMouseLeave={() => setHoveredGroup(null)}
                opacity={hoveredGroup === null || isHovered ? 1 : 0.3}
                className="transition-opacity duration-200"
              >
                {/* Row background */}
                {rowIdx % 2 === 0 && (
                  <rect
                    x={0}
                    y={y}
                    width={svgWidth}
                    height={ROW_HEIGHT}
                    className="fill-muted/30"
                  />
                )}

                {/* Group label */}
                <Link href={`/political-groups/${group.slug}`}>
                  <text
                    x={LEFT_LABEL_WIDTH - 8}
                    y={y + ROW_HEIGHT / 2 + 4}
                    textAnchor="end"
                    className="fill-foreground text-xs font-medium cursor-pointer hover:fill-primary"
                  >
                    {group.shortName ?? group.canonicalName}
                  </text>
                </Link>

                {/* Term cells */}
                {gTerms.map((term) => {
                  if (!term.knessetNum || term.knessetNum < MIN_KNESSET || term.knessetNum > MAX_KNESSET) return null;
                  const colIdx = term.knessetNum - MIN_KNESSET;
                  const cx = LEFT_LABEL_WIDTH + colIdx * CELL_WIDTH + CELL_WIDTH / 2;
                  const cy = y + ROW_HEIGHT / 2;
                  const radius = Math.min(Math.max((term.seats ?? 4) / 2, 6), 18);

                  return (
                    <Tooltip key={`${group.id}-${term.knessetNum}`}>
                      <TooltipTrigger>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={radius}
                          fill={group.color ?? 'hsl(var(--primary))'}
                          opacity={0.8}
                          stroke={term.isCoalition ? 'hsl(var(--chart-1))' : 'transparent'}
                          strokeWidth={term.isCoalition ? 2 : 0}
                          className="cursor-pointer transition-all hover:opacity-100"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{term.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('knesset', { num: term.knessetNum })}
                          {term.seats ? ` · ${term.seats} ${t('seats')}` : ''}
                          {term.isCoalition ? ` · ${t('coalition')}` : ''}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </TooltipProvider>
  );
}

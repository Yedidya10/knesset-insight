'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

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

const MIN_KNESSET_FULL = 10;
const MIN_KNESSET_RECENT = 20;
const MAX_KNESSET = 25;
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 44;
const LEFT_LABEL_WIDTH = 180;
const CELL_WIDTH = 72;
const CIRCLE_R = 9;

export default function PoliticalTimeline({ groups, terms }: Props) {
  const t = useTranslations('politicalGroups');
  const tPolitics = useTranslations('politics');
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const minKnesset = showAll ? MIN_KNESSET_FULL : MIN_KNESSET_RECENT;

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
        (t) => t.knessetNum !== null && t.knessetNum >= minKnesset && t.knessetNum <= MAX_KNESSET,
      );
    });
  }, [groups, groupTermsMap, minKnesset]);

  const knessetNums = Array.from(
    { length: MAX_KNESSET - minKnesset + 1 },
    (_, i) => minKnesset + i,
  );

  const svgWidth = LEFT_LABEL_WIDTH + knessetNums.length * CELL_WIDTH + 20;
  const svgHeight = HEADER_HEIGHT + visibleGroups.length * ROW_HEIGHT + 10;

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? tPolitics('showRecent') : tPolitics('showAll')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t('knesset', { num: minKnesset })} – {t('knesset', { num: MAX_KNESSET })}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card" style={{ direction: 'ltr' }}>
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
              y={HEADER_HEIGHT - 14}
              textAnchor="middle"
              className="fill-muted-foreground text-xs font-semibold"
            >
              {num}
            </text>
          ))}

          {/* Header separator */}
          <line
            x1={LEFT_LABEL_WIDTH}
            y1={HEADER_HEIGHT - 4}
            x2={LEFT_LABEL_WIDTH + knessetNums.length * CELL_WIDTH}
            y2={HEADER_HEIGHT - 4}
            className="stroke-border"
            strokeWidth={1}
          />

          {/* Vertical grid lines */}
          {knessetNums.map((_, i) => (
            <line
              key={`vline-${i}`}
              x1={LEFT_LABEL_WIDTH + i * CELL_WIDTH}
              y1={HEADER_HEIGHT}
              x2={LEFT_LABEL_WIDTH + i * CELL_WIDTH}
              y2={svgHeight}
              className="stroke-border"
              strokeWidth={0.3}
              strokeDasharray="4 4"
            />
          ))}

          {/* Zebra-stripe backgrounds — separate layer so hover doesn't affect them */}
          {visibleGroups.map((_, rowIdx) => {
            if (rowIdx % 2 !== 0) return null;
            const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
            return (
              <rect
                key={`bg-${rowIdx}`}
                x={0}
                y={y}
                width={svgWidth}
                height={ROW_HEIGHT}
                className="fill-muted/20"
              />
            );
          })}

          {/* Rows */}
          {visibleGroups.map((group, rowIdx) => {
            const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
            const cy = y + ROW_HEIGHT / 2;
            const gTerms = groupTermsMap.get(group.id) ?? [];
            const isHovered = hoveredGroup === group.id;

            // Unique sorted knesset numbers for connecting lines
            const visibleNums = [...new Set(
              gTerms
                .filter(t => t.knessetNum && t.knessetNum >= minKnesset && t.knessetNum <= MAX_KNESSET)
                .map(t => t.knessetNum!),
            )].sort((a, b) => a - b);

            return (
              <g
                key={group.id}
                onMouseEnter={() => setHoveredGroup(group.id)}
                onMouseLeave={() => setHoveredGroup(null)}
                opacity={hoveredGroup === null || isHovered ? 1 : 0.35}
                className="transition-opacity duration-200"
              >
                {/* Hover highlight */}
                {isHovered && (
                  <rect
                    x={0}
                    y={y}
                    width={svgWidth}
                    height={ROW_HEIGHT}
                    className="fill-primary/5"
                  />
                )}

                {/* Connecting lines between consecutive knesset appearances */}
                {visibleNums.map((num, i) => {
                  if (i === 0) return null;
                  const prev = visibleNums[i - 1];
                  if (num - prev > 1) return null;
                  const cx1 = LEFT_LABEL_WIDTH + (prev - minKnesset) * CELL_WIDTH + CELL_WIDTH / 2;
                  const cx2 = LEFT_LABEL_WIDTH + (num - minKnesset) * CELL_WIDTH + CELL_WIDTH / 2;
                  return (
                    <line
                      key={`conn-${prev}-${num}`}
                      x1={cx1}
                      y1={cy}
                      x2={cx2}
                      y2={cy}
                      stroke={group.color ?? 'var(--primary)'}
                      strokeWidth={3}
                      strokeOpacity={0.25}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Group label */}
                <Link href={`/political-groups/${group.slug}`}>
                  <text
                    x={LEFT_LABEL_WIDTH - 12}
                    y={cy + 5}
                    textAnchor="end"
                    className="fill-foreground text-xs font-medium cursor-pointer hover:fill-primary"
                  >
                    {group.shortName ?? group.canonicalName}
                  </text>
                </Link>

                {/* Term circles */}
                {gTerms.map((term, termIdx) => {
                  if (!term.knessetNum || term.knessetNum < minKnesset || term.knessetNum > MAX_KNESSET) return null;
                  const colIdx = term.knessetNum - minKnesset;
                  const cx = LEFT_LABEL_WIDTH + colIdx * CELL_WIDTH + CELL_WIDTH / 2;

                  const tooltipText = [
                    term.name,
                    t('knesset', { num: term.knessetNum }),
                    term.seats ? `${term.seats} ${t('seats')}` : '',
                    term.isCoalition ? t('coalition') : '',
                  ].filter(Boolean).join(' · ');

                  return (
                    <circle
                      key={`${group.id}-${term.knessetNum}-${termIdx}`}
                      cx={cx}
                      cy={cy}
                      r={CIRCLE_R}
                      fill={group.color ?? 'var(--primary)'}
                      style={{ stroke: 'var(--card)' }}
                      strokeWidth={2.5}
                      className="cursor-pointer"
                    >
                      <title>{tooltipText}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

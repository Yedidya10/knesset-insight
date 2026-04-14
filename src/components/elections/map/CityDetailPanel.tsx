'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Maximally distinct party colors (no two similar hues)
const PARTY_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#f59e0b', // amber
  '#9333ea', // purple
  '#ec4899', // pink
  '#0891b2', // cyan
  '#ea580c', // orange
  '#4f46e5', // indigo
  '#65a30d', // lime
];

interface PartyResult {
  ballotLetters: string;
  partyName: string;
  votes: number;
  votePercent: number;
}

interface TrendPoint {
  knessetNum: number;
  eligibleVoters: number;
  actualVoters: number;
  turnoutPercent: number;
}

interface CityDetailPanelProps {
  cityName: string;
  cityCode: string;
  eligibleVoters: number;
  actualVoters: number;
  validVotes: number;
  invalidVotes: number;
  turnoutPercent: number;
  parties: PartyResult[];
  trends: TrendPoint[];
  onClose: () => void;
}

export default function CityDetailPanel({
  cityName,
  eligibleVoters,
  actualVoters,
  validVotes,
  turnoutPercent,
  parties,
  trends,
  onClose,
}: CityDetailPanelProps) {
  const t = useTranslations('electionMap');

  const topParties = parties.slice(0, 8);
  const donutData = topParties.map((p, i) => ({
    name: p.ballotLetters,
    value: p.votes,
    percent: p.votePercent,
    color: PARTY_COLORS[i % PARTY_COLORS.length],
  }));

  const maxPercent = topParties.length > 0 ? topParties[0].votePercent : 1;

  const trendData = trends.map((tp) => ({
    knesset: `K${tp.knessetNum}`,
    turnout: tp.turnoutPercent,
    voters: tp.actualVoters,
  }));

  return (
    <div className="bg-background flex h-full flex-col overflow-y-auto border-s">
      {/* Header */}
      <div className="bg-background sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-lg font-bold">{cityName}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 p-4">
        {/* Voter stats */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-muted-foreground text-xs">
                  {t('national.eligible')}
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {eligibleVoters.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">
                  {t('national.voters')}
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {actualVoters.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground text-sm">
                  {t('national.turnout')}
                </span>
                <span className="text-2xl font-black tabular-nums">
                  {turnoutPercent.toFixed(1)}%
                </span>
              </div>
              <Progress value={turnoutPercent} className="mt-1.5 h-2.5" />
            </div>
          </CardContent>
        </Card>

        {/* Donut chart — no labels on slices, legend below */}
        {donutData.length > 0 && (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold">
                {t('city.partyBreakdown')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    {/* Center label */}
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-foreground text-lg font-bold"
                    >
                      {validVotes.toLocaleString()}
                    </text>
                    <text
                      x="50%"
                      y="56%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {t('city.votes')}
                    </text>
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value).toLocaleString()} (${((Number(value) / validVotes) * 100).toFixed(1)}%)`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        color: '#f1f5f9',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                      }}
                      itemStyle={{ color: '#f1f5f9' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend grid */}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {donutData.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm leading-tight"
                  >
                    <div
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate font-medium">{entry.name}</span>
                    <span className="text-muted-foreground ms-auto shrink-0 text-xs tabular-nums">
                      {entry.percent.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top parties — styled bar list (replaces recharts BarChart) */}
        {topParties.length > 0 && (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold">
                {t('city.topParties')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {topParties.map((p, i) => {
                  const color = PARTY_COLORS[i % PARTY_COLORS.length];
                  const barWidth =
                    maxPercent > 0 ? (p.votePercent / maxPercent) * 100 : 0;
                  return (
                    <div key={p.ballotLetters}>
                      <div className="mb-0.5 flex items-baseline justify-between">
                        <span className="text-sm font-semibold">
                          {p.ballotLetters}
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {p.votes.toLocaleString()} ({p.votePercent.toFixed(1)}
                          %)
                        </span>
                      </div>
                      <div className="bg-muted h-3 w-full overflow-hidden rounded-sm">
                        <div
                          className="h-full rounded-sm transition-all duration-300"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend chart across elections */}
        {trendData.length > 1 && (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold">
                {t('city.trends')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="knesset"
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(1)}%`]}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        color: '#f1f5f9',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                      }}
                      itemStyle={{ color: '#f1f5f9' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="turnout"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 5 }}
                      name={t('national.turnout')}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

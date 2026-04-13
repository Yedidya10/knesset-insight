'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Generated palette for up to 10 parties
const PARTY_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#6366f1',
  '#84cc16',
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
  turnoutPercent,
  parties,
  trends,
  onClose,
}: CityDetailPanelProps) {
  const t = useTranslations('electionMap');

  const topParties = parties.slice(0, 8);
  const donutData = topParties.map((p, i) => ({
    name: p.partyName,
    value: p.votes,
    color: PARTY_COLORS[i % PARTY_COLORS.length],
  }));

  const barData = topParties.map((p) => ({
    name:
      p.partyName.length > 12 ? p.partyName.slice(0, 12) + '…' : p.partyName,
    fullName: p.partyName,
    percent: p.votePercent,
    votes: p.votes,
  }));

  const trendData = trends.map((t) => ({
    knesset: `K${t.knessetNum}`,
    turnout: t.turnoutPercent,
    voters: t.actualVoters,
  }));

  return (
    <div className="bg-background flex h-full flex-col overflow-y-auto border-s">
      {/* Header */}
      <div className="bg-background sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-lg font-semibold">{cityName}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        {/* Voter stats */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">
                  {t('national.eligible')}
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {eligibleVoters.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('national.voters')}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {actualVoters.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground text-sm">
                  {t('national.turnout')}
                </span>
                <span className="text-xl font-bold tabular-nums">
                  {turnoutPercent.toFixed(1)}%
                </span>
              </div>
              <Progress value={turnoutPercent} className="mt-1 h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Donut chart */}
        {donutData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {t('city.partyBreakdown')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      strokeWidth={1}
                      stroke="hsl(var(--background))"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value).toLocaleString()} ${t('city.votes')}`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="mt-2 flex flex-wrap gap-2">
                {donutData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs">
                    <div
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Horizontal bar chart */}
        {barData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('city.topParties')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ left: 0, right: 10 }}
                  >
                    <XAxis type="number" domain={[0, 'auto']} hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(1)}%`]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                      }}
                    />
                    <Bar
                      dataKey="percent"
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend chart across elections */}
        {trendData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('city.trends')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis dataKey="knesset" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(1)}%`]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="turnout"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
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

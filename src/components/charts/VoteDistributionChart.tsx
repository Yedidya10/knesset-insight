'use client';

import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FactionVoteData {
  factionName: string;
  forCount: number;
  againstCount: number;
  abstainCount: number;
}

interface VoteDistributionChartProps {
  data: FactionVoteData[];
}

export default function VoteDistributionChart({ data }: VoteDistributionChartProps) {
  const t = useTranslations('votes');

  if (data.length === 0) return null;

  return (
    <div className="h-64 w-full sm:h-80 lg:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" className="text-xs" />
          <YAxis type="category" dataKey="factionName" width={70} className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
            }}
          />
          <Legend />
          <Bar dataKey="forCount" name={t('for')} fill="oklch(0.65 0.18 160)" stackId="votes" />
          <Bar dataKey="againstCount" name={t('against')} fill="oklch(0.6 0.2 25)" stackId="votes" />
          <Bar dataKey="abstainCount" name={t('abstain')} fill="oklch(0.75 0.12 75)" stackId="votes" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

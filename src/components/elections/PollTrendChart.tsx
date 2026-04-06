'use client';

import { useTranslations } from 'next-intl';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface PollSeries {
  name: string;
  color: string;
  slug: string;
  data: (number | null)[];
}

interface PollTrendChartProps {
  dates: string[];
  series: PollSeries[];
}

export default function PollTrendChart({ dates, series }: PollTrendChartProps) {
  const t = useTranslations('elections2026');

  if (dates.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border bg-muted/30">
        <p className="text-sm text-muted-foreground">{t('polls.noPolls')}</p>
      </div>
    );
  }

  // Transform data into recharts format: [{date, series1, series2, ...}]
  const chartData = dates.map((date, i) => {
    const point: Record<string, string | number | null> = { date };
    for (const s of series) {
      point[s.slug] = s.data[i];
    }
    return point;
  });

  return (
    <div className="h-72 w-full sm:h-80 lg:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tickFormatter={(v: string) =>
              new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            }
          />
          <YAxis className="text-xs" domain={[0, 'auto']} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
            }}
            labelFormatter={(v) =>
              new Date(String(v)).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            }
          />
          <Legend />
          <ReferenceLine
            y={3.25}
            stroke="hsl(var(--destructive))"
            strokeDasharray="6 4"
            label={{ value: t('threshold'), position: 'insideTopRight', fontSize: 11 }}
          />
          {series.map((s) => (
            <Line
              key={s.slug}
              type="monotone"
              dataKey={s.slug}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

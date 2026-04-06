import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface MkActivityData {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    isCurrent: boolean | null;
  };
  voteStats: {
    total: number;
    forVotes: number;
    againstVotes: number;
    abstainVotes: number;
    absentVotes: number;
  } | null;
  billCount: number;
  participationRate: number;
}

interface CandidateMkActivityProps {
  activity: MkActivityData;
  labels: {
    title: string;
    votes: string;
    forVotes: string;
    againstVotes: string;
    abstainVotes: string;
    absent: string;
    bills: string;
    billsInitiated: string;
    participation: string;
    participationRate: string;
    viewFullProfile: string;
  };
}

export default function CandidateMkActivity({ activity, labels }: CandidateMkActivityProps) {
  const stats = activity.voteStats;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Participation rate */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{labels.participationRate}</span>
            <span className="font-semibold">{activity.participationRate}%</span>
          </div>
          <Progress value={activity.participationRate} className="h-2" />
        </div>

        {/* Vote breakdown */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={labels.forVotes} value={stats.forVotes} color="text-emerald-600 dark:text-emerald-400" />
            <Stat label={labels.againstVotes} value={stats.againstVotes} color="text-red-600 dark:text-red-400" />
            <Stat label={labels.abstainVotes} value={stats.abstainVotes} color="text-amber-600 dark:text-amber-400" />
            <Stat label={labels.absent} value={stats.absentVotes} color="text-muted-foreground" />
          </div>
        )}

        {/* Bills */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">{labels.billsInitiated}</span>
          <span className="text-lg font-bold">{activity.billCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

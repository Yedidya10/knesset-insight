import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MkActivityData {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    isCurrent: boolean | null;
  };
  billCount: number;
}

interface CandidateMkActivityProps {
  activity: MkActivityData;
  labels: {
    title: string;
    billsInitiated: string;
    viewFullProfile: string;
  };
}

export default function CandidateMkActivity({
  activity,
  labels,
}: CandidateMkActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bills */}
        <div className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2">
          <span className="text-muted-foreground text-sm">
            {labels.billsInitiated}
          </span>
          <span className="text-lg font-bold">{activity.billCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}

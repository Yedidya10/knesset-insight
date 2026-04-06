import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import ElectionStatusBadge from './ElectionStatusBadge';

interface CandidateListCardProps {
  slug: string;
  name: string;
  shortName: string | null;
  leaderName: string | null;
  status: string;
  color: string | null;
  estimatedSeats: number | null;
  politicalPosition: string | null;
  statusLabels: Record<string, string>;
  positionLabels: Record<string, string>;
  seatsLabel: string;
  leaderLabel: string;
}

export default function CandidateListCard({
  slug,
  name,
  leaderName,
  status,
  color,
  estimatedSeats,
  politicalPosition,
  statusLabels,
  positionLabels,
  seatsLabel,
  leaderLabel,
}: CandidateListCardProps) {
  return (
    <Link href={`/elections/2026/parties/${slug}`}>
      <Card className="glass-card hover-lift overflow-hidden transition-colors">
        <div
          className="h-1.5"
          style={{ backgroundColor: color ?? 'hsl(var(--muted))' }}
        />
        <CardContent className="p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{name}</h3>
            <ElectionStatusBadge status={status} labels={statusLabels} />
          </div>

          {leaderName && (
            <p className="mb-2 text-sm text-muted-foreground">
              {leaderLabel}: {leaderName}
            </p>
          )}

          <div className="flex items-center justify-between">
            {politicalPosition && (
              <span className="text-xs text-muted-foreground">
                {positionLabels[politicalPosition] ?? politicalPosition}
              </span>
            )}
            {estimatedSeats != null && estimatedSeats > 0 && (
              <span className="text-sm font-bold">
                {estimatedSeats} {seatsLabel}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

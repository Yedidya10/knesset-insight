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
            <h3 className="leading-tight font-semibold">{name}</h3>
            <ElectionStatusBadge status={status} labels={statusLabels} />
          </div>

          {leaderName && (
            <p className="text-muted-foreground mb-2 text-sm">
              {leaderLabel}: {leaderName}
            </p>
          )}

          {politicalPosition && (
            <div className="flex items-center">
              <span className="text-muted-foreground text-xs">
                {positionLabels[politicalPosition] ?? politicalPosition}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

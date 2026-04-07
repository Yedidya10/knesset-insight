import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import MemberAvatar from '@/components/members/MemberAvatar';
import ElectionStatusBadge from './ElectionStatusBadge';

interface CandidateCardProps {
  slug: string;
  partySlug: string;
  firstName: string;
  lastName: string;
  position: number | null;
  status: string;
  isLeader: boolean;
  imageUrl: string | null;
  profession: string | null;
  memberId: number | null;
  statusLabels: Record<string, string>;
  positionLabel: string;
  currentMkLabel: string;
}

export default function CandidateCard({
  slug,
  partySlug,
  firstName,
  lastName,
  position,
  status,
  isLeader,
  imageUrl,
  profession,
  memberId,
  statusLabels,
  positionLabel,
  currentMkLabel,
}: CandidateCardProps) {
  return (
    <Link href={`/elections/2026/parties/${partySlug}/candidates/${slug}`}>
      <Card className="glass-card hover-lift transition-colors">
        <CardContent className="flex items-center gap-3 p-3">
          {/* Avatar */}
          <MemberAvatar
            member={{ firstName, lastName, imageUrl }}
            size="sm"
          />

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {position != null && (
                <span className="text-xs font-bold text-muted-foreground">
                  #{position}
                </span>
              )}
              <span className="truncate font-medium">
                {firstName} {lastName}
              </span>
              {isLeader && (
                <span className="shrink-0 text-xs text-primary">★</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {profession && <span className="truncate">{profession}</span>}
              {memberId && (
                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {currentMkLabel}
                </span>
              )}
            </div>
          </div>

          <ElectionStatusBadge status={status} labels={statusLabels} />
        </CardContent>
      </Card>
    </Link>
  );
}
